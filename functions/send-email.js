// functions/send-email.js
// Sends an email via Brevo (see functions/_email-shared.js for setup). Used by the supplier
// "Email quote request" button so the body corporate can email a supplier a
// quote request that genuinely sends from the scheme's configured address
// (rather than opening the user's own mail client).
//
// SETUP: Brevo credentials — see functions/_email-shared.js for the steps
// (BREVO_API_KEY, BREVO_FROM_EMAIL, optional BREVO_FROM_NAME in Netlify env).
// The scheme's own address becomes the display name + reply-to, since Brevo
// only sends from the verified sender address.
//
// The client never sees the API key — it's read server-side from the env.

import { jsonResponse, errorResponse } from "./_passkey-shared.js";
import { sendEmail, emailConfigError, looksLikeEmail as looksLikeEmailShared, bareAddress as bareAddressShared } from "./_email-shared.js";

export const config = { path: "/api/send-email" };

// Very small email-shape check (not exhaustive — Resend does the real
// validation). Keeps obviously-malformed values from being sent.
function looksLikeEmail(s) {
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

// Parse a "from" value that may be either "addr@x.com" or
// "Display Name <addr@x.com>". Returns the bare address for validation.
function bareAddress(from) {
  const m = String(from || "").match(/<([^>]+)>/);
  return (m ? m[1] : String(from || "")).trim();
}

export default async function handler(req) {
  if (req.method !== "POST") return errorResponse(405, "Method not allowed");

  const cfgErr = emailConfigError();
  if (cfgErr) return errorResponse(500, cfgErr);

  let body;
  try {
    body = await req.json();
  } catch (_) {
    return errorResponse(400, "Invalid JSON body");
  }

  const to = (body.to || "").toString().trim();
  const subject = (body.subject || "").toString();
  const text = (body.text || "").toString();
  let from = (body.from || "").toString().trim();
  const fromName = (body.fromName || "").toString().trim();
  const replyTo = (body.replyTo || "").toString().trim();

  // Validate the essentials.
  if (!looksLikeEmail(to)) return errorResponse(400, "A valid recipient email is required.");
  if (!subject) return errorResponse(400, "A subject is required.");
  if (!text) return errorResponse(400, "An email body is required.");

  // Brevo can only send from the verified BREVO_FROM_EMAIL. The scheme's own
  // address (which isn't verified there) becomes the display name and the
  // reply-to, so replies still land in the scheme's real inbox.
  const schemeAddr = bareAddress(from);
  const displayName = fromName || (looksLikeEmail(schemeAddr) ? schemeAddr : "");
  const effectiveReplyTo = looksLikeEmail(bareAddress(replyTo))
    ? bareAddress(replyTo)
    : (looksLikeEmail(schemeAddr) ? schemeAddr : "");

  const result = await sendEmail({
    to: [to],
    subject: subject,
    text: text,
    replyTo: effectiveReplyTo || undefined,
    fromName: displayName || undefined,
  });
  if (!result.ok) {
    console.error("send-email: failed:", result.status, result.msg, "| to:", to);
    return errorResponse(result.status === 400 ? 400 : 502, result.msg);
  }
  return jsonResponse(200, { ok: true, id: result.id });
}
