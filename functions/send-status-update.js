// functions/send-status-update.js
// Emails the reporter when their ticket's status changes. Called
// fire-and-forget from the app on every real status transition — only when
// the ticket has a reporter email. Reporters without an email track progress
// through their personal ?reportEdit link instead.
//
// Body: { email, ticketNumber, title, statusKey, statusLabel, editUrl? }
// Email transport + setup: see functions/_email-shared.js (Brevo).

import { jsonResponse, errorResponse } from "./_passkey-shared.js";
import { sendEmail, emailConfigError, looksLikeEmail } from "./_email-shared.js";

export const config = { path: "/api/send-status-update" };

const APP_URL = (process.env.APP_BASE_URL || "https://park-manor-bc.netlify.app").replace(/\/$/, "");

function escH(v) {
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Per-status colour + plain-language explanation for residents.
const STATUS_META = {
  open: { color: "#9a6200", bg: "#faf3e3", note: "Your report is logged and waiting for the trustees to review it." },
  awaiting_quote: { color: "#9a6200", bg: "#faf3e3", note: "We\u2019re obtaining quotes from suppliers for this work." },
  awaiting_trustee_approval: { color: "#7a3fbf", bg: "#f3ecfb", note: "Quotes are in \u2014 the trustees are reviewing them for approval." },
  work_in_progress: { color: "#5b54c7", bg: "#eeedf9", note: "Good news \u2014 work on this is now underway." },
  closed: { color: "#177a4c", bg: "#e9f5ef", note: "This report has been resolved and closed. Thank you for reporting it!" },
};

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
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#8b96a5;line-height:1.5">Automated update from the Park Manor reporting system \u00b7 17 Echium Road, Table View</div>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

export default async function handler(req) {
  if (req.method !== "POST") return errorResponse(405, "Method not allowed");
  const cfgErr = emailConfigError();
  if (cfgErr) return errorResponse(500, cfgErr);

  let body;
  try { body = await req.json(); } catch (_) { return errorResponse(400, "Invalid JSON body"); }

  const email = String(body.email || "").trim();
  if (!looksLikeEmail(email)) return errorResponse(400, "A valid email is required");
  const ticketNumber = String(body.ticketNumber || "").slice(0, 20);
  const title = String(body.title || "").trim().slice(0, 300);
  const statusKey = String(body.statusKey || "").slice(0, 60);
  const statusLabel = String(body.statusLabel || statusKey || "Updated").slice(0, 80);
  const editUrl = String(body.editUrl || "").trim().slice(0, 500);

  const meta = STATUS_META[statusKey] || { color: "#3a4354", bg: "#f5f7fa", note: "" };
  const ref = ticketNumber ? `#${ticketNumber}` : "";
  const link = editUrl || APP_URL;

  const html = shell(`
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#8b96a5;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Update on your report${ref ? " \u00b7 " + escH(ref) : ""}</div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:bold;color:#3a4354;margin-bottom:16px">${escH(title || "Your report")}</div>
    <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:99px;background:${meta.bg};border:1px solid ${meta.color}">
      <span style="display:inline-block;padding:7px 18px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:${meta.color}">${escH(statusLabel)}</span>
    </td></tr></table>
    ${meta.note ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#5c6675;line-height:1.6;margin-top:14px">${meta.note}</div>` : ""}
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 6px"><tr>
      <td style="border-radius:9px;background:#1fa898">
        <a href="${escH(link)}" target="_blank" style="display:inline-block;padding:13px 26px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none">${editUrl ? "View my report" : "Open Park Manor"}</a>
      </td></tr></table>
    ${editUrl ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#8b96a5;margin-top:6px">This is your personal link \u2014 please don\u2019t share it.</div>` : ""}
  `);
  const text = `Update on your Park Manor report ${ref}\n\n${title}\nNew status: ${statusLabel}\n${meta.note || ""}\n\n${editUrl ? "View or update it: " + editUrl : "Park Manor: " + APP_URL}`;

  const r = await sendEmail({
    to: [email],
    subject: `Your Park Manor report ${ref}: ${statusLabel}`.trim(),
    text,
    html,
  });
  if (!r.ok) {
    console.error("send-status-update failed:", r.status, r.msg, "| to:", email, "| ticket:", ref);
    return errorResponse(502, r.msg);
  }
  console.log("send-status-update: sent", ref, "->", statusLabel, "to", email);
  return jsonResponse(200, { ok: true, id: r.id });
}
