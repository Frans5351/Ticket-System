// functions/approved-notify.js
// "The trustees have approved this — it is going ahead": an email to the managing agent, sent when a
// ticket reaches the approval threshold and moves to Work In Progress.
//
//   POST /api/approved-notify  { prefix, id, item, agentPeople:[address,…], token, bcInbox }
//     → { ok, sent, to:[names], copied:[names] }
//
// Nothing in the email comes from the request: the ticket, the approved item and the approvers are
// read from the database, and the function only sends when that ticket really is in progress with
// enough approvals on that item. The addresses ticked by the trustee are used only if they are in
// the saved "agent_routing" list (the same rule as the report form), so this cannot be used to send
// mail anywhere else.

import { jsonResponse, errorResponse, getConfig, verifySessionJwt } from "./_passkey-shared.js";
import { sendEmail, emailConfigError, looksLikeEmail, bareAddress } from "./_email-shared.js";
import { ROUTE_DEFAULT, pickPeople, whoLine } from "./_route-shared.js";

export const config = { path: "/api/approved-notify" };

const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwYWdjbXpobG5ndHF2cnlkenZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MTA1OTgsImV4cCI6MjA5NDA4NjU5OH0.TfRrz2iUPFm7AUL55BRNJtyhNl--s8yBbtejcD9yjPU";
const APP_URL = (process.env.APP_BASE_URL || "https://park-manor-bc.netlify.app").replace(/\/$/, "");
const NEED = 3;
const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clean = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u0008\u000b-\u001f]/g, " ").trim().slice(0, n);
const money = (v) => (typeof v === "number" && isFinite(v) ? "R " + v.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "");

async function supa(cfg, path) {
  const key = cfg.supaServiceKey || ANON_KEY;
  const r = await fetch((cfg.supaUrl || "https://spagcmzhlngtqvrydzvi.supabase.co") + path, { headers: { apikey: key, Authorization: "Bearer " + key, Accept: "application/json" } });
  if (!r.ok) throw new Error("Supabase " + r.status);
  return r.json();
}
const one = async (cfg, table, id) => { const rows = await supa(cfg, "/rest/v1/" + table + "?id=eq." + encodeURIComponent(id) + "&select=id,data&limit=1"); return rows && rows[0] ? rows[0].data : null; };

