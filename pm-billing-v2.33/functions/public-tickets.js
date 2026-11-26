// functions/public-tickets.js
// The "current issues" list on the public report page (?report), and what a
// resident may do there without logging in.
//
//   GET  /api/public-tickets?prefix=          → the public tickets, sanitised
//   POST /api/public-tickets {action, id, …}  → add an update / report it fixed
//   GET  /api/public-tickets?prefix=&photo=<ticket>&p=<photo>&size=thumb|full
//                                             → one photo a trustee has approved
//
// A ticket is on the list when it is PUBLIC — it was logged through the report
// form, or a trustee ticked "Visible to everyone" on it — and it is still open,
// or was closed in the last 14 days (so people can see it was dealt with).
//
// What leaves this function: number, title, category, unit, status, dates, the
// description, the public updates, the "expected by" date a trustee set, and
// the photos a trustee has ticked for the report page (ticket.publicPhotos —
// nothing is shown until a trustee ticks it; ticket.afterPhotos marks the ones
// of the finished job). NEVER the reporter's name, phone or email, the internal
// log, quotes, documents, or any photo that was not ticked.
//
// Public updates are kept apart from the ticket itself, in settings rows keyed
// "tpub:<ticket row id>" = { updates:[{ts,text,by,role}], fixed:{at,by,text}|null },
// so a trustee saving the ticket in the tracker can never overwrite a
// resident's update (and the other way round).
//
// Residents can: add an update, and say "this has been fixed" — which flags the
// ticket for a trustee to confirm by closing it. They cannot close it.
// Trustees / admin / managing agent (signed in) can: reply publicly ("reply")
// and clear a wrong "fixed" flag ("notfixed").
//
// "Me too": a resident taps once to say they have the same problem, instead of
// logging it again ("metoo"; "unmetoo" takes it back). Kept in the same tpub
// row as metoo:[{d,ts,unit}] — d is a random id the page keeps on that phone so
// one phone counts once. Everyone sees only the COUNT; the units (when the
// phone remembers one from a meter reading) go to signed-in trustees only.

import { jsonResponse, errorResponse, getConfig, verifySessionJwt } from "./_passkey-shared.js";
import { sendEmail, emailConfigError } from "./_email-shared.js";

export const config = { path: "/api/public-tickets" };

const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwYWdjbXpobG5ndHF2cnlkenZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MTA1OTgsImV4cCI6MjA5NDA4NjU5OH0.TfRrz2iUPFm7AUL55BRNJtyhNl--s8yBbtejcD9yjPU";
const KEEP_CLOSED_DAYS = 14;
const MAX_UPDATES = 40;          // per ticket
const MIN_GAP_MS = 15 * 1000;    // between public updates on one ticket
const MAX_METOO = 60;            // per ticket
const MAX_PHOTOS = 6;            // per ticket, on the public list
const PHOTO_ID = /^[\w.-]{3,80}$/;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];   // never SVG or HTML
const STATUS_LABEL = { open: "Open", awaiting_quote: "Obtaining quotes", awaiting_trustee_approval: "Awaiting trustee approval", work_in_progress: "Work in progress", closed: "Closed" };
const HIDDEN_CATEGORIES = ["Water Reading", "Electricity Reading"];

async function supa(cfg, path, init = {}) {
  const key = cfg.supaServiceKey || ANON_KEY;
  const r = await fetch(cfg.supaUrl + path, { ...init, headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json", ...(init.headers || {}) } });
  if (!r.ok) throw new Error("Supabase " + r.status + ": " + (await r.text()).slice(0, 200));
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}
const normStatus = (s) => (s === "resolved" ? "closed" : s === "in_progress" || !STATUS_LABEL[s] ? "open" : s);
const validPrefix = (p) => /^([\w-]{1,40}:)?$/.test(p);
const inScheme = (id, prefix) => (prefix ? id.startsWith(prefix) : !id.includes(":"));
const clean = (s, max) => String(s == null ? "" : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, max);
const looksLikeEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || "").trim());

