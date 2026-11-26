// functions/passkey-challenge.js
// Issues a WebAuthn challenge for one of two intents:
//   intent=register     — first-time passkey enrolment on a device. Caller
//                         must include a valid session JWT proving they're
//                         already logged in (so a stranger can't enrol a
//                         passkey on someone else's account).
//   intent=authenticate — login via existing passkey. Caller supplies the
//                         username; we return the challenge plus the list of
//                         allowed credential ids registered for that user.
//
// Challenge is stored in the `passkey_challenges` table with a short TTL so
// the verify step can confirm the response matches a freshly issued one.

import {
  generateRegistrationOptions,
  generateAuthenticationOptions,
} from "@simplewebauthn/server";
import {
  getConfig,
  requireConfig,
  supaFetch,
  findUserByUsername,
  verifySessionJwt,
  jsonResponse,
  errorResponse,
} from "./_passkey-shared.js";

export const config = { path: "/api/passkey/challenge" };

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

  let user; // resolved user we're issuing a challenge for
  let allowCredentials = []; // for authenticate intent

  if (intent === "register") {
    // Must be authenticated already — verify the session JWT.
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    const session = verifySessionJwt(cfg, token);
    if (!session || !session.sub) {
      return errorResponse(401, "Authentication required to enrol a passkey");
    }
    // Resolve user record from session
    user = {
      id: session.sub,
      username: session.username || session.sub,
      name: session.name || session.username || session.sub,
    };
  } else {
    // authenticate: identify the user by username
    const username = (body.username || "").toString().trim().toLowerCase();
    if (!username) return errorResponse(400, "username required");

    // Look up the user from the public.users table. Anyone can submit a
    // username; if it doesn't exist we still issue a challenge (to avoid
    // username enumeration) but with an empty allowCredentials list. The
    // verify step will then fail with a generic error.
    const u = await findUserByUsername(cfg, username);
    if (u) {
      user = { id: u.id, username: u.username, name: u.name || u.username };
      // Find all passkeys for this user
      const keys = await supaFetch(
        cfg,
        `/rest/v1/passkeys?select=id,transports&user_id=eq.${encodeURIComponent(u.id)}`
      );
      allowCredentials = (keys || []).map((k) => ({
        id: k.id,
        transports: k.transports || undefined,
      }));
    } else {
      user = { id: "__unknown__", username, name: username };
    }
  }

  // Generate the options object the browser will pass to navigator.credentials.
  let options;
  if (intent === "register") {
    // Pull the user's existing credentials so the browser knows not to offer
    // re-enrolment on a device that's already registered.
    const existing = await supaFetch(
      cfg,
      `/rest/v1/passkeys?select=id,transports&user_id=eq.${encodeURIComponent(user.id)}`
    );
    options = await generateRegistrationOptions({
      rpName: cfg.rpName,
      rpID: cfg.rpID,
      userID: Buffer.from(user.id),
      userName: user.username,
      userDisplayName: user.name,
      attestationType: "none",
      excludeCredentials: (existing || []).map((k) => ({
        id: k.id,
        transports: k.transports || undefined,
      })),
      authenticatorSelection: {
        // platform = built-in (Face ID, Touch ID, Windows Hello). cross-platform
        // would be USB security keys. We allow either; the OS picks the best.
        residentKey: "preferred",
        userVerification: "preferred",
      },
    });
  } else {
    options = await generateAuthenticationOptions({
      rpID: cfg.rpID,
      allowCredentials,
      userVerification: "preferred",
    });
  }

  // Store the challenge so verify can confirm it's a fresh one
  await supaFetch(cfg, "/rest/v1/passkey_challenges", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      username: user.username,
      challenge: options.challenge,
      intent,
      // 5 min TTL — plenty for a biometric prompt; short enough to limit
      // replay window if a row is ever leaked.
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    }),
  });

  // Best-effort cleanup of stale challenges (keeps table tiny)
  try {
    await supaFetch(
      cfg,
      `/rest/v1/passkey_challenges?expires_at=lt.${encodeURIComponent(new Date().toISOString())}`,
      { method: "DELETE", headers: { Prefer: "return=minimal" } }
    );
  } catch (_) {
    // Non-fatal
  }

  return jsonResponse(200, { options });
}
