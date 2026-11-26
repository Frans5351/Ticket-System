// functions/water-reading.js
// Files a water-meter photo in Google Drive and reads the meter from it.
//
// Called by the app right after a reading has been saved to the
// `water_readings` table (from the public form or captured by hand):
//   POST /api/water-reading  { rowId, photos:[{ name, type, dataUrl }], read?:bool, drive?:bool }
// The row must exist and have been written in the last 20 minutes — that is
// what stops this endpoint being used to burn API credits or fill the Drive.
// Unit and month are taken from the stored row, never from the request.
//
//   1. Drive   — posts the photos to a small Google Apps Script web app
//                (docs/water-readings-drive.gs) which saves them as
//                "Park Manor Water Meter Readings / November 2026 / Unit 3.jpg".
//   2. Reading — asks Claude (vision) for the digits on the meter. The result
//                is stored as a SUGGESTION (data.ai) for a person to confirm;
//                it never overwrites a typed reading.
// Both are optional: whichever isn't configured is skipped and reported.
//
// SETUP (Netlify → Site settings → Environment variables, then redeploy):
//   WATER_DRIVE_URL     the Apps Script web-app URL (ends in /exec)
//   WATER_DRIVE_SECRET  the same password you typed into the script
//   ANTHROPIC_API_KEY   key from console.anthropic.com
//   WATER_READ_MODEL    optional, default claude-sonnet-5-5

import { jsonResponse, errorResponse, getConfig, verifySessionJwt } from "./_passkey-shared.js";

export const config = { path: "/api/water-reading" };

const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwYWdjbXpobG5ndHF2cnlkenZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MTA1OTgsImV4cCI6MjA5NDA4NjU5OH0.TfRrz2iUPFm7AUL55BRNJtyhNl--s8yBbtejcD9yjPU";
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MAX_PHOTOS = 5;
const MAX_TOTAL_B64 = 5_600_000;
const FRESH_MS = 20 * 60 * 1000;

// Electricity readings share this function: the app sends kind:"electricity" and the rows live in
// electricity_readings. Photos go to "Park Manor Electricity Meter Readings / <day Month Year> / Unit N.jpg"
// (the main meter as "Main Meter.jpg") — the structure already used for the monthly walk-round.
const TABLES = { water: "water_readings", electricity: "electricity_readings" };
const kindOf = (k) => (k === "electricity" ? "electricity" : "water");
const PROMPT_ELEC = [
  "This photo should show an electricity meter (South Africa) — a kWh meter for a house, or the main meter for a complex.",
  "Read the cumulative energy register in kWh from the display or the number wheels.",
  "Digits before the decimal point (or before a decimal marker / differently coloured or boxed last digit) are whole kWh; anything after is the decimal part. If there is no decimal marker, treat every digit as whole kWh.",
  "Ignore serial numbers, the meter constant (e.g. imp/kWh), voltage/current ratings and any label such as HOUSE 7.",
  "If a digit wheel is caught between two numbers, take the lower one. If an LCD shows something other than the kWh total (e.g. a date or tariff code), say so in the note and return null.",
  "Reply with ONLY a JSON object, no other text:",
  '{"is_meter": true|false, "whole": "<whole-kWh digits exactly as shown, leading zeros included>", "decimals": "<decimal digits, or empty string>", "reading": <number in kWh = whole.decimals, or null if you cannot read it>, "confidence": "high"|"medium"|"low", "note": "<short note if anything is unclear, else empty string>"}',
].join("\n");

const PROMPT = [
  "This photo should show a residential water meter (South Africa).",
  "Read the meter's cumulative register in kilolitres (m³).",
  "The black digits (usually on a white background) are whole kilolitres. Red digits, or digits in a red box, are decimal fractions of a kilolitre. Small circular dials with pointers are finer fractions — ignore them.",
  "If a digit wheel is caught between two numbers, take the lower one.",
  "Reply with ONLY a JSON object, no other text:",
  '{"is_water_meter": true|false, "whole": "<black digits exactly as shown, leading zeros included>", "decimals": "<red digits, or empty string>", "reading": <number in kilolitres = whole.decimals, or null if you cannot read it>, "confidence": "high"|"medium"|"low", "note": "<one short sentence about anything unclear: glare, blur, cut off, a digit mid-roll>"}',
].join("\n");

