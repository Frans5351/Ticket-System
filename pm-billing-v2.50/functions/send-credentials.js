// functions/send-credentials.js
// Two credential email flows for the Park Manor app:
//
//   { mode: "invite", email, username, password, name? }
//     Sent by an admin from the Users screen AFTER the client has already
//     generated + saved the new password hash. This endpoint only emails the
//     one-time plaintext to the user.
//
//   { mode: "reset", email }
//     Self-service "Forgot password?" from the login screen. Looks up the
//     user by email, generates a new password, saves its hash on the user
//     record, and emails the credentials. Always responds { ok: true } so the
//     endpoint can't be used to probe which emails exist.
//
// Email transport + setup: see functions/_email-shared.js (Brevo).

import { jsonResponse, errorResponse, getConfig } from "./_passkey-shared.js";
import crypto from "node:crypto";
import { sendEmail, emailConfigError, looksLikeEmail } from "./_email-shared.js";

export const config = { path: "/api/send-credentials" };

const APP_URL = (process.env.APP_BASE_URL || "https://park-manor-bc.netlify.app").replace(/\/$/, "");

// Must match the client (public/index.html) and _passkey-shared.js exactly.
const PW_SALT = "park-manor-v1";
const PW_HASH_PREFIX = "sha256$";
function hashPw(plain) {
  return PW_HASH_PREFIX + crypto.createHash("sha256").update(PW_SALT + ":" + String(plain)).digest("hex");
}

function genPassword() {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(6);
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[bytes[i] % chars.length];
  return "PM-" + out;
}

function escH(v) {
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function shell(bodyHtml) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#eef1f5">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f5;padding:24px 12px"><tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:14px;border:1px solid #e4e9ef;overflow:hidden">
      <tr><td style="padding:22px 28px;border-bottom:3px solid #1fa898">
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:bold;color:#3a4354;letter-spacing:2px">PARK MANOR</div>
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#1fa898;font-weight:bold">Body Corporate</div>
      </td></tr>
      <tr><td style="padding:26px 28px">${bodyHtml}</td></tr>
      <tr><td style="padding:16px 28px;background:#f5f7fa;border-top:1px solid #e4e9ef">
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#8b96a5;line-height:1.5">Automated email from the Park Manor reporting system \u00b7 17 Echium Road, Table View</div>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

function credsBlock(username, password) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#f5f7fa;border:1px solid #e4e9ef;border-radius:9px;margin:14px 0"><tr><td style="padding:16px 18px">
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#8b96a5;text-transform:uppercase;letter-spacing:1px">Username</div>
    <div style="font-family:Consolas,Menlo,monospace;font-size:16px;color:#3a4354;font-weight:bold;margin:2px 0 12px">${escH(username)}</div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#8b96a5;text-transform:uppercase;letter-spacing:1px">Password</div>
    <div style="font-family:Consolas,Menlo,monospace;font-size:16px;color:#3a4354;font-weight:bold;margin-top:2px">${escH(password)}</div>
  </td></tr></table>`;
}

function loginButton() {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 6px"><tr>
    <td style="border-radius:9px;background:#1fa898">
      <a href="${APP_URL}" target="_blank" style="display:inline-block;padding:13px 26px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none">Open Park Manor</a>
    </td></tr></table>
  <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#8b96a5">After signing in, you can change your password with the \ud83d\udd11 button at the top of the app.</div>`;
}

async function fetchUsers() {
  const cfg = getConfig();
  const supaUrl = cfg.supaUrl || "https://spagcmzhlngtqvrydzvi.supabase.co";
  const supaKey = cfg.supaServiceKey ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwYWdjbXpobG5ndHF2cnlkenZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MTA1OTgsImV4cCI6MjA5NDA4NjU5OH0.TfRrz2iUPFm7AUL55BRNJtyhNl--s8yBbtejcD9yjPU";
  const res = await fetch(supaUrl + "/rest/v1/users?select=id,data", {
    headers: { apikey: supaKey, Authorization: "Bearer " + supaKey, Accept: "application/json" },
  });
  if (!res.ok) throw new Error("users query " + res.status);
  const rows = await res.json();
  return { rows: Array.isArray(rows) ? rows : [], supaUrl, supaKey };
}

