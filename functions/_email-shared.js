// functions/_email-shared.js
// Central email sender, now backed by Brevo (https://www.brevo.com).
//
// WHY BREVO: the free plan (300 emails/day, free forever) lets you verify a
// single sender ADDRESS by clicking a confirmation email — no domain
// ownership needed — and then delivers to any recipient. Resend's free tier
// only delivers to the account owner until a domain is verified, which is
// why emails silently failed before.
//
// SETUP (one-time, by the site owner):
//   1. Create a free account at https://www.brevo.com
//   2. Verify a sender: Brevo → Senders, Domains & Dedicated IPs → Senders
//      → Add a sender → confirm via the email Brevo sends to that address.
//      (e.g. a parkmanorbc@gmail.com you control)
//   3. Create an API key: Brevo → profile menu → SMTP & API → API Keys
//      → Generate a new API key.
//   4. Netlify → Site settings → Environment variables:
//        BREVO_API_KEY    = the key from step 3            (required)
//        BREVO_FROM_EMAIL = the verified sender address    (required)
//        BREVO_FROM_NAME  = display name, e.g. Park Manor  (optional)
//      Then redeploy — functions read env at deploy time.
//
// The API key is only ever read server-side.

export function looksLikeEmail(s) {
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

export function bareAddress(from) {
  const m = String(from || "").match(/<([^>]+)>/);
  return (m ? m[1] : String(from || "")).trim();
}

export function emailConfigError() {
  if (!process.env.BREVO_API_KEY) {
    return "Email sending isn't configured yet. Add BREVO_API_KEY in Netlify environment variables (see functions/_email-shared.js for setup steps).";
  }
  if (!looksLikeEmail(process.env.BREVO_FROM_EMAIL || "")) {
    return "BREVO_FROM_EMAIL is missing or invalid in Netlify environment variables. Set it to the sender address you verified in Brevo.";
  }
  return null;
}

// Send one email via Brevo's transactional API.
//   opts = {
//     to:          array of recipient addresses (strings)   (required)
//     subject:     string                                    (required)
//     text:        plain-text body                           (required)
//     replyTo:     address string                            (optional)
//     attachments: [{ name, content(base64, no data: prefix) }] (optional)
//     fromName:    display-name override for this send       (optional)
//   }
// Returns { ok, id } or { ok:false, status, msg }.
export async function sendEmail(opts) {
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = (process.env.BREVO_FROM_EMAIL || "").trim();
  const fromName = (opts.fromName || process.env.BREVO_FROM_NAME || "Park Manor").trim();

  const payload = {
    sender: { email: fromEmail, name: fromName },
    to: (opts.to || []).filter(looksLikeEmail).map((e) => ({ email: e.trim() })),
    subject: String(opts.subject || ""),
    textContent: String(opts.text || ""),
  };
  if (!payload.to.length) return { ok: false, status: 400, msg: "No valid recipients." };
  if (opts.replyTo && looksLikeEmail(bareAddress(opts.replyTo))) {
    payload.replyTo = { email: bareAddress(opts.replyTo) };
  }
  if (Array.isArray(opts.attachments) && opts.attachments.length) {
    payload.attachment = opts.attachments
      .filter((a) => a && a.name && a.content)
      .map((a) => ({ name: String(a.name).slice(0, 200), content: String(a.content) }));
    if (!payload.attachment.length) delete payload.attachment;
  }

  let res, json;
  try {
    res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
    json = await res.json().catch(() => ({}));
  } catch (e) {
    return { ok: false, status: 502, msg: "Could not reach the email service. Try again later." };
  }
  if (!res.ok) {
    const msg =
      (json && (json.message || (json.error && json.error.message) || json.code)) ||
      `Email service returned status ${res.status}.`;
    return { ok: false, status: res.status, msg: String(msg) };
  }
  return { ok: true, id: json && json.messageId };
}