function withTimeout(ms) { const c = new AbortController(); const t = setTimeout(() => c.abort(), ms); return { signal: c.signal, done: () => clearTimeout(t) }; }
function splitDataUrl(u) { const m = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(String(u || "")); return m ? { mime: m[1].toLowerCase(), data: m[2] } : null; }
// "16 Nov 2026 21h35" in South African time — when the reading reached the app.
// If the reading's own date was set by hand to another day, just that date.
// (No ':' or '.' — the Drive script strips them from names.)
function fileStamp(d) {
  try {
    const at = Number(d.submittedAt) || Date.now();
    const parts = {};
    new Intl.DateTimeFormat("en-GB", { timeZone: process.env.WATER_TZ || "Africa/Johannesburg", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(at)).forEach((p) => { parts[p.type] = p.value; });
    const mon = parts.month.replace(/[^A-Za-z]/g, "").slice(0, 3);
    const iso = parts.year + "-" + String(MONTHS.findIndex((m) => m.slice(0, 3) === mon) + 1).padStart(2, "0") + "-" + parts.day;
    const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(String(d.date || ""));
    if (m && d.date !== iso) return m[3] + " " + MONTHS[Number(m[2]) - 1].slice(0, 3) + " " + m[1];
    return parts.day + " " + mon + " " + parts.year + " " + parts.hour + "h" + parts.minute;
  } catch (e) { return ""; }
}
function monthLabel(ym) { const m = /^(\d{4})-(\d\d)$/.exec(String(ym || "")); return m ? MONTHS[Number(m[2]) - 1] + " " + m[1] : "Unsorted"; }

async function supa(cfg, path, init = {}) {
  const key = cfg.supaServiceKey || ANON_KEY;
  const r = await fetch(cfg.supaUrl + path, { ...init, headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json", ...(init.headers || {}) } });
  if (!r.ok) throw new Error("Supabase " + r.status + ": " + (await r.text()).slice(0, 200));
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

// ── Photos added straight into the Drive folder ─────────────────────────────
// The register asks what is in a month folder ("driveList") and fetches a
// photo in parts ("driveGet") so the browser can shrink it and save it as a
// reading. Trustees / managing agent only: needs the signed-in session token
// whenever the site has PASSKEY_JWT_SECRET configured.
function staffOnly(cfg, token) {
  if (!cfg.jwtSecret) return null;                       // site has no server sessions — same openness as the rest of the app
  const s = verifySessionJwt(cfg, String(token || ""));
  if (!s) return "Please sign out and sign in again, then retry.";
  if (!["admin", "trustee", "management"].includes(String(s.role || ""))) return "Not allowed for this user.";
  return null;
}
async function driveScript(payload, ms) {
  const url = process.env.WATER_DRIVE_URL, secret = process.env.WATER_DRIVE_SECRET;
  if (!url || !secret) return { ok: false, error: "Google Drive filing is not set up" };
  const to = withTimeout(ms || 22000);
  try {
    const r = await fetch(url, { method: "POST", redirect: "follow", signal: to.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ secret, ...payload }) });
    const text = await r.text();
    let j = null; try { j = JSON.parse(text); } catch (e) {}
    if (!j) return { ok: false, error: "Drive script did not return JSON (status " + r.status + "). Check the web app is deployed with access 'Anyone'." };
    if (!j.ok) return { ok: false, error: "Drive script: " + (j.error || "failed") };
    return j;
  } catch (e) {
    return { ok: false, error: e.name === "AbortError" ? "Drive script timed out" : String(e.message || e) };
  } finally { to.done(); }
}
const OLD_SCRIPT = "The Google script is an older version. Paste in the new docs/water-readings-drive.gs and deploy a New version (see docs/WATER_PHOTOS_SETUP.md).";
const OLD_FOR_ELEC = "The Google script is an older version without electricity support. Paste in the new docs/water-readings-drive.gs and deploy a New version.";
async function driveList(body) {
  const m = /^(\d{4})-(\d\d)$/.exec(String(body.month || ""));
  if (!m) return errorResponse(400, "month missing");
  const j = await driveScript({ action: "list", kind: kindOf(body.kind), month: monthLabel(body.month), ym: String(body.month) });
  if (!j.ok) return jsonResponse(200, { ok: false, error: j.error });
  if (!j.listed) return jsonResponse(200, { ok: false, outdated: true, error: OLD_SCRIPT });
  if (kindOf(body.kind) === "electricity" && !(Number(j.v) >= 4)) return jsonResponse(200, { ok: false, outdated: true, error: OLD_FOR_ELEC });
  return jsonResponse(200, { ok: true, folder: j.folder || "", files: (j.files || []).map((f) => ({ id: String(f.id), name: String(f.name || ""), url: String(f.url || ""), mime: String(f.mime || ""), size: Number(f.size) || 0, created: Number(f.created) || 0, date: /^\d{4}-\d\d-\d\d$/.test(String(f.date || "")) ? String(f.date) : "", folderName: String(f.folderName || "") })) });
}
async function driveGet(body) {
  const id = String(body.id || "");
  if (!/^[\w-]{10,100}$/.test(id)) return errorResponse(400, "id missing");
  const j = await driveScript({ action: "get", kind: kindOf(body.kind), id, part: Math.max(0, Number(body.part) || 0) });
  if (!j.ok) return jsonResponse(200, { ok: false, error: j.error });
  if (!j.got) return jsonResponse(200, { ok: false, outdated: true, error: OLD_SCRIPT });
  if (kindOf(body.kind) === "electricity" && !(Number(j.v) >= 4)) return jsonResponse(200, { ok: false, outdated: true, error: OLD_FOR_ELEC });
  return jsonResponse(200, { ok: true, id: j.id, name: j.name, mime: j.mime, parts: j.parts, part: j.part, data: j.data });
}

async function saveToDrive(photos, row, rowId, kind) {
  const url = process.env.WATER_DRIVE_URL, secret = process.env.WATER_DRIVE_SECRET;
  if (!url || !secret) return { configured: false, files: [] };
  const d = row.data || {};
  const to = withTimeout(22000);
  try {
    const r = await fetch(url, {
      method: "POST", redirect: "follow", signal: to.signal, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret, kind, month: monthLabel(d.month), unit: String(d.unit || ""), stamp: kind === "electricity" ? "" : fileStamp(d),
        day: Number(String(d.date || "").slice(8, 10)) || 0,
        description: (kind === "electricity" ? "Electricity" : "Water") + " meter reading · Unit " + (d.unit || "?") + " · received " + (d.date || "") + (d.value != null ? " · reading " + d.value : "") + " · " + (d.source === "manual" ? "captured by " + (d.by || "admin") : "sent via the app") + " · " + rowId,
        // electricity photos travel under another name so an OLD script (which only knows water) files nothing rather than misfiling them
        [kind === "electricity" ? "photos" : "files"]: photos.map((p) => ({ mime: p.mime, data: p.data })),
      }),
    });
    const text = await r.text();
    let j = null; try { j = JSON.parse(text); } catch (e) {}
    if (!j) return { configured: true, files: [], error: "Drive script did not return JSON (status " + r.status + "). Check the web app is deployed with access 'Anyone'." };
    if (!j.ok) return { configured: true, files: [], error: "Drive script: " + (j.error || "failed") };
    if (kind === "electricity" && !(Number(j.v) >= 4)) return { configured: true, files: [], error: OLD_FOR_ELEC };
    return { configured: true, files: j.files || [], folder: j.folder || "" };
  } catch (e) {
    return { configured: true, files: [], error: e.name === "AbortError" ? "Drive script timed out" : String(e.message || e) };
  } finally { to.done(); }
}