function isPublic(d) {
  if (!d || (d.type && d.type !== "maintenance") || d.parentId) return false;       // not action items / sub-tickets
  if (d.deleted || d.archived || HIDDEN_CATEGORIES.includes(d.category)) return false;
  return d.public === true || (d.public !== false && d.createdViaPublicForm === true);
}
function closedAt(d) { return (d.dateClosed ? Date.parse(d.dateClosed) : 0) || Number(d.updated) || Number(d.added) || 0; }
function onList(d, now) {
  if (!isPublic(d)) return false;
  return normStatus(d.status) !== "closed" || now - closedAt(d) <= KEEP_CLOSED_DAYS * 86400000;
}
// The photos a trustee ticked, limited to ones still attached to the ticket.
function publicPhotoIds(d) {
  const linked = Array.isArray(d.linkedDocIds) ? d.linkedDocIds.map(String) : [];
  return [...new Set((Array.isArray(d.publicPhotos) ? d.publicPhotos : []).map(String))].filter((x) => PHOTO_ID.test(x) && linked.includes(x)).slice(0, MAX_PHOTOS);
}
const validDay = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) && !isNaN(Date.parse(v + "T00:00:00Z")) ? String(v) : "");
function shape(id, prefix, d, pub, staffView) {
  const status = normStatus(d.status), p = pub || {};
  const metoo = (Array.isArray(p.metoo) ? p.metoo : []).filter((m) => m && m.d);
  const out = {
    id: prefix ? id.slice(prefix.length) : id,
    number: d.ticketNumber == null ? null : d.ticketNumber,
    title: clean(d.title, 200), category: clean(d.category, 60), unit: clean(d.unit, 30),
    status, statusLabel: STATUS_LABEL[status], urgent: d.priority === "urgent" && status !== "closed",
    logged: Number(d.added) || (d.dateOpen ? Date.parse(d.dateOpen) : 0) || 0,
    closed: status === "closed" ? closedAt(d) : 0,
    desc: clean(d.desc, 1200),
    fixed: status !== "closed" && p.fixed ? { at: Number(p.fixed.at) || 0, by: clean(p.fixed.by, 60) } : null,
    updates: (Array.isArray(p.updates) ? p.updates : []).slice(-MAX_UPDATES).map((u) => ({ ts: Number(u.ts) || 0, text: clean(u.text, 600), by: clean(u.by, 60), role: u.role === "trustee" ? "trustee" : "resident", kind: u.kind === "fixed" || u.kind === "notfixed" ? u.kind : "" })),
    metoo: metoo.length,
    expected: status === "closed" ? "" : validDay(d.expectedBy),
    photos: (() => { const after = (Array.isArray(d.afterPhotos) ? d.afterPhotos : []).map(String); return publicPhotoIds(d).map((x) => ({ id: x, after: after.includes(x) })); })(),
  };
  if (staffView) out.metooUnits = [...new Set(metoo.map((m) => cleanUnit(m.unit)).filter(Boolean))];
  return out;
}
const cleanUnit = (u) => { const s = clean(u, 12); return /^[\w ]{1,12}$/.test(s) ? s : ""; };
// Signed-in trustee / admin / managing agent, proven by a real session token (never "open" just because the site has no sessions).
function isStaffView(cfg, token) {
  if (!cfg.jwtSecret || !token) return false;
  const s = verifySessionJwt(cfg, String(token));
  return !!s && ["admin", "trustee", "management"].includes(String(s.role || ""));
}
async function loadPub(cfg, rowId) {
  const rows = await supa(cfg, "/rest/v1/settings?key=eq." + encodeURIComponent("tpub:" + rowId) + "&select=value&limit=1");
  let v = rows && rows[0] ? rows[0].value : null;
  if (typeof v === "string") { try { v = JSON.parse(v); } catch (e) { v = null; } }
  return v && typeof v === "object" ? v : { updates: [], fixed: null };
}
async function savePub(cfg, rowId, value) {
  await supa(cfg, "/rest/v1/settings?on_conflict=key", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ key: "tpub:" + rowId, value }) });
}
function staff(cfg, token) {
  if (!cfg.jwtSecret) return { ok: true, name: "" };                 // site has no server sessions — same openness as the rest of the app
  const s = verifySessionJwt(cfg, String(token || ""));
  if (!s) return { ok: false, error: "Please sign out and sign in again, then retry." };
  if (!["admin", "trustee", "management"].includes(String(s.role || ""))) return { ok: false, error: "Not allowed for this user." };
  return { ok: true, name: clean(s.name || s.username, 60) };
}

async function list(cfg, prefix, staffView) {
  const [tickets, pubs] = await Promise.all([
    supa(cfg, "/rest/v1/tickets?select=id,data"),
    supa(cfg, "/rest/v1/settings?key=like." + encodeURIComponent("tpub:*") + "&select=key,value"),
  ]);
  const pubBy = {};
  (pubs || []).forEach((r) => { let v = r.value; if (typeof v === "string") { try { v = JSON.parse(v); } catch (e) { v = null; } } if (v) pubBy[String(r.key).slice(5)] = v; });
  const now = Date.now();
  const out = (tickets || []).filter((r) => r && r.data && inScheme(String(r.id), prefix) && onList(r.data, now)).map((r) => shape(String(r.id), prefix, r.data, pubBy[r.id], staffView));
  out.sort((a, b) => (a.status === "closed") - (b.status === "closed") || (b.urgent - a.urgent) || (a.status === "closed" ? b.closed - a.closed : b.logged - a.logged));
  return jsonResponse(200, { ok: true, keepClosedDays: KEEP_CLOSED_DAYS, tickets: out });
}

