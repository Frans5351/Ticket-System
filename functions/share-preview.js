// functions/share-preview.js
// Rich link-preview for shared tickets.
//
// When a ticket share link (/s/<ticketId>?t=<token>) is pasted into WhatsApp,
// Facebook, Slack, iMessage, Teams, etc., those platforms fetch the URL with a
// crawler that reads Open Graph <meta> tags from the HTML <head> — but they do
// NOT run JavaScript. Our app is a client-rendered single page, so a crawler
// hitting the app directly sees no ticket-specific content and shows a bare
// link. This function fixes that: it renders, server-side, a small HTML page
// carrying per-ticket Open Graph tags (title, description, image) so the chat
// preview card is descriptive — and for real people (who DO run JS) it instantly
// loads the actual ticket view at /?share=<id>&t=<token>.
//
// Routing: Netlify v2 function, path "/s/:id" (see `config` below). No
// netlify.toml redirect needed.
//
// Data: reads the ticket from Supabase over REST. Uses the service-role key
// when configured, else the public anon key (the same one the browser app
// already uses to read tickets — this endpoint only READS, never writes).

export const config = { path: "/s/:id" };

const SUPA_URL = process.env.SUPABASE_URL || "https://spagcmzhlngtqvrydzvi.supabase.co";
const SUPA_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwYWdjbXpobG5ndHF2cnlkenZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MTA1OTgsImV4cCI6MjA5NDA4NjU5OH0.TfRrz2iUPFm7AUL55BRNJtyhNl--s8yBbtejcD9yjPU";
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPA_ANON;

const STATUS_LABELS = {
  open: "Open",
  awaiting_quote: "Obtaining Quotes",
  awaiting_trustee_approval: "Awaiting Trustee Approval",
  work_in_progress: "Work In Progress",
  resolved: "Resolved",
  closed: "Closed",
};
const PRIORITY_LABELS = { low: "Low", medium: "Medium", high: "High", urgent: "Urgent" };

// HTML-escape for text nodes and (double-quoted) attribute values.
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
// Escape for embedding inside a single-quoted JS string.
function jsEsc(s) {
  return String(s == null ? "" : s)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\r?\n/g, " ");
}
function clip(s, n) {
  s = String(s == null ? "" : s).replace(/\s+/g, " ").trim();
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export default async function handler(req) {
  const url = new URL(req.url);
  // Ticket id is the last path segment of /s/<id>
  const parts = url.pathname.split("/").filter(Boolean);
  const ticketId = decodeURIComponent(parts[parts.length - 1] || "");
  const token = url.searchParams.get("t") || "";

  // Absolute origin for og:image / og:url (works on any deploy/preview domain).
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("host") || "park-manor-bc.netlify.app";
  const origin = proto + "://" + host;

  const imageUrl = origin + "/park-manor-entrance.jpg";
  // Where real visitors are sent (the existing client-rendered share view).
  const appUrl = origin + "/?share=" + encodeURIComponent(ticketId) + "&t=" + encodeURIComponent(token);

  // Defaults (used when the ticket can't be loaded or the token is invalid —
  // we never leak ticket detail in that case, but still forward to the app so
  // the visitor sees its normal "invalid link" message).
  let title = "Park Manor Body Corporate — Maintenance Ticket";
  let description = "Open this shared maintenance ticket for Park Manor Body Corporate.";

  try {
    if (ticketId && token) {
      const r = await fetch(
        SUPA_URL + "/rest/v1/tickets?id=eq." + encodeURIComponent(ticketId) + "&select=*&limit=1",
        { headers: { apikey: SUPA_KEY, Authorization: "Bearer " + SUPA_KEY, Accept: "application/json" } }
      );
      if (r.ok) {
        const rows = await r.json();
        const ticket = rows && rows.length ? rows[0].data || rows[0] : null;
        // Only reveal detail when the share token matches — the link is the key.
        if (ticket && ticket.shareToken && ticket.shareToken === token) {
          const num = ticket.ticketNumber ? "Ticket #" + ticket.ticketNumber : "Maintenance Ticket";
          const tTitle = clip(ticket.title || "(untitled ticket)", 90);
          title = "Park Manor · " + num + " — " + tTitle;

          const statusLabel = STATUS_LABELS[ticket.status] || ticket.status || "Open";
          const priorityLabel = PRIORITY_LABELS[ticket.priority] || ticket.priority || "";
          const meta = [];
          meta.push(statusLabel);
          if (priorityLabel) meta.push(priorityLabel + " priority");
          if (ticket.unit) meta.push("Unit " + ticket.unit);
          if (ticket.category) meta.push(ticket.category);
          const head = meta.join(" · ");
          const body = ticket.desc ? " — " + clip(ticket.desc, 400) : "";
          description = clip(head + body, 480);
        }
      }
    }
  } catch (e) {
    // Fall through with the generic defaults.
    console.warn("share-preview: ticket load failed:", e && e.message);
  }

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">

<!-- Open Graph (Facebook, WhatsApp, LinkedIn, iMessage, Slack, Teams, …) -->
<meta property="og:type" content="website">
<meta property="og:site_name" content="Park Manor Body Corporate">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(imageUrl)}">
<meta property="og:image:alt" content="Park Manor Body Corporate">
<meta property="og:url" content="${esc(origin + url.pathname + url.search)}">

<!-- Twitter / X -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(imageUrl)}">

<style>
  html,body{margin:0;height:100%;background:#0f1115;color:#e8e8f0;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
  .wrap{min-height:100%;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box}
  .card{max-width:420px;text-align:center}
  .card img{width:72px;height:72px;border-radius:16px;object-fit:cover;margin-bottom:16px;
    box-shadow:0 8px 30px rgba(0,0,0,.4)}
  h1{font-size:17px;font-weight:600;margin:0 0 6px}
  p{font-size:13px;color:#9aa0ad;line-height:1.5;margin:0 0 20px}
  a.btn{display:inline-block;padding:11px 22px;background:#7b68ee;color:#fff;text-decoration:none;
    border-radius:10px;font-size:14px;font-weight:700}
  .spin{width:22px;height:22px;border:2px solid rgba(255,255,255,.2);border-top-color:#7b68ee;
    border-radius:50%;animation:s .8s linear infinite;margin:0 auto 16px}
  @keyframes s{to{transform:rotate(360deg)}}
</style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="spin" aria-hidden="true"></div>
      <h1>Opening ticket…</h1>
      <p>Taking you to the Park Manor ticket. If it doesn’t open automatically, tap below.</p>
      <a class="btn" href="${esc(appUrl)}">Open ticket</a>
    </div>
  </div>
  <script>
    // Real visitors run JS and get forwarded to the live ticket view.
    // Crawlers building the preview card don't run JS, so they stay here and
    // read the Open Graph tags above.
    try { location.replace('${jsEsc(appUrl)}'); } catch (e) { location.href = '${jsEsc(appUrl)}'; }
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      // Short cache: lets platforms re-scrape reasonably fresh cards without
      // hammering the function on every message.
      "cache-control": "public, max-age=60",
    },
  });
}