async function readMeter(photo, kind) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { configured: false };
  const model = process.env.WATER_READ_MODEL || "claude-sonnet-5-5";
  const to = withTimeout(22000);
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", signal: to.signal,
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, max_tokens: 300, messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: photo.mime, data: photo.data } },
        { type: "text", text: kind === "electricity" ? PROMPT_ELEC : PROMPT },
      ] }] }),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok) return { configured: true, error: "Claude API " + r.status + ": " + ((j && j.error && j.error.message) || "request failed") };
    const text = ((j && j.content) || []).filter((c) => c.type === "text").map((c) => c.text).join("");
    const m = /\{[\s\S]*\}/.exec(text);
    let o = null; try { o = m ? JSON.parse(m[0]) : null; } catch (e) {}
    if (!o) return { configured: true, error: "Could not understand the model's answer" };
    let value = o.reading == null || o.reading === "" ? null : Number(o.reading);
    if (value != null && (!isFinite(value) || value < 0 || value > 9999999)) value = null;
    const notMeter = o.is_water_meter === false || o.is_meter === false;
    if (notMeter) value = null;
    const conf = ["high", "medium", "low"].includes(o.confidence) ? o.confidence : "low";
    return { configured: true, value, confidence: value == null ? "low" : conf, whole: String(o.whole || ""), decimals: String(o.decimals || ""),
      note: String(o.note || (notMeter ? "This doesn't look like " + (kind === "electricity" ? "an electricity" : "a water") + " meter." : "")).slice(0, 200), model };
  } catch (e) {
    return { configured: true, error: e.name === "AbortError" ? "Reading the photo timed out" : String(e.message || e) };
  } finally { to.done(); }
}

