// functions/frame-check.js
// Can the managing agent's portal (the "invoices and billing" link on the report
// page) be shown inside the Park Manor page, or does it refuse to be framed?
//
//   GET /api/frame-check?prefix=   →  { ok:true, embed:true|false, reason }
//
// A browser cannot find this out by itself: a site that refuses just leaves an
// empty box. So this asks the portal for its page once and reads the two
// response headers that decide it (X-Frame-Options, and frame-ancestors in
// Content-Security-Policy). The page then shows the portal in place only when
// the answer is yes; otherwise it keeps the plain "open in a new tab" button.
//
// The address checked is never taken from the request: it is the link saved in
// Settings ("billing_portal"), or the standard WeconnectU sign-in page when
// nothing has been saved. Nothing about the portal's content is returned.

import { errorResponse, getConfig } from "./_passkey-shared.js";
import { publicHttps, decide } from "./_frame-shared.js";

export const config = { path: "/api/frame-check" };

const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwYWdjbXpobG5ndHF2cnlkenZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MTA1OTgsImV4cCI6MjA5NDA4NjU5OH0.TfRrz2iUPFm7AUL55BRNJtyhNl--s8yBbtejcD9yjPU";
const DEFAULT_URL = "https://app.weconnectu.co.za/signin";
const validPrefix = (p) => /^([\w-]{1,40}:)?$/.test(p);

async function savedUrl(cfg, prefix) {
  const key = cfg.supaServiceKey || ANON_KEY;
  const r = await fetch(cfg.supaUrl + "/rest/v1/settings?key=eq." + encodeURIComponent(prefix + "billing_portal") + "&select=value&limit=1", { headers: { apikey: key, Authorization: "Bearer " + key } });
  if (!r.ok) throw new Error("settings " + r.status);
  const rows = await r.json();
  let v = rows && rows[0] ? rows[0].value : undefined;
  if (typeof v === "string") { try { v = JSON.parse(v); } catch (e) { v = undefined; } }
  if (v && typeof v === "object" && !Array.isArray(v)) return { saved: true, url: String(v.url || ""), embed: v.embed !== false };
  return { saved: false, url: "", embed: true };
}

export default async function handler(req) {
  if (req.method !== "GET") return errorResponse(405, "GET only");
  const here = new URL(req.url), prefix = here.searchParams.get("prefix") || "";
  if (!validPrefix(prefix)) return errorResponse(400, "bad prefix");
  const cfg = getConfig();
  let s;
  try { s = await savedUrl(cfg, prefix); } catch (e) { s = { saved: false, url: "", embed: true }; }
  const target = publicHttps(s.saved ? s.url : (prefix ? "" : DEFAULT_URL));
  const out = (embed, reason) => new Response(JSON.stringify({ ok: true, embed, reason }), { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=900" } });
  if (!target) return out(false, "no link is set");
  if (!s.embed) return out(false, "turned off in Settings");
  try {
    const r = await fetch(target, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(7000), headers: { "User-Agent": "Mozilla/5.0 (compatible; ParkManor frame-check)", Accept: "text/html" } });
    if (!publicHttps(r.url || target)) return out(false, "the link leads somewhere unexpected");
    if (r.status >= 400) return out(false, "the portal did not answer (" + r.status + ")");
    const d = decide(r.headers.get("x-frame-options"), r.headers.get("content-security-policy"), here.origin);
    return out(d.embed, d.reason);
  } catch (e) {
    return out(false, "the portal could not be reached to check");
  }
}
