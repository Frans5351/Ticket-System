// functions/ingest-email.js
// Receives a matched email from the Park Manor mailbox monitor (a Google Apps
// Script running inside parkmanorbc@gmail.com) and appends it to the matching
// ticket's activity log. This is how correspondence to the Body Corporate
// inbox shows up on the ticket — the monitoring belongs to the Park Manor
// Google account, not to any individual's Claude/Gmail.
//
// Auth: a shared secret. Set EMAIL_INGEST_SECRET in Netlify env, and the same
// value in the Apps Script. Without it, the endpoint refuses everything.
//
// Body (POST JSON):
//   { secret, ticketNumber, from, date, subject, snippet, gmailUrl, messageId }
//
// Writes to Supabase using the service-role key when configured (bypasses RLS
// for a clean server-side append), else the public anon key.

import { jsonResponse, errorResponse, getConfig } from "./_passkey-shared.js";

export const config = { path: "/api/ingest-email" };

const SUPA_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwYWdjbXpobG5ndHF2cnlkenZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MTA1OTgsImV4cCI6MjA5NDA4NjU5OH0.TfRrz2iUPFm7AUL55BRNJtyhNl--s8yBbtejcD9yjPU";

function clip(s, n) {
  s = String(s == null ? "" : s).replace(/\s+/g, " ").trim();
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export default async function handler(req) {
  if (req.method !== "POST") return errorResponse(405, "Method not allowed");

  const secretExpected = process.env.EMAIL_INGEST_SECRET || "";
  if (!secretExpected) {
    return errorResponse(500, "Email ingest isn't configured yet. Set EMAIL_INGEST_SECRET in Netlify environment variables.");
  }

  let body;
  try { body = await req.json(); } catch (_) { return errorResponse(400, "Invalid JSON body"); }

  if (String(body.secret || "") !== secretExpected) return errorResponse(401, "Unauthorized");

  const ticketNumber = String(body.ticketNumber || "").replace(/[^0-9]/g, "");
  if (!ticketNumber) return errorResponse(400, "A numeric ticketNumber is required");

  const from = clip(body.from, 200);
  const subject = clip(body.subject, 300);
  const snippet = clip(body.snippet, 300);
  const gmailUrl = String(body.gmailUrl || "").trim().slice(0, 800);
  const messageId = String(body.messageId || "").trim().slice(0, 300);
  const ts = Date.parse(body.date) || Date.now();

  const cfg = getConfig();
  const supaUrl = cfg.supaUrl || "https://spagcmzhlngtqvrydzvi.supabase.co";
  const supaKey = cfg.supaServiceKey || SUPA_ANON;
  const H = { apikey: supaKey, Authorization: "Bearer " + supaKey, "Content-Type": "application/json", Accept: "application/json" };

  // Find the ticket by its ticketNumber (stored inside the JSON `data` column).
  let row;
  try {
    const r = await fetch(
      supaUrl + "/rest/v1/tickets?data->>ticketNumber=eq." + encodeURIComponent(ticketNumber) + "&select=id,data&limit=1",
      { headers: H }
    );
    if (!r.ok) return errorResponse(502, "Could not query tickets (" + r.status + ")");
    const rows = await r.json();
    if (!rows.length) return jsonResponse(200, { ok: true, matched: false, reason: "No ticket #" + ticketNumber });
    row = rows[0];
  } catch (e) {
    return errorResponse(502, "Ticket lookup failed: " + (e && e.message ? e.message : e));
  }

  const data = row.data || {};
  const logArr = Array.isArray(data.log) ? data.log : [];

  // De-dup: never add the same email (by Gmail message id) twice.
  if (messageId && logArr.some((e) => e && e.messageId === messageId)) {
    return jsonResponse(200, { ok: true, duplicate: true, ticketId: row.id });
  }

  const text = "Email from " + (from || "unknown sender") + (subject ? " — " + subject : "") + (snippet ? " — " + snippet : "");
  const entry = {
    type: "email",
    text: clip(text, 500),
    from,
    subject,
    snippet,
    url: gmailUrl || undefined,
    messageId: messageId || undefined,
    ts,
    inTimeline: true,
    source: "bc-inbox",
  };
  logArr.push(entry);
  data.log = logArr;
  data.updated = Date.now();

  // Persist: PATCH just this ticket's row.
  try {
    const w = await fetch(supaUrl + "/rest/v1/tickets?id=eq." + encodeURIComponent(row.id), {
      method: "PATCH",
      headers: { ...H, Prefer: "return=minimal" },
      body: JSON.stringify({ data, updated_at: new Date().toISOString() }),
    });
    if (!w.ok) {
      const t = await w.text().catch(() => "");
      return errorResponse(502, "Could not update ticket (" + w.status + "): " + t.slice(0, 200));
    }
  } catch (e) {
    return errorResponse(502, "Ticket update failed: " + (e && e.message ? e.message : e));
  }

  return jsonResponse(200, { ok: true, matched: true, ticketId: row.id, ticketNumber });
}
