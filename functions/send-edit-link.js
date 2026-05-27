// functions/send-edit-link.js
// Emails a resident their personal "edit link" after they submit a ticket via
// the public report form (and opt in to receiving it by email). Mirrors
// send-email.js: same Resend integration, same env vars, same shared helpers.
//
// The client calls POST /api/send-edit-link with:
//   { email, editUrl, editToken, title, ticketNumber }
//
// SETUP REQUIRED (same one-time setup as send-email.js):
//   - RESEND_API_KEY in Netlify environment variables.
//   - A verified sending domain in Resend (else mail sends from
//     onboarding@resend.dev). Optionally EMAIL_FALLBACK_FROM for the from-addr.

import { jsonResponse, errorResponse } from "./_passkey-shared.js";

export const config = { path: "/api/send-edit-link" };

function looksLikeEmail(s) {
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

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

  const to = (body.email || "").toString().trim();
  const editUrl = (body.editUrl || "").toString().trim();
  const title = (body.title || "").toString().trim();
  const ticketNumber = body.ticketNumber;

  if (!looksLikeEmail(to)) return errorResponse(400, "A valid recipient email is required.");
  if (!editUrl) return errorResponse(400, "An edit link is required.");

  // Resolve the from-address the same way send-email.js does.
  const fallbackFrom = (process.env.EMAIL_FALLBACK_FROM || "").trim();
  let from = fallbackFrom;
  if (!looksLikeEmail(bareAddress(from))) {
    from = "onboarding@resend.dev";
  }
  const fromHeader = from.includes("<") ? from : `Park Manor <${from}>`;

  const ref = ticketNumber ? `#${ticketNumber}` : "";
  const subject = `Your Park Manor report ${ref}`.trim();
  const lines = [
    "Hi,",
    "",
    `Thanks for submitting your report${title ? ` "${title}"` : ""}${ref ? ` (${ref})` : ""} to Park Manor.`,
    "",
    "You can view or update your report at any time using your personal link below:",
    editUrl,
    "",
    "Keep this email — anyone with this link can view and edit your report, so please don't share it.",
    "",
    "Park Manor Body Corporate",
  ];
  const text = lines.join("\n");

  const payload = {
    from: fromHeader,
    to: [to],
    subject: subject,
    text: text,
  };

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
    const msg =
      (resendJson && (resendJson.message || resendJson.error)) ||
      `Email service returned status ${resendRes.status}.`;
    return errorResponse(resendRes.status === 422 ? 422 : 502, String(msg));
  }

  return jsonResponse(200, { ok: true, id: resendJson && resendJson.id });
}
