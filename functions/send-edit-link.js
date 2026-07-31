// functions/send-edit-link.js
// Handles emails triggered by a public report submission:
//   1. The resident's personal "edit link" email (if they opted in and gave
//      an address).
//   2. A notification to the managing agent that a new report was submitted
//      (fires on EVERY submission, with or without a resident email).
//
// The client calls POST /api/send-edit-link with:
//   { email?, editUrl?, editToken?, title, ticketNumber,
//     desc?, unit?, reporter?, phone?, notifyOnly? }
// When notifyOnly is true (resident did not request an emailed link), only
// the agent notification is sent.
//
// SETUP (same one-time setup as send-email.js):
//   - RESEND_API_KEY        Netlify env var (required for any sending)
//   - EMAIL_FALLBACK_FROM   optional verified from-address
//   - AGENT_NOTIFY_EMAIL    the managing agent's address(es) to notify on new
//                           public reports. Comma-separate multiple addresses.
//                           Kept server-side so the public form cannot be
//                           abused to email arbitrary recipients.

import { jsonResponse, errorResponse, getConfig, supaFetch } from "./_passkey-shared.js";

export const config = { path: "/api/send-edit-link" };

function looksLikeEmail(s) {
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function bareAddress(from) {
  const m = String(from || "").match(/<([^>]+)>/);
  return (m ? m[1] : String(from || "")).trim();
}

async function sendViaResend(apiKey, payload) {
  let res, json;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    json = await res.json().catch(() => ({}));
  } catch (e) {
    return { ok: false, status: 502, msg: "Could not reach the email service." };
  }
  if (!res.ok) {
    const msg =
      (json && (json.message || json.error)) ||
      `Email service returned status ${res.status}.`;
    return { ok: false, status: res.status, msg: String(msg) };
  }
  return { ok: true, id: json && json.id };
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
  const title = (body.title || "").toString().trim().slice(0, 300);
  const desc = (body.desc || "").toString().trim().slice(0, 4000);
  const unit = (body.unit || "").toString().trim().slice(0, 50);
  const reporter = (body.reporter || "").toString().trim().slice(0, 200);
  const phone = (body.phone || "").toString().trim().slice(0, 50);
  const ticketNumber = body.ticketNumber;
  const notifyOnly = !!body.notifyOnly;

  // Media attachments for the agent email. Each: { name, type, dataUrl } or
  // { name, type, skipped:true, sizeMB } when the client couldn't fit it in
  // the request. Hard caps here guard the function against abuse.
  const rawAtt = Array.isArray(body.attachments) ? body.attachments.slice(0, 10) : [];
  const emailAttachments = [];
  const skippedFiles = [];
  let attBytes = 0;
  for (const a of rawAtt) {
    const name = (a && a.name ? String(a.name) : "attachment").slice(0, 200);
    if (a && a.skipped) {
      skippedFiles.push({ name, sizeMB: String(a.sizeMB || "?").slice(0, 10) });
      continue;
    }
    const dataUrl = a && a.dataUrl ? String(a.dataUrl) : "";
    const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
    if (!m) continue;
    const content = m[2];
    if (attBytes + content.length > 30 * 1024 * 1024) { // Resend total cap ~40MB
      skippedFiles.push({ name, sizeMB: (content.length * 0.75 / 1048576).toFixed(1) });
      continue;
    }
    attBytes += content.length;
    emailAttachments.push({ filename: name, content });
  }

  if (!notifyOnly) {
    if (!looksLikeEmail(to)) return errorResponse(400, "A valid recipient email is required.");
    if (!editUrl) return errorResponse(400, "An edit link is required.");
  }

  // Resolve the from-address the same way send-email.js does.
  const fallbackFrom = (process.env.EMAIL_FALLBACK_FROM || "").trim();
  let from = fallbackFrom;
  if (!looksLikeEmail(bareAddress(from))) {
    from = "onboarding@resend.dev";
  }
  const fromHeader = from.includes("<") ? from : `Park Manor <${from}>`;
  const ref = ticketNumber ? `#${ticketNumber}` : "";

  // ── 1) Resident edit-link email (only when requested) ────────────────────
  let residentResult = null;
  if (!notifyOnly) {
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
    residentResult = await sendViaResend(apiKey, {
      from: fromHeader,
      to: [to],
      subject: subject,
      text: lines.join("\n"),
    });
    if (!residentResult.ok) {
      // The resident email is the primary purpose of a non-notifyOnly call —
      // surface the failure. Still attempt the agent notification below.
      // (Fall through; the final response reports both outcomes.)
    }
  }

  // ── 2) Managing-agent notification (every submission) ────────────────────
  // The agent address lives server-side only (AGENT_NOTIFY_EMAIL), so the
  // public form cannot direct mail to arbitrary recipients.
  let agentResult = null;
  // Recipients come from TWO sources, merged and de-duplicated:
  //   1. Users in the app with role "management" that have an email assigned
  //      (managed in the Users tab — no Netlify access needed).
  //   2. The AGENT_NOTIFY_EMAIL env var (comma-separated), kept as a
  //      fallback / extra so the feature works before any user has an email.
  const agentSet = new Set();
  try {
    const cfg = getConfig();
    if (cfg.supaServiceKey) {
      const rows = await supaFetch(cfg, "/rest/v1/users?select=id,data");
      (Array.isArray(rows) ? rows : []).forEach((r) => {
        const u = r && r.data ? r.data : r;
        if (u && u.role === "management" && looksLikeEmail(u.email)) {
          agentSet.add(u.email.trim().toLowerCase());
        }
      });
    }
  } catch (e) {
    console.warn("send-edit-link: could not read management users:", e.message);
  }
  (process.env.AGENT_NOTIFY_EMAIL || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => looksLikeEmail(bareAddress(s)))
    .forEach((s) => agentSet.add(bareAddress(s).toLowerCase()));
  const agentList = Array.from(agentSet);
  if (agentList.length) {
    const aSubject = `New Park Manor report ${ref}${title ? ` — ${title}` : ""}`.trim();
    const aLines = [
      "A new report was submitted via the Park Manor public report form.",
      "",
      `Reference:  ${ref || "(no number)"}`,
      `Subject:    ${title || "(none)"}`,
      unit ? `Unit:       ${unit}` : null,
      reporter ? `Name:       ${reporter}` : null,
      phone ? `Phone:      ${phone}` : null,
      looksLikeEmail(to) ? `Email:      ${to}` : null,
      "",
      "Details:",
      desc || "(none provided)",
      "",
      emailAttachments.length
        ? `${emailAttachments.length} file${emailAttachments.length === 1 ? "" : "s"} attached to this email.`
        : null,
      skippedFiles.length
        ? "Too large to attach (view in the tracker): " +
          skippedFiles.map((s) => `${s.name} (${s.sizeMB} MB)`).join(", ")
        : null,
      "",
      "Log in to the Park Manor tracker to view and action this report.",
      "",
      "— Park Manor Body Corporate (automated notification)",
    ].filter((l) => l !== null);
    const aPayload = {
      from: fromHeader,
      to: agentList,
      subject: aSubject,
      text: aLines.join("\n"),
    };
    // Let the agent reply straight to the resident when we have their address.
    if (looksLikeEmail(to)) aPayload.reply_to = to;
    if (emailAttachments.length) aPayload.attachments = emailAttachments;
    agentResult = await sendViaResend(apiKey, aPayload);
  }

  // ── Response ─────────────────────────────────────────────────────────────
  if (!notifyOnly && residentResult && !residentResult.ok) {
    return errorResponse(residentResult.status === 422 ? 422 : 502, residentResult.msg);
  }
  return jsonResponse(200, {
    ok: true,
    id: residentResult && residentResult.id,
    agentNotified: !!(agentResult && agentResult.ok),
  });
}
