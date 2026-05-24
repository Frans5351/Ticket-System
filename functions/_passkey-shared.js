// functions/_passkey-shared.js
// Shared helpers for passkey-challenge and passkey-verify.
// Pure Node crypto for JWT signing; direct fetch against Supabase REST API.

import crypto from "node:crypto";

// ── Env / config ─────────────────────────────────────────────────────────
export function getConfig() {
  const cfg = {
    rpID: process.env.PASSKEY_RP_ID,           // e.g. "park-manor.netlify.app"
    rpName: process.env.PASSKEY_RP_NAME || "Park Manor",
    origin: process.env.PASSKEY_ORIGIN,        // e.g. "https://park-manor.netlify.app"
    jwtSecret: process.env.PASSKEY_JWT_SECRET, // long random string
    supaUrl: process.env.SUPABASE_URL || "https://spagcmzhlngtqvrydzvi.supabase.co",
    supaServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  // If origin not explicitly set, derive from rpID
  if (!cfg.origin && cfg.rpID) cfg.origin = "https://" + cfg.rpID;
  return cfg;
}

export function requireConfig(cfg) {
  const missing = [];
  if (!cfg.rpID) missing.push("PASSKEY_RP_ID");
  if (!cfg.origin) missing.push("PASSKEY_ORIGIN");
  if (!cfg.jwtSecret) missing.push("PASSKEY_JWT_SECRET");
  if (!cfg.supaServiceKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (missing.length) {
    throw new Error("Missing required env vars: " + missing.join(", "));
  }
}

// ── Supabase REST helpers (using service role key, bypasses RLS) ─────────
// Service key required because passkeys and passkey_challenges tables have
// RLS enabled and no anon-readable policy.
export async function supaFetch(cfg, path, init = {}) {
  const url = cfg.supaUrl + path;
  const headers = {
    apikey: cfg.supaServiceKey,
    Authorization: "Bearer " + cfg.supaServiceKey,
    "Content-Type": "application/json",
    ...(init.headers || {}),
  };
  const r = await fetch(url, { ...init, headers });
  if (!r.ok) {
    const body = await r.text();
    throw new Error("Supabase " + r.status + " on " + path + ": " + body);
  }
  // Some endpoints (DELETE, upsert with no return) come back with empty body
  const txt = await r.text();
  return txt ? JSON.parse(txt) : null;
}

// ── JWT (HS256) ──────────────────────────────────────────────────────────
// We're not using `jose` or `jsonwebtoken` to keep the function bundle tiny.
// HS256 is fine — same secret signs and verifies, only the Netlify function
// holds the secret. Client treats the JWT as opaque + decodes for display.
function base64UrlEncode(input) {
  const b = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return b.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function base64UrlDecodeToBuffer(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Buffer.from(s, "base64");
}

export function signSessionJwt(cfg, payload, ttlSec = 60 * 60 * 24 * 90) {
  const now = Math.floor(Date.now() / 1000);
  const head = { alg: "HS256", typ: "JWT" };
  const body = { ...payload, iat: now, exp: now + ttlSec };
  const h = base64UrlEncode(JSON.stringify(head));
  const b = base64UrlEncode(JSON.stringify(body));
  const sig = crypto
    .createHmac("sha256", cfg.jwtSecret)
    .update(h + "." + b)
    .digest();
  return h + "." + b + "." + base64UrlEncode(sig);
}

export function verifySessionJwt(cfg, token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, b, sig] = parts;
  const expected = crypto
    .createHmac("sha256", cfg.jwtSecret)
    .update(h + "." + b)
    .digest();
  const provided = base64UrlDecodeToBuffer(sig);
  if (
    expected.length !== provided.length ||
    !crypto.timingSafeEqual(expected, provided)
  ) {
    return null;
  }
  let payload;
  try {
    payload = JSON.parse(base64UrlDecodeToBuffer(b).toString("utf8"));
  } catch (_) {
    return null;
  }
  if (payload.exp && Date.now() / 1000 > payload.exp) return null;
  return payload;
}

// ── Misc ─────────────────────────────────────────────────────────────────
export function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export function errorResponse(status, message, extra = {}) {
  return jsonResponse(status, { error: message, ...extra });
}

// Find a user in the users table by their username (case-insensitive). The
// users table has columns (id, data) where data is the JSON record. The table
// is tiny so we just fetch all and filter in code — more robust than
// PostgREST's nested-JSON filter syntax which has occasional edge cases.
export async function findUserByUsername(cfg, username) {
  const target = String(username || "").toLowerCase();
  if (!target) return null;
  const rows = await supaFetch(cfg, "/rest/v1/users?select=id,data");
  const match = (rows || []).find((r) => {
    const u = (r && (r.data || r)) || {};
    return (u.username || "").toString().toLowerCase() === target;
  });
  if (!match) return null;
  return match.data || match;
}

// ── Password verification ─────────────────────────────────────────────────
// The browser hashes passwords with SHA-256 over "<salt>:<plaintext>" and
// stores them tagged with a "sha256$" prefix (see hashPassword() in the
// client). Older accounts may still hold legacy plaintext. This helper must
// stay in lockstep with the client's hashPassword()/verifyPassword() so a
// login works regardless of which path (local cache vs. this server endpoint)
// performs the check.
const PW_HASH_PREFIX = "sha256$";
const PW_SALT = "park-manor-v1"; // must match client PW_SALT exactly

function hashPasswordServer(plain) {
  const hex = crypto
    .createHash("sha256")
    .update(PW_SALT + ":" + String(plain))
    .digest("hex");
  return PW_HASH_PREFIX + hex;
}

// Returns true if the entered plaintext matches the stored value, whether that
// stored value is a "sha256$…" hash (current) or legacy plaintext (old).
export function verifyUserPassword(plainEntered, stored) {
  if (stored == null) return false;
  const storedStr = String(stored);
  if (storedStr.indexOf(PW_HASH_PREFIX) === 0) {
    return hashPasswordServer(plainEntered) === storedStr;
  }
  return String(plainEntered) === storedStr; // legacy plaintext
}