export default async function handler(req) {
  if (req.method !== "POST") return errorResponse(405, "Method not allowed");
  const cfgErr = emailConfigError();
  if (cfgErr) return errorResponse(500, cfgErr);

  let body;
  try { body = await req.json(); } catch (_) { return errorResponse(400, "Invalid JSON body"); }
  const mode = String(body.mode || "");

  if (mode === "invite") {
    const email = String(body.email || "").trim();
    const username = String(body.username || "").trim().slice(0, 100);
    const password = String(body.password || "").slice(0, 100);
    const name = String(body.name || "").trim().slice(0, 150);
    if (!looksLikeEmail(email) || !username || !password) {
      return errorResponse(400, "email, username and password are required");
    }
    const html = shell(`
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:bold;color:#3a4354;margin-bottom:6px">Your Park Manor login details</div>
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#5c6675;line-height:1.6">Hi${name ? " " + escH(name) : ""}, an account has been set up for you on the Park Manor system \u2014 where the complex\u2019s maintenance reports are tracked.</div>
      ${credsBlock(username, password)}
      ${loginButton()}
    `);
    const text = `Your Park Manor login details\n\nUsername: ${username}\nPassword: ${password}\n\nSign in at: ${APP_URL}\nAfter signing in you can change your password with the key button at the top of the app.`;
    const r = await sendEmail({ to: [email], subject: "Your Park Manor login details", text, html });
    if (!r.ok) {
      console.error("send-credentials invite failed:", r.status, r.msg, "| to:", email);
      return errorResponse(502, r.msg);
    }
    console.log("send-credentials: invite sent to", email, "for", username);
    return jsonResponse(200, { ok: true, id: r.id });
  }

  if (mode === "reset") {
    const email = String(body.email || "").trim().toLowerCase();
    // Always answer ok \u2014 never reveal whether the email exists.
    if (!looksLikeEmail(email)) return jsonResponse(200, { ok: true });
    try {
      const { rows, supaUrl, supaKey } = await fetchUsers();
      const hit = rows.find((r) => {
        const u = r && r.data ? r.data : null;
        return u && String(u.email || "").trim().toLowerCase() === email;
      });
      if (!hit) {
        console.log("send-credentials: reset requested for unknown email");
        return jsonResponse(200, { ok: true });
      }
      const u = hit.data;
      const tmp = genPassword();
      u.password = hashPw(tmp);
      const patch = await fetch(supaUrl + "/rest/v1/users?id=eq." + encodeURIComponent(hit.id), {
        method: "PATCH",
        headers: {
          apikey: supaKey, Authorization: "Bearer " + supaKey,
          "Content-Type": "application/json", Prefer: "return=minimal",
        },
        body: JSON.stringify({ data: u }),
      });
      if (!patch.ok) {
        console.error("send-credentials: reset save failed", patch.status);
        return jsonResponse(200, { ok: true });
      }
      const html = shell(`
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:bold;color:#3a4354;margin-bottom:6px">Your new Park Manor login details</div>
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#5c6675;line-height:1.6">A password reset was requested for your account. Your old password no longer works \u2014 use these details to sign in:</div>
        ${credsBlock(u.username, tmp)}
        ${loginButton()}
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#9a6200;line-height:1.6;margin-top:12px;padding:10px 12px;background:#fdf6ea;border-left:3px solid #9a6200;border-radius:4px">Didn\u2019t request this? Let a trustee know \u2014 someone entered your email on the reset form.</div>
      `);
      const text = `Your new Park Manor login details\n\nUsername: ${u.username}\nPassword: ${tmp}\n\nSign in at: ${APP_URL}\nYour old password no longer works. If you didn't request this, tell a trustee.`;
      const r = await sendEmail({ to: [u.email], subject: "Your new Park Manor login details", text, html });
      if (!r.ok) console.error("send-credentials reset email failed:", r.status, r.msg);
      else console.log("send-credentials: reset sent for", u.username);
    } catch (e) {
      console.error("send-credentials reset error:", e.message);
    }
    return jsonResponse(200, { ok: true });
  }

  return errorResponse(400, "Unknown mode");
}
