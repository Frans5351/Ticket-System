// functions/_usage-shared.js
// How the report page's usage counts are kept: one small record per device.
//
// Settings key "<scheme prefix>usage:<device id>" =
//   { v:1, dev, first, last, prev, visits, appVisits, app, days:{day:n}, opens:{key:n}, did:{key:n},
//     kind, browser, unit, staff, label, hide }
//
// Deliberately NOT kept: names, IP addresses, the full browser string, exact times (days only).
// A visit in which a report is sent anonymously is taken back out again (forget), so the counts
// cannot be used to work out who sent it.

export const OPEN_KEYS = ["em", "ag", "wcu", "cs", "doc", "report", "water", "elec", "issues", "install"];
export const DID_KEYS = ["report", "water", "elec", "metoo", "update", "fixed", "call", "email", "doc", "link", "wcu"];
export const KINDS = ["iPhone", "iPad", "Android phone", "Android tablet", "Windows computer", "Mac", "Linux computer", "Chromebook", "Other"];
export const BROWSERS = ["Safari", "Chrome", "Samsung Internet", "Firefox", "Edge", "Opera", "In-app browser", "Other"];
export const DEV_ID = /^[\w-]{8,40}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const KEEP_DAYS = 120, MAX_PER_DAY = 200, MAX_COUNT = 100000, MAX_PER_HIT = 30;

export function dayOf(ms, tz = "Africa/Johannesburg") {
  try { return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms)); }
  catch (e) { return new Date(ms).toISOString().slice(0, 10); }
}
export const isBot = (ua) => !ua || /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|node-fetch/i.test(String(ua));
export const cleanUnit = (u) => { const s = String(u == null ? "" : u).trim().slice(0, 12); return /^[\w ]{1,12}$/.test(s) ? s : ""; };
const cleanLabel = (s) => String(s == null ? "" : s).replace(/[\u0000-\u001f<>]/g, " ").trim().slice(0, 60);

function counts(v, keys) {
  const out = {};
  if (Array.isArray(v)) v = v.reduce((o, k) => { o[k] = (o[k] || 0) + 1; return o; }, {});
  if (!v || typeof v !== "object") return out;
  keys.forEach((k) => { const n = Math.floor(Number(v[k])); if (n > 0) out[k] = Math.min(n, MAX_PER_HIT); });
  return out;
}
// What the page sent, reduced to what is allowed.
export function cleanHit(b) {
  b = b && typeof b === "object" ? b : {};
  return {
    visit: !!b.visit, app: !!b.app, staff: !!b.staff, forget: !!b.forget,
    kind: KINDS.includes(b.kind) ? b.kind : "", browser: BROWSERS.includes(b.browser) ? b.browser : "",
    unit: cleanUnit(b.unit), opens: counts(b.opens, OPEN_KEYS), did: counts(b.did, DID_KEYS),
    undo: b.undo && typeof b.undo === "object" ? { opens: counts(b.undo.opens, OPEN_KEYS), did: counts(b.undo.did, DID_KEYS) } : null,
  };
}
export function cleanRow(v, dev) {
  if (typeof v === "string") { try { v = JSON.parse(v); } catch (e) { v = null; } }
  v = v && typeof v === "object" && !Array.isArray(v) ? v : {};
  const num = (x) => Math.max(0, Math.min(MAX_COUNT * 10, Math.floor(Number(x)) || 0));
  const map = (m, keys) => { const o = {}; if (m && typeof m === "object") Object.keys(m).forEach((k) => { if ((!keys || keys.includes(k)) && num(m[k]) > 0) o[k] = num(m[k]); }); return o; };
  const days = {}; if (v.days && typeof v.days === "object") Object.keys(v.days).forEach((d) => { if (DAY.test(d) && num(v.days[d]) > 0) days[d] = num(v.days[d]); });
  return {
    v: 1, dev, first: DAY.test(v.first) ? v.first : "", last: DAY.test(v.last) ? v.last : "", prev: DAY.test(v.prev) ? v.prev : "",
    visits: num(v.visits), appVisits: num(v.appVisits), app: !!v.app, days, opens: map(v.opens, OPEN_KEYS), did: map(v.did, DID_KEYS),
    kind: KINDS.includes(v.kind) ? v.kind : "", browser: BROWSERS.includes(v.browser) ? v.browser : "", unit: cleanUnit(v.unit),
    staff: !!v.staff, label: cleanLabel(v.label), hide: !!v.hide,
  };
}
// Adds one hit to a device's record. Returns the record, or null when nothing is left to keep.
export function mergeHit(row, hit, today) {
  const add = (m, inc, sign) => { Object.keys(inc || {}).forEach((k) => { const n = (m[k] || 0) + sign * inc[k]; if (n > 0) m[k] = Math.min(n, MAX_COUNT); else delete m[k]; }); };
  if (hit.forget) {                                    // take this visit back out (an anonymous report was sent in it)
    if (row.days[today] > 0) {
      row.days[today]--; row.visits = Math.max(0, row.visits - 1);
      if (!row.days[today]) { delete row.days[today]; const left = Object.keys(row.days).sort(); row.last = left.length ? left[left.length - 1] : (row.prev && row.prev !== today ? row.prev : ""); }
    }
    if (hit.undo) { add(row.opens, hit.undo.opens, -1); add(row.did, hit.undo.did, -1); }
    if (!row.visits && !Object.keys(row.days).length) return null;        // that was all there was: no record at all
    return row;
  }
  if (!row.first) row.first = today;
  if (hit.visit && (row.days[today] || 0) < MAX_PER_DAY) {
    if (row.last && row.last !== today) row.prev = row.last;
    row.last = today; row.days[today] = (row.days[today] || 0) + 1; row.visits++;
    if (hit.app) { row.appVisits++; row.app = true; }
  }
  if (!row.last) row.last = today;
  add(row.opens, hit.opens, 1); add(row.did, hit.did, 1);
  if (hit.kind) row.kind = hit.kind;
  if (hit.browser) row.browser = hit.browser;
  if (hit.unit) row.unit = hit.unit;
  if (hit.staff) row.staff = true;
  const cut = dayOf(new Date(today + "T12:00:00Z").getTime() - KEEP_DAYS * 86400000, "UTC");
  Object.keys(row.days).forEach((d) => { if (d < cut) delete row.days[d]; });
  return row;
}
export function applyLabel(row, b) {
  if (b.label !== undefined) row.label = cleanLabel(b.label);
  if (b.hide !== undefined) row.hide = !!b.hide;
  if (b.unit !== undefined) row.unit = cleanUnit(b.unit);
  return row;
}
