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
  const html = (body.html || "").toString();
  let from = (body.from || "").toString().trim();
  const fromName = (body.fromName || "").toString().trim();
  const replyTo = (body.replyTo || "").toString().trim();
  // Optional CC — accepts a single address or an array. Kept to valid emails.
  const ccRaw = Array.isArray(body.cc) ? body.cc : (body.cc ? [body.cc] : []);
  const cc = ccRaw.map((s) => String(s || "").trim()).filter(looksLikeEmail);
  // Optional attachments: [{ name, content(base64, no data: prefix) }]. Capped
  // to guard the function. Used for PDF invoices/statements.
  const attRaw = Array.isArray(body.attachments) ? body.attachments.slice(0, 10) : [];
  const attachments = [];
  let attBytes = 0;
  for (const a of attRaw) {
    const name = (a && a.name ? String(a.name) : "attachment.pdf").slice(0, 200);
    let content = a && a.content ? String(a.content) : "";
    const comma = content.indexOf(",");
    if (content.slice(0, 5) === "data:" && comma >= 0) content = content.slice(comma + 1); // strip data: prefix
    if (!content) continue;
    if (attBytes + content.length > 30 * 1024 * 1024) continue; // ~30MB cap
    attBytes += content.length;
    attachments.push({ name, content });
  }

  // Validate the essentials.
  if (!looksLikeEmail(to)) return errorResponse(400, "A valid recipient email is required.");
  if (!subject) return errorResponse(400, "A subject is required.");
  if (!text && !html) return errorResponse(400, "An email body is required.");

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
    html: html || undefined,
    cc: cc.length ? cc : undefined,
    attachments: attachments.length ? attachments : undefined,
    replyTo: effectiveReplyTo || undefined,
    fromName: displayName || undefined,
  });
  if (!result.ok) {
    console.error("send-email: failed:", result.status, result.msg, "| to:", to);
    return errorResponse(result.status === 400 ? 400 : 502, result.msg);
  }
  return jsonResponse(200, { ok: true, id: result.id });
}