// The approved item, described from the ticket itself.
export async function describeItem(cfg, prefix, t, itemId) {
  if ((t.linkedDocIds || []).map(String).includes(itemId)) {
    const inv = await one(cfg, "invoices", prefix + itemId).catch(() => null);
    if (inv && inv.docType === "Quote") return { kind: "Quote", name: clean(inv.invCompany || inv.name || "Quote", 200), amount: money(Number(inv.amount)), number: clean(inv.invNumber, 60), link: /^https:\/\//i.test(String(inv.url || "")) ? String(inv.url) : "" };
  }
  if (itemId.startsWith("supquote_") && t.quotes && t.quotes[itemId.slice(9)]) { const q = t.quotes[itemId.slice(9)]; return { kind: "Supplier quote", name: clean(q.byName || "Supplier", 200), amount: money(Number(q.amount)), number: "", link: "" }; }
  const c = (Array.isArray(t.criteria) ? t.criteria : []).find((x) => x && x.id === itemId);
  if (c) return { kind: "Proposal", name: clean(c.text, 600), amount: "", number: "", link: "" };
  return null;
}

export default async function handler(req) {
  if (req.method !== "POST") return errorResponse(405, "POST only");
  let b; try { b = await req.json(); } catch (e) { return errorResponse(400, "bad request"); }
  const prefix = String((b && b.prefix) || ""), id = String((b && b.id) || ""), itemId = String((b && b.item) || "");
  if (!/^([\w-]{1,40}:)?$/.test(prefix) || !/^[\w.-]{3,80}$/.test(id) || !/^[\w.-]{3,120}$/.test(itemId)) return errorResponse(400, "bad request");
  const cfg = getConfig();
  if (cfg.jwtSecret) {                                   // a signed-in trustee or admin (a site with no server sessions is as open as the rest of the app)
    const s = verifySessionJwt(cfg, String(b.token || ""));
    if (!s || !["trustee", "admin"].includes(String(s.role || ""))) return errorResponse(401, "Please sign out and sign in again, then retry.");
  }
  const cfgErr = emailConfigError(); if (cfgErr) return errorResponse(503, cfgErr);
  let t, saved;
  try {
    t = await one(cfg, "tickets", prefix + id);
    const rows = await supa(cfg, "/rest/v1/settings?key=eq." + encodeURIComponent(prefix + "agent_routing") + "&select=value&limit=1");
    saved = rows && rows[0] ? rows[0].value : undefined;
  } catch (e) { return errorResponse(502, "Could not load the ticket: " + e.message); }
  if (!t) return errorResponse(404, "No such ticket.");
  const votes = (Array.isArray(t.approvals) ? t.approvals : []).filter((a) => a && a.quoteId === itemId);
  if (String(t.status) !== "work_in_progress" || votes.length < NEED) return errorResponse(409, "That ticket is not approved and in progress, so nothing was sent.");
  const routed = pickPeople(saved !== undefined && saved !== null ? saved : (prefix ? null : ROUTE_DEFAULT), t.category, b.agentPeople);
  if (!routed) return jsonResponse(200, { ok: true, sent: false, reason: "Nobody at the managing agent is listed in Settings." });
  const item = await describeItem(cfg, prefix, t, itemId); if (!item) return errorResponse(404, "That item is not on the ticket.");
  const ref = t.ticketNumber != null ? "#" + t.ticketNumber + " " : "", title = clean(t.title, 200), approvers = votes.map((a) => clean(a.trusteeName || "Trustee", 60)).join(", ");
  const inbox = bareAddress(String(b.bcInbox || "")), cc = routed.cc.map((p) => p.email); if (looksLikeEmail(inbox) && !cc.includes(inbox.toLowerCase())) cc.push(inbox);
  const what = item.name + (item.amount ? " — " + item.amount : "") + (item.number ? " (" + item.number + ")" : "");
  const lines = ["The trustees of Park Manor have approved the following and it is going ahead.", "", `Ticket:      ${ref}${title}`, t.category ? `Category:    ${t.category === "Admin" ? "Admin and billing" : clean(t.category, 60)}` : null, t.unit ? `Unit:        ${clean(t.unit, 30)}` : null, `Approved:    ${item.kind}: ${what}`, `Approved by: ${approvers}`, item.link ? `Quote:       ${item.link}` : null, "", "Details:", clean(t.desc, 1500) || "(none)", "", "The ticket is now In Progress on the Park Manor tracker: " + APP_URL, "", "— Park Manor Body Corporate (automated notification)"].filter((l) => l !== null);
  const row = (k, v) => (v ? `<tr><td style="padding:7px 12px 7px 0;font:12px Arial,Helvetica,sans-serif;color:#8b96a5;white-space:nowrap;vertical-align:top">${k}</td><td style="padding:7px 0;font:bold 13px Arial,Helvetica,sans-serif;color:#3a4354">${v}</td></tr>` : "");
  const html = `<div style="max-width:560px;margin:0 auto;padding:22px 20px;font-family:Arial,Helvetica,sans-serif;color:#3a4354">
    <div style="font-size:12px;color:#177a4c;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">✅ Approved by the trustees — going ahead</div>
    <div style="font-size:19px;font-weight:bold;margin-bottom:16px">${esc(ref + title)}</div>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:14px">${row("Approved", esc(item.kind + ": " + what))}${row("Approved by", esc(approvers))}${row("Category", esc(t.category === "Admin" ? "Admin and billing" : clean(t.category, 60)))}${row("Unit", esc(clean(t.unit, 30)))}${row("Quote", item.link ? `<a href="${esc(item.link)}" style="color:#1b6b45">Open the quote</a>` : "")}</table>
    <div style="font-size:12px;color:#8b96a5;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Details</div>
    <div style="font-size:13px;line-height:1.7;background:#f5f7fa;border:1px solid #e4e9ef;border-radius:9px;padding:14px 16px">${esc(clean(t.desc, 1500) || "(none)").replace(/\n/g, "<br>")}</div>
    <p style="font-size:13px;line-height:1.6">The ticket is now <b>In Progress</b> on the Park Manor tracker. <a href="${APP_URL}" style="color:#1b6b45">Open the tracker</a></p>
    <div style="font-size:11px;color:#8b96a5;margin-top:10px">Sent to ${esc(whoLine(routed.to))}${routed.cc.length ? " — copied: " + esc(routed.cc.map((p) => p.name).join(", ")) : ""}. Park Manor Body Corporate, automated notification.</div></div>`;
  const res = await sendEmail({ to: routed.to.map((p) => p.email), cc: cc.length ? cc : undefined, subject: `✅ Approved — going ahead: ${ref}${title}`.trim(), text: lines.join("\n"), html, replyTo: looksLikeEmail(inbox) ? inbox : undefined });
  if (!res.ok) return errorResponse(502, "The email could not be sent: " + String(res.msg || "failed").slice(0, 160));
  return jsonResponse(200, { ok: true, sent: true, to: routed.to.map((p) => p.name), copied: routed.cc.map((p) => p.name) });
}
