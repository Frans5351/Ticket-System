// functions/send-email.js
// Sends an email via Resend (https://resend.com). Used by the supplier
// "Email quote request" button so the body corporate can email a supplier a
// quote request that genuinely sends from the scheme's configured address
// (rather than opening the user's own mail client).
//
// SETUP REQUIRED (one-time, by the site owner):
//   1. Create a free account at https://resend.com
//   2. Add + verify the sending domain (e.g. parkmanor.co.za) under
//      Resend → Domains. This means adding the DNS records Resend shows you.
//      Until a domain is verified you can only send from onboarding@resend.dev.
//   3. Create an API key under Resend → API Keys.
//   4. In Netlify → Site settings → Environment variables, add:
//        RESEND_API_KEY      = the key from step 3
//        (optional) EMAIL_FALLBACK_FROM = a verified from-address to use when
//        the requested scheme address isn't on a verified domain. If unset,
//        the function will attempt the scheme address as-is.
//
// The client never sees the API key — it's read server-side from the env.

import { jsonResponse, errorResponse } from "./_passkey-shared.js";

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

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return errorResponse(
      500,
      "Email sending isn't configured yet. Add RESEND_API_KEY in Netlify environment variables."
    );
  }

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

  // Resolve the from-address. Prefer the supplied scheme address; if it's
  // missing/invalid, fall back to a configured verified address, else to
  // Resend's onboarding sender (works without domain verification, but the
  // recipient sees onboarding@resend.dev).
  const fallbackFrom = (process.env.EMAIL_FALLBACK_FROM || "").trim();
  if (!looksLikeEmail(bareAddress(from))) {
    from = looksLikeEmail(bareAddress(fallbackFrom)) ? fallbackFrom : "onboarding@resend.dev";
  }
  // Wrap with a display name if one was provided and the value is a bare addr.
  const fromHeader =
    fromName && !from.includes("<") ? `${fromName} <${from}>` : from;

  const payload = {
    from: fromHeader,
    to: [to],
    subject: subject,
    text: text,
  };
  if (looksLikeEmail(bareAddress(replyTo))) {
    payload.reply_to = replyTo;
  }

  let resendRes, resendJson;
  try {
    resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    resendJson = await resendRes.json().catch(() => ({}));
  } catch (e) {
    return errorResponse(502, "Could not reach the email service. Try again later.");
  }

  if (!resendRes.ok) {
    // Surface Resend's message so the user understands (e.g. "domain not
    // verified" or "from address not allowed").
    const msg =
      (resendJson && (resendJson.message || resendJson.error)) ||
      `Email service returned status ${resendRes.status}.`;
    return errorResponse(resendRes.status === 422 ? 422 : 502, String(msg));
  }

  return jsonResponse(200, { ok: true, id: resendJson && resendJson.id });
}
