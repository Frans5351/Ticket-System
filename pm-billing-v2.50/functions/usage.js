// functions/usage.js
// Is the report page being used? Counts per device, shown to the trustees under "Usage".
//
//   POST /api/usage   { prefix, dev, visit, app, kind, browser, unit, staff, opens:{…}, did:{…} }      (the report page)
//   POST /api/usage   { prefix, dev, forget:true, undo:{opens,did} }                                   (… taking a visit back out)
//   GET  /api/usage?prefix=                       → { ok, today, devices:[…] }                         (admin / trustee)
//   POST /api/usage   { action:"label", prefix, dev, label, hide, unit }  |  { action:"remove", prefix, dev }   (admin / trustee)
//
// See _usage-shared.js for what is kept and what is deliberately not.

import { jsonResponse, errorResponse, getConfig, verifySessionJwt } from "./_passkey-shared.js";
import { DEV_ID, dayOf, isBot, cleanHit, cleanRow, mergeHit, applyLabel } from "./_usage-shared.js";

export const config = { path: "/api/usage" };

const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwYWdjbXpobG5ndHF2cnlkenZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MTA1OTgsImV4cCI6MjA5NDA4NjU5OH0.TfRrz2iUPFm7AUL55BRNJtyhNl--s8yBbtejcD9yjPU";
const MAX_DEVICES = 600;
const validPrefix = (p) => /^([\w-]{1,40}:)?$/.test(p);

async function supa(cfg, path, init = {}) {
  const key = cfg.supaServiceKey || ANON_KEY;
  const r = await fetch((cfg.supaUrl || "https://spagcmzhlngtqvrydzvi.supabase.co") + path, { ...init, headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json", ...(init.headers || {}) } });
  if (!r.ok) throw new Error("Supabase " + r.status + ": " + (await r.text()).slice(0, 200));
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}
const keyOf = (prefix, dev) => prefix + "usage:" + dev;
async function loadRow(cfg, prefix, dev) {
  const rows = await supa(cfg, "/rest/v1/settings?key=eq." + encodeURIComponent(keyOf(prefix, dev)) + "&select=value&limit=1");
  return rows && rows[0] ? cleanRow(rows[0].value, dev) : null;
}
const saveRow = (cfg, prefix, row) => supa(cfg, "/rest/v1/settings?on_conflict=key", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ key: keyOf(prefix, row.dev), value: row }) });
const dropRow = (cfg, prefix, dev) => supa(cfg, "/rest/v1/settings?key=eq." + encodeURIComponent(keyOf(prefix, dev)), { method: "DELETE", headers: { Prefer: "return=minimal" } });
async function listRows(cfg, prefix) {
  const rows = await supa(cfg, "/rest/v1/settings?key=like." + encodeURIComponent(prefix + "usage:*") + "&select=key,value&limit=" + (MAX_DEVICES + 50));
  return (rows || []).map((r) => cleanRow(r.value, String(r.key).slice((prefix + "usage:").length))).filter((r) => DEV_ID.test(r.dev));
}
// Admin or trustee, proven by the session token (a site with no server sessions is as open as the rest of the app).
function staff(cfg, token) {
  if (!cfg.jwtSecret) return true;
  const s = verifySessionJwt(cfg, String(token || ""));
  return !!s && ["admin", "trustee"].includes(String(s.role || ""));
}

export default async function handler(req) {
  const cfg = getConfig();
  if (req.method === "GET") {
    const prefix = new URL(req.url).searchParams.get("prefix") || "";
    if (!validPrefix(prefix)) return errorResponse(400, "bad prefix");
    if (!staff(cfg, req.headers.get("x-pm-session"))) return errorResponse(403, "Please sign out and sign in again, then retry.");
    try { return jsonResponse(200, { ok: true, today: dayOf(Date.now()), devices: await listRows(cfg, prefix) }); }
    catch (e) { return errorResponse(502, "Could not load the usage counts: " + e.message); }
  }
  if (req.method !== "POST") return errorResponse(405, "GET or POST only");
  let b; try { b = await req.json(); } catch (e) { return errorResponse(400, "bad request"); }
  const prefix = String((b && b.prefix) || ""), dev = String((b && b.dev) || "");
  if (!validPrefix(prefix) || !DEV_ID.test(dev)) return errorResponse(400, "bad request");

  if (b.action === "label" || b.action === "remove") {
    if (!staff(cfg, req.headers.get("x-pm-session"))) return errorResponse(403, "Please sign out and sign in again, then retry.");
    try {
      if (b.action === "remove") { await dropRow(cfg, prefix, dev); return jsonResponse(200, { ok: true, removed: true }); }
      const row = await loadRow(cfg, prefix, dev); if (!row) return errorResponse(404, "That device is no longer listed.");
      await saveRow(cfg, prefix, applyLabel(row, b)); return jsonResponse(200, { ok: true, device: row });
    } catch (e) { return errorResponse(502, "Could not save: " + e.message); }
  }

  // The report page. Never fails loudly: counting must not get in a resident's way.
  if (isBot(req.headers.get("user-agent"))) return jsonResponse(200, { ok: true, counted: false });
  try {
    const hit = cleanHit(b), today = dayOf(Date.now());
    let row = await loadRow(cfg, prefix, dev);
    if (!row) {
      if (hit.forget) return jsonResponse(200, { ok: true, counted: false });
      const have = await supa(cfg, "/rest/v1/settings?key=like." + encodeURIComponent(prefix + "usage:*") + "&select=key&limit=" + (MAX_DEVICES + 1));
      if ((have || []).length >= MAX_DEVICES) return jsonResponse(200, { ok: true, counted: false, full: true });
      row = cleanRow({}, dev);
    }
    const next = mergeHit(row, hit, today);
    if (next) await saveRow(cfg, prefix, next); else await dropRow(cfg, prefix, dev);
    return jsonResponse(200, { ok: true, counted: true });
  } catch (e) {
    console.warn("usage: not counted:", e.message);
    return jsonResponse(200, { ok: true, counted: false });
  }
}
