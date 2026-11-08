PARK MANOR — BILLING PAGE, MOBILE REDESIGN
===========================================
Deploy: replace public/index.html in your Ticket-System repo with the one in this zip
(pm-weconnectu.js and pm-mapper.js are unchanged — keep them next to index.html), then push.

WHAT'S NEW (Billing / Levies page)
- Phone-first layout: each unit is a card (door, owner, balance, levy, call / email / print buttons);
  on desktop it's a table.
- Search (unit, owner, email, reference), filter chips (All / Owing / In credit / Settled / No email / Garages),
  sort (unit number, highest balance, owner, levy). Your filter and sort are remembered.
- Summary tiles at the top; "⋯" menu with Import PDFs, Generate invoices, Export register (CSV), reload actions.
- Unit editor is now a full-screen sheet on phones with tabs: Overview · Statement · Invoices · Meters · Details.
  Sticky Save bar, "Unsaved changes" indicator and a keep-editing/discard prompt.
- Phone Back button / swipe-back closes the open sheet or dialog instead of leaving the app.
- Native pop-up alerts replaced by proper bottom-sheet dialogs, progress bar and toasts.
- Import PDFs is now a 3-step flow (Choose → Review → Apply) with big tap targets; files parse as soon as chosen.
- Names in ALL CAPS from Davies are shown in Title Case; phone numbers formatted (display only — data unchanged).

BEHAVIOUR FIXES
- "Generate invoices" now skips garages (sections 13+), per the billing rule: only doors 1–12 are billed.
- "Reload units from schedule" no longer wipes imported / generated invoice data.
- Duplicate section numbers are blocked on save.

Tested headlessly at 320 / 375 px phone, tablet and desktop widths, light and dark themes: no horizontal
overflow, all tap targets >= 44px, 0 issues.
