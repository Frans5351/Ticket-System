// functions/passkey-verify.js
// Verifies the browser's signed WebAuthn response. Two intents:
//   register     — saves the new public key for the authenticated user.
//                  Returns a fresh session JWT.
//   authenticate — checks the signature against a stored public key,
//                  increments the counter, returns a session JWT.

import {
  verifyRegistrationResponse,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import {
  getConfig,
  requireConfig,
  supaFetch,
  findUserByUsername,
  signSessionJwt,
  verifySessionJwt,
  jsonResponse,
  errorResponse,
} from "./_passkey-shared.js";

export const config = { path: "/api/passkey/verify" };

export default async function handler(req) {
  if (req.method !== "POST") return errorResponse(405, "Method not allowed");
  let cfg;
  try {
    cfg = getConfig();
    requireConfig(cfg);
  } catch (e) {
    return errorResponse(500, e.message);
  }

  let body;
  try {
    body = await req.json();
  } catch (_) {
    return errorResponse(400, "Invalid JSON body");
  }
  const intent = body.intent;
  if (intent !== "register" && intent !== "authenticate") {
    return errorResponse(400, "intent must be 'register' or 'authenticate'");
  }
  if (!body.response) return errorResponse(400, "response required");

  // We use the username to find the matching challenge; for register we also
  // verify via the session JWT.
  let username;
  let userId; // canonical app user id (USERS table id)
  let userRecord = null;

  if (intent === "register") {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    const session = verifySessionJwt(cfg, token);
    if (!session || !session.sub) {
      return errorResponse(401, "Authentication required to enrol a passkey");
    }
    userId = session.sub;
    username = (session.username || "").toString().toLowerCase();
  } else {
    username = (body.username || "").toString().trim().toLowerCase();
    if (!username) return errorResponse(400, "username required");
    // Resolve the canonical user id
    userRecord = await findUserByUsername(cfg, username);
    if (!userRecord) return errorResponse(401, "Invalid passkey or unknown user");
    userId = userRecord.id;
  }

  // Fetch the most recent issued challenge for this username + intent
  const challenges = await supaFetch(
    cfg,
    `/rest/v1/passkey_challenges?select=*&username=eq.${encodeURIComponent(username)}&intent=eq.${encodeURIComponent(intent)}&order=expires_at.desc&limit=1`
  );
  const challRow = challenges && challenges[0];
  if (!challRow) {
    return errorResponse(400, "No pending challenge — request a new one");
  }
  if (new Date(challRow.expires_at).getTime() < Date.now()) {
    return errorResponse(400, "Challenge expired — try again");
  }
  const expectedChallenge = challRow.challenge;

  // Always consume the challenge regardless of outcome (defence-in-depth
  // against replay; also keeps the table tidy).
  try {
    await supaFetch(
      cfg,
      `/rest/v1/passkey_challenges?id=eq.${encodeURIComponent(challRow.id)}`,
      { method: "DELETE", headers: { Prefer: "return=minimal" } }
    );
  } catch (_) {}

  if (intent === "register") {
    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: body.response,
        expectedChallenge,
        expectedOrigin: cfg.origin,
        expectedRPID: cfg.rpID,
        requireUserVerification: false,
      });
    } catch (e) {
      return errorResponse(400, "Registration verification failed: " + e.message);
    }
    if (!verification.verified || !verification.registrationInfo) {
      return errorResponse(400, "Registration not verified");
    }
    const info = verification.registrationInfo;
    // simplewebauthn v11 nests under .credential
    const credential = info.credential || info;
    const credId = credential.id;
    const publicKey = credential.publicKey;
    const counter = credential.counter || 0;
    const transports = body.response.response?.transports || null;

    // Friendly device name from User-Agent (best effort; user can rename later)
    const ua = req.headers.get("user-agent") || "";
    const deviceName = guessDeviceName(ua);

    // Public key is a Uint8Array — store as base64
    const pkB64 = Buffer.from(publicKey).toString("base64");

    await supaFetch(cfg, "/rest/v1/passkeys", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        id: credId,
        user_id: userId,
        public_key: pkB64,
        counter,
        transports,
        device_name: deviceName,
      }),
    });

    // Issue a fresh 90-day session token
    const token = signSessionJwt(cfg, {
      sub: userId,
      username,
    });
    return jsonResponse(200, { ok: true, token });
  }

  // ── authenticate ────────────────────────────────────────────────────────
  const credId = body.response.id;
  if (!credId) return errorResponse(400, "Malformed credential response");
  const stored = await supaFetch(
    cfg,
    `/rest/v1/passkeys?select=*&id=eq.${encodeURIComponent(credId)}&limit=1`
  );
  const passkey = stored && stored[0];
  if (!passkey || passkey.user_id !== userId) {
    return errorResponse(401, "Unknown passkey for this user");
  }
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge,
      expectedOrigin: cfg.origin,
      expectedRPID: cfg.rpID,
      credential: {
        id: passkey.id,
        publicKey: new Uint8Array(Buffer.from(passkey.public_key, "base64")),
        counter: passkey.counter || 0,
        transports: passkey.transports || undefined,
      },
      requireUserVerification: false,
    });
  } catch (e) {
    return errorResponse(400, "Authentication verification failed: " + e.message);
  }
  if (!verification.verified) {
    return errorResponse(401, "Passkey verification failed");
  }

  // Update the counter to defeat replay attacks
  const newCounter = verification.authenticationInfo.newCounter;
  await supaFetch(
    cfg,
    `/rest/v1/passkeys?id=eq.${encodeURIComponent(passkey.id)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ counter: newCounter }),
    }
  );

  // Build the session token. Include username + role so the client can
  // restore the UI without an extra round-trip.
  const tokenPayload = {
    sub: userId,
    username,
    name: userRecord?.name || username,
    role: userRecord?.role || "viewer",
  };
  const token = signSessionJwt(cfg, tokenPayload);
  return jsonResponse(200, {
    ok: true,
    token,
    user: {
      id: userId,
      username,
      name: userRecord?.name || username,
      role: userRecord?.role || "viewer",
    },
  });
}

// Quick-and-dirty device labelling. Users can rename in Settings.
function guessDeviceName(ua) {
  if (!ua) return "Unknown device";
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) {
    const m = ua.match(/\(Linux;[^;]*;\s*([^)]+?)\s*Build/);
    return m ? m[1] : "Android device";
  }
  if (/Macintosh/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows PC";
  if (/Linux/i.test(ua)) return "Linux PC";
  return "Browser";
}
