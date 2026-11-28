// functions/passkey-password-login.js
// Username/password login that mints a session JWT. The client's existing
// password-login path continues to apply role/UI changes itself; this just
// gives it a token that the passkey-challenge endpoint can verify when the
// user subsequently chooses "save passkey to this device".
//
// Passwords are SHA-256 hashed by the client before storage (tagged with a
// "sha256$" prefix); some legacy accounts may still hold plaintext. This
// endpoint verifies via verifyUserPassword(), which handles both formats and
// must stay in lockstep with the client's hashPassword()/verifyPassword().

import {
  getConfig,
  requireConfig,
  findUserByUsername,
  verifyUserPassword,
  signSessionJwt,
  jsonResponse,
  errorResponse,
} from "./_passkey-shared.js";

export const config = { path: "/api/passkey/password-login" };

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
  const username = (body.username || "").toString().trim().toLowerCase();
  const password = (body.password || "").toString();
  if (!username || !password) return errorResponse(400, "username and password required");

  // Look up the user. The user table is tiny so we just fetch and filter
  // server-side via the shared helper — robust against PostgREST quirks.
  let u;
  try {
    u = await findUserByUsername(cfg, username);
  } catch (e) {
    console.error("password-login: findUserByUsername failed:", e.message);
    return errorResponse(500, "Could not query users table: " + e.message);
  }
  if (!u) return errorResponse(401, "Invalid username or password");
  // Passwords are SHA-256 hashed by the client (tagged "sha256$…"), with
  // legacy accounts possibly still in plaintext. verifyUserPassword handles
  // both — it must mirror the client's hashing exactly.
  if (!verifyUserPassword(password, u.password)) {
    return errorResponse(401, "Invalid username or password");
  }

  const token = signSessionJwt(cfg, {
    sub: u.id,
    username: u.username,
    name: u.name || u.username,
    role: u.role || "viewer",
  });
  return jsonResponse(200, {
    ok: true,
    token,
    user: {
      id: u.id,
      username: u.username,
      name: u.name || u.username,
      role: u.role || "viewer",
    },
  });
}