export default async function handler(req) {
  // GET: which halves are switched on (no secrets) — the register shows this.
  if (req.method === "GET") return jsonResponse(200, { drive: !!(process.env.WATER_DRIVE_URL && process.env.WATER_DRIVE_SECRET), read: !!process.env.ANTHROPIC_API_KEY });
  if (req.method !== "POST") return errorResponse(405, "POST only");
  let body; try { body = await req.json(); } catch (e) { return errorResponse(400, "Invalid JSON"); }
  // Public (no login): the newest electricity photo on file for one meter, for the form's
  // "last reading" panel when this month's hasn't been logged in the app. Only electricity
  // meter photos can be fetched this way, and only by the id the first call returned.
  if (body.action === "elecLast") {
    const unit = String(body.unit || "").trim().toLowerCase();
    if (!/^(main|\d{1,3})$/.test(unit)) return errorResponse(400, "unit missing");
    const j = await driveScript({ action: "last", kind: "electricity", unit });
    if (!j.ok) return jsonResponse(200, { ok: false, error: j.error });
    if (!j.last) return jsonResponse(200, { ok: false, outdated: true, error: OLD_FOR_ELEC });
    return jsonResponse(200, j.found ? { ok: true, found: true, id: String(j.id), name: String(j.name || ""), date: String(j.date || ""), folderName: String(j.folderName || "") } : { ok: true, found: false });
  }
  if (body.action === "elecPhoto") {
    const id = String(body.id || "");
    if (!/^[\w-]{10,100}$/.test(id)) return errorResponse(400, "id missing");
    const j = await driveScript({ action: "get", kind: "electricity", only: "electricity", id, part: Math.max(0, Number(body.part) || 0) });
    if (!j.ok) return jsonResponse(200, { ok: false, error: j.error });
    if (!j.got || !(Number(j.v) >= 5)) return jsonResponse(200, { ok: false, outdated: true, error: OLD_FOR_ELEC });
    return jsonResponse(200, { ok: true, mime: j.mime, parts: j.parts, part: j.part, data: j.data });
  }
  if (body.action === "driveList" || body.action === "driveGet") {
    const denied = staffOnly(getConfig(), body.token);
    if (denied) return errorResponse(401, denied);
    return body.action === "driveList" ? driveList(body) : driveGet(body);
  }
  const kind = kindOf(body.kind), table = TABLES[kind];
  const rowId = String(body.rowId || "");
  if (!/^[\w:.-]{3,120}$/.test(rowId)) return errorResponse(400, "rowId missing");
  const photos = (Array.isArray(body.photos) ? body.photos : []).slice(0, MAX_PHOTOS).map((p) => splitDataUrl(p && p.dataUrl)).filter(Boolean);
  if (!photos.length) return errorResponse(400, "No photos");
  if (photos.reduce((s, p) => s + p.data.length, 0) > MAX_TOTAL_B64) return errorResponse(413, "Photos too large");

  const cfg = getConfig();
  let row;
  try {
    const rows = await supa(cfg, "/rest/v1/" + table + "?id=eq." + encodeURIComponent(rowId) + "&select=id,data,updated_at&limit=1");
    row = rows && rows[0];
  } catch (e) { return errorResponse(502, "Could not load the reading: " + e.message); }
  if (!row) return errorResponse(404, "Reading not found");
  if (!row.updated_at || Date.now() - new Date(row.updated_at).getTime() > FRESH_MS) return errorResponse(403, "This reading is no longer open for filing — save it again first");

  const wantDrive = body.drive !== false, wantRead = body.read !== false;
  const [drive, read] = await Promise.all([
    wantDrive ? saveToDrive(photos, row, rowId, kind) : Promise.resolve({ configured: !!process.env.WATER_DRIVE_URL, files: [], skipped: true }),
    wantRead ? readMeter(photos[0], kind) : Promise.resolve({ configured: !!process.env.ANTHROPIC_API_KEY, skipped: true }),
  ]);

  // Merge onto the freshest copy of the row so a quick edit in between isn't lost.
  let saved = false;
  try {
    const again = await supa(cfg, "/rest/v1/" + table + "?id=eq." + encodeURIComponent(rowId) + "&select=data&limit=1");
    const data = Object.assign({}, (again && again[0] && again[0].data) || row.data || {});
    if (drive.files && drive.files.length) { data.driveFiles = (data.driveFiles || []).concat(drive.files.map((f) => ({ name: f.name, url: f.url, id: f.id }))); if (drive.folder) data.driveFolder = drive.folder; }
    if (drive.error) data.driveError = drive.error; else if (drive.files && drive.files.length) delete data.driveError;
    if (read && !read.skipped && read.configured) data.ai = read.error ? { error: read.error, at: Date.now() } : { value: read.value, confidence: read.confidence, whole: read.whole, decimals: read.decimals, note: read.note, model: read.model, at: Date.now() };
    await supa(cfg, "/rest/v1/" + table, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ id: rowId, data, updated_at: new Date().toISOString() }) });
    saved = true;
  } catch (e) { console.warn("water-reading: could not update row", e.message); }

  return jsonResponse(200, {
    ok: true, saved,
    drive: { configured: drive.configured, files: drive.files || [], folder: drive.folder || "", error: drive.error || "" },
    read: read.skipped ? { configured: read.configured, skipped: true } : { configured: read.configured, value: read.value == null ? null : read.value, confidence: read.confidence || "", note: read.note || "", error: read.error || "" },
  });
}