// One approved photo. The ticket must be on the public list and the photo ticked by a trustee;
// only real image types are served (decoded from the stored copy, or handed over to the
// project's own public storage bucket).
function fromDataUrl(v) {
  const m = /^data:([\w/+.-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(String(v || ""));
  if (!m || !IMAGE_TYPES.includes(m[1].toLowerCase())) return null;
  return { type: m[1].toLowerCase(), bytes: Buffer.from(m[2], "base64") };
}
const imageResponse = (img) => new Response(img.bytes, { status: 200, headers: { "Content-Type": img.type, "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline" } });
const noPhoto = () => new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
async function servePhoto(cfg, prefix, ticketId, photoId, size) {
  if (!/^[\w.-]{3,80}$/.test(ticketId) || !PHOTO_ID.test(photoId)) return noPhoto();
  const rowId = prefix + ticketId;
  const rows = await supa(cfg, "/rest/v1/tickets?id=eq." + encodeURIComponent(rowId) + "&select=id,data&limit=1");
  const d = rows && rows[0] && rows[0].data;
  if (!d || !onList(d, Date.now()) || !publicPhotoIds(d).includes(photoId)) return noPhoto();
  const invRow = encodeURIComponent(prefix + photoId);
  // the small fields first — the full picture can be megabytes
  const meta = await supa(cfg, "/rest/v1/invoices?id=eq." + invRow + "&select=id,thumb:data->>thumb,type:data->>type,url:data->>url&limit=1");
  const m = meta && meta[0];
  if (!m) return noPhoto();
  if (size === "thumb") { const t = fromDataUrl(m.thumb); if (t) return imageResponse(t); }
  const type = String(m.type || "").toLowerCase();
  if (m.url && IMAGE_TYPES.includes(type) && String(m.url).startsWith(String(cfg.supaUrl).replace(/\/+$/, "") + "/storage/v1/object/public/")) {
    return new Response(null, { status: 302, headers: { Location: m.url, "Cache-Control": "public, max-age=3600" } });
  }
  const full = await supa(cfg, "/rest/v1/invoices?id=eq." + invRow + "&select=d:data->>data&limit=1");
  let img = fromDataUrl(full && full[0] && full[0].d);
  if (!img) {                                                     // oldest uploads: the file sits in its own table
    try { const old = await supa(cfg, "/rest/v1/invoice_files?id=eq." + invRow + "&select=file_data&limit=1"); img = fromDataUrl(old && old[0] && old[0].file_data); } catch (e) { img = null; }
  }
  if (!img) { const t = fromDataUrl(m.thumb); if (t) return imageResponse(t); }     // better small than nothing
  return img ? imageResponse(img) : noPhoto();
}

export default async function handler(req) {
  const cfg = getConfig();
  if (req.method === "GET") {
    const q = new URL(req.url).searchParams;
    const prefix = q.get("prefix") || "";
    if (!validPrefix(prefix)) return errorResponse(400, "bad prefix");
    if (q.has("photo")) { try { return await servePhoto(cfg, prefix, q.get("photo") || "", q.get("p") || "", q.get("size") === "thumb" ? "thumb" : "full"); } catch (e) { return noPhoto(); } }
    try { return await list(cfg, prefix, isStaffView(cfg, req.headers.get("x-pm-session") || "")); } catch (e) { return errorResponse(502, "Could not load the issues: " + e.message); }
  }
  if (req.method !== "POST") return errorResponse(405, "GET or POST only");
  let body; try { body = await req.json(); } catch (e) { return errorResponse(400, "Invalid JSON"); }
  if (body.website) return jsonResponse(200, { ok: true });                         // honeypot: pretend it worked
  const prefix = String(body.prefix || ""), id = String(body.id || ""), action = String(body.action || "");
  if (!validPrefix(prefix) || !/^[\w.-]{3,80}$/.test(id)) return errorResponse(400, "ticket missing");
  if (!["comment", "fixed", "reply", "notfixed", "metoo", "unmetoo"].includes(action)) return errorResponse(400, "unknown action");
  const isStaffAction = action === "reply" || action === "notfixed";
  let who = { name: "" };
  if (isStaffAction) { who = staff(cfg, body.token); if (!who.ok) return errorResponse(401, who.error); }
  const text = clean(body.text, 600), name = clean(body.name, 60);
  if ((action === "comment" || action === "reply") && text.length < 2) return errorResponse(400, "Please type your update.");

  const rowId = prefix + id;
  let d;
  try {
    const rows = await supa(cfg, "/rest/v1/tickets?id=eq." + encodeURIComponent(rowId) + "&select=id,data&limit=1");
    d = rows && rows[0] && rows[0].data;
  } catch (e) { return errorResponse(502, "Could not load the issue: " + e.message); }
  if (!d || !isPublic(d)) return errorResponse(404, "That issue is not on the public list.");
  if (normStatus(d.status) === "closed") return errorResponse(409, "This issue is closed. If the problem is back, please log a new report.");

  let pub;
  try { pub = await loadPub(cfg, rowId); } catch (e) { return errorResponse(502, "Could not load the updates: " + e.message); }
  pub.updates = Array.isArray(pub.updates) ? pub.updates : [];
  const now = Date.now(), last = pub.updates[pub.updates.length - 1];
  if (action === "metoo" || action === "unmetoo") {
    const device = String(body.device || "");
    if (!/^[\w-]{8,40}$/.test(device)) return errorResponse(400, "Please reload the page and try again.");
    pub.metoo = (Array.isArray(pub.metoo) ? pub.metoo : []).filter((m) => m && m.d);
    const has = pub.metoo.some((m) => m.d === device);
    if (action === "metoo" && !has) {
      if (pub.metoo.length >= MAX_METOO) return errorResponse(429, "A lot of residents have already added themselves — the trustees know it affects many units.");
      pub.metoo.push({ d: device, ts: now, unit: cleanUnit(body.unit) });
    } else if (action === "unmetoo" && has) pub.metoo = pub.metoo.filter((m) => m.d !== device);
    if (has !== (action === "metoo")) { try { await savePub(cfg, rowId, pub); } catch (e) { return errorResponse(502, "Could not save: " + e.message); } }
    return jsonResponse(200, { ok: true, mine: action === "metoo", ticket: shape(rowId, prefix, d, pub) });
  }
  if (!isStaffAction) {
    if (pub.updates.length >= MAX_UPDATES) return errorResponse(429, "This issue already has a lot of updates — please contact a trustee directly.");
    if (last && now - Number(last.ts) < MIN_GAP_MS) return errorResponse(429, "An update was added a moment ago — please wait a few seconds and try again.");
  }
  if (action === "comment") pub.updates.push({ ts: now, text, by: name || "A resident", role: "resident" });
  else if (action === "reply") pub.updates.push({ ts: now, text, by: who.name || name || "Trustees", role: "trustee" });
  else if (action === "fixed") {
    if (pub.fixed) return jsonResponse(200, { ok: true, already: true, ticket: shape(rowId, prefix, d, pub) });
    pub.fixed = { at: now, by: name || "A resident", text };
    pub.updates.push({ ts: now, text: text || "Reported as fixed.", by: name || "A resident", role: "resident", kind: "fixed" });
  } else if (action === "notfixed") {
    pub.fixed = null;
    pub.updates.push({ ts: now, text: text || "Not fixed yet — still being attended to.", by: who.name || name || "Trustees", role: "trustee", kind: "notfixed" });
  }
  try { await savePub(cfg, rowId, pub); } catch (e) { return errorResponse(502, "Could not save: " + e.message); }

  // Tell the Park Manor inbox what a resident did (best effort — never blocks the save).
  if (!isStaffAction && looksLikeEmail(body.bcInbox) && !emailConfigError()) {
    const ref = d.ticketNumber != null ? "#" + d.ticketNumber + " " : "";
    const what = action === "fixed" ? "reported this issue as FIXED" : "added an update";
    try {
      await sendEmail({
        to: [String(body.bcInbox).trim()],
        subject: (action === "fixed" ? "✅ Reported fixed: " : "💬 Update on ") + ref + clean(d.title, 120),
        text: [
          `${name || "A resident"} ${what} on the Park Manor report page.`, "",
          `Issue:  ${ref}${clean(d.title, 200)}`, d.unit ? `Unit:   ${clean(d.unit, 30)}` : null, "",
          text ? `"${text}"` : null, text ? "" : null,
          action === "fixed" ? "If it really is fixed, close the ticket in the tracker to confirm. If not, open the ticket and choose \"Not fixed yet\"." : "Open the ticket in the tracker to reply.",
          "", "— Park Manor (automated notification)",
        ].filter((l) => l !== null).join("\n"),
      });
    } catch (e) { console.warn("public-tickets: notify failed", e.message); }
  }
  return jsonResponse(200, { ok: true, ticket: shape(rowId, prefix, d, pub) });
}
