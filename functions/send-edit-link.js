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
// SETUP: Brevo credentials — see functions/_email-shared.js. Plus:
//   - AGENT_NOTIFY_EMAIL    extra agent address(es) to notify on new
//                           public reports. Comma-separate multiple addresses.
//                           Kept server-side so the public form cannot be
//                           abused to email arbitrary recipients.

import { jsonResponse, errorResponse, getConfig, supaFetch } from "./_passkey-shared.js";
import { sendEmail, emailConfigError } from "./_email-shared.js";

export const config = { path: "/api/send-edit-link" };

function looksLikeEmail(s) {
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function bareAddress(from) {
  const m = String(from || "").match(/<([^>]+)>/);
  return (m ? m[1] : String(from || "")).trim();
}


// ── Branded HTML email scaffolding ──────────────────────────────────────
const APP_URL = (process.env.APP_BASE_URL || "https://park-manor-bc.netlify.app").replace(/\/$/, "");

function escH(v) {
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function emailShell(bodyHtml) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#eef1f5">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f5;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:14px;border:1px solid #e4e9ef;overflow:hidden">
        <tr><td style="padding:22px 28px;border-bottom:3px solid #1fa898">
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:bold;color:#3a4354;letter-spacing:2px">PARK MANOR</div>
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#1fa898;font-weight:bold">Body Corporate</div>
        </td></tr>
        <tr><td style="padding:26px 28px">${bodyHtml}</td></tr>
        <tr><td style="padding:16px 28px;background:#f5f7fa;border-top:1px solid #e4e9ef">
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#8b96a5;line-height:1.5">Automated notification from the Park Manor reporting system \u00b7 17 Echium Road, Table View</div>
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

function emailButton(href, label, color) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 6px"><tr>
    <td style="border-radius:9px;background:${color || "#1fa898"}">
      <a href="${escH(href)}" target="_blank" style="display:inline-block;padding:13px 26px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none">${label}</a>
    </td></tr></table>`;
}

function detailRow(label, value) {
  if (!value) return "";
  return `<tr>
    <td style="padding:7px 12px 7px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#8b96a5;white-space:nowrap;vertical-align:top">${label}</td>
    <td style="padding:7px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#3a4354;font-weight:bold">${escH(value)}</td>
  </tr>`;
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
    const residentHtml = emailShell(`
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:bold;color:#3a4354;margin-bottom:6px">Thanks \u2014 we\u2019ve received your report${ref ? " " + escH(ref) : ""}</div>
      ${title ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1fa898;font-weight:bold;margin-bottom:14px">${escH(title)}</div>` : ""}
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#5c6675;line-height:1.6;margin-bottom:4px">The trustees will review it as soon as possible. Use your personal button below at any time to view what you sent, add details, or check progress.</div>
      ${emailButton(editUrl, "View or update my report")}
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#8b96a5;line-height:1.6;margin-top:14px;padding:10px 12px;background:#fdf6ea;border-left:3px solid #9a6200;border-radius:4px"><b>Keep this email.</b> Anyone with this link can view and edit your report, so please don\u2019t share it.</div>
    `);
    residentResult = await sendEmail({
      to: [to],
      subject: subject,
      text: lines.join("\n"),
      html: residentHtml,
    });
    if (!residentResult.ok) {
      console.error("send-edit-link: RESIDENT email failed:", residentResult.status, residentResult.msg, "| to:", to);
    }
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
    // Prefer the service-role key when configured; otherwise fall back to the
    // public anon key (the same one the client uses to read users — its RLS
    // already permits this read, and the key is public by design).
    const cfg = getConfig();
    const supaUrl = cfg.supaUrl || "https://spagcmzhlngtqvrydzvi.supabase.co";
    const supaKey = cfg.supaServiceKey ||
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwYWdjbXpobG5ndHF2cnlkenZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MTA1OTgsImV4cCI6MjA5NDA4NjU5OH0.TfRrz2iUPFm7AUL55BRNJtyhNl--s8yBbtejcD9yjPU";
    const res = await fetch(supaUrl + "/rest/v1/users?select=id,data", {
      headers: { apikey: supaKey, Authorization: "Bearer " + supaKey, Accept: "application/json" },
    });
    const rows = res.ok ? await res.json() : [];
    if (!res.ok) console.warn("send-edit-link: users query returned", res.status);
    let mgmtSeen = 0;
    (Array.isArray(rows) ? rows : []).forEach((r) => {
      const u = r && r.data ? r.data : r;
      if (u && u.role === "management") {
        mgmtSeen++;
        if (looksLikeEmail(u.email)) agentSet.add(u.email.trim().toLowerCase());
      }
    });
    console.log("send-edit-link: management users found:", mgmtSeen, "| with email:", agentSet.size,
      "| via", cfg.supaServiceKey ? "service key" : "anon key");
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
    const attNote = emailAttachments.length
      ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#177a4c;margin-top:12px">\ud83d\udcce ${emailAttachments.length} file${emailAttachments.length === 1 ? "" : "s"} attached to this email.</div>`
      : "";
    const skipNote = skippedFiles.length
      ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9a6200;margin-top:6px">\u26a0 Too large to attach (view in the tracker): ${skippedFiles.map((x) => escH(x.name) + " (" + escH(x.sizeMB) + " MB)").join(", ")}</div>`
      : "";
    const agentHtml = emailShell(`
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#8b96a5;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">New public report${ref ? " \u00b7 " + escH(ref) : ""}</div>
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:19px;font-weight:bold;color:#3a4354;margin-bottom:16px">${escH(title || "(no subject)")}</div>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:14px">
        ${detailRow("Reference", ref)}
        ${detailRow("Unit", unit)}
        ${detailRow("Name", reporter)}
        ${detailRow("Phone", phone)}
        ${detailRow("Email", looksLikeEmail(to) ? to : "")}
      </table>
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#8b96a5;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Details</div>
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#3a4354;line-height:1.7;background:#f5f7fa;border:1px solid #e4e9ef;border-radius:9px;padding:14px 16px">${escH(desc || "(none provided)").replace(/\n/g, "<br>")}</div>
      ${attNote}${skipNote}
      ${emailButton(APP_URL, "Open the Park Manor Tracker")}
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#8b96a5;margin-top:6px">${looksLikeEmail(to) ? "Replying to this email goes directly to the resident." : ""}</div>
    `);
    agentResult = await sendEmail({
      to: agentList,
      subject: aSubject,
      text: aLines.join("\n"),
      html: agentHtml,
      // Let the agent reply straight to the resident when we have their address.
      replyTo: looksLikeEmail(to) ? to : undefined,
      attachments: emailAttachments.map((a) => ({ name: a.filename, content: a.content })),
    });
    if (!agentResult.ok) {
      console.error("send-edit-link: AGENT notification failed:", agentResult.status, agentResult.msg,
        "| recipients:", agentList.join(","), "| attachments:", emailAttachments.length);
    } else {
      console.log("send-edit-link: agent notified:", agentList.join(","), "id:", agentResult.id);
    }
  } else {
    console.warn("send-edit-link: no agent recipients (no management users with email; AGENT_NOTIFY_EMAIL unset)");
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
