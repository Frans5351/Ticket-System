PARK MANOR — BILLING v2: invoicing engine, Davies-layout PDFs, monthly run
==========================================================================
Deploy: copy public/index.html, public/pm-weconnectu.js and public/pm-mapper.js over the
ones in your Ticket-System repo (all three changed), add docs/billing.md, push.
Then: Billing → ⋯ → Import PDFs and re-import everything you have (all months).
The import now merges by invoice number, so importing in any order is fine.

WHAT TO LOOK AT FIRST
- samples/ has an invoice, a statement and a credit note the app generated during
  testing (Davies layout, Park Manor letterhead) — compare with a real Davies one.
- After re-importing, open a unit → Charges: the charge lines learned from its
  November invoice (levies, CSOS, reserve fund, garage levy, service charge, fixed
  basic charges, and the "Backdate 2026 payment 1 of 3" instalments as instalments).
- Unit → Invoices → expand a Davies invoice: "tariff check" recomputes its water /
  sewerage / electricity from the readings. Water and electricity match to the cent.
- ⋯ → Tariffs & rates → "Check tariffs against the imports" does this for all 59.

INVOICE LIFECYCLE (your question — this is what I'd stick to)
- Draft: created from a unit's Overview ("New invoice") or by the Monthly run.
  No number, nothing on the statement. Edit lines, readings, dates; delete freely.
- Finalise: gets the next number (INV00093 after Davies' INV00092 — one sequence
  so owners' statements stay continuous), is posted to the statement, readings
  saved, instalment counters advanced, invoice + statement PDFs emailed.
- Issued invoices are LOCKED. No editing, no deleting — the owner has a copy and
  the statement shows it. To fix one: "Credit note" (full or per line, printed
  reason), then a new invoice if needed. "Resend" re-emails any time.
- Davies imports: read-only. Re-importing the same number replaces it.
- Garages (13+) are never invoiced; the garage levy sits on the main unit.

MONTHLY RUN (⋯ → Monthly invoice run, or the Monthly run button)
  1 Month (defaults to the month after the last invoice on file, dated the 1st)
  2 Readings for every house (previous reading shown; blank = skip that line)
  3 Review: one draft per house with warnings (no reading, reading went backwards,
    usage more than 3× last month or unusually high, no email). Tap to open/adjust.
  4 Finalise & send: numbered in section order, posted, emailed; results listed.
  Leave halfway and the drafts wait for you (also under each unit's Invoices tab,
  and the "Drafts" filter chip on the register).

TARIFFS (⋯ → Tariffs & rates)
  Two years pre-loaded, fitted to the Davies invoices: CoCT 2025/26 and 2026/27.
  Water: stepped 0–6 / 6–10.5 / 10.5–35 / 35+ kL. Electricity: R 3.2206/kWh incl.
  VAT (the service charge is its own fixed line, split equally). Sewerage: stepped
  on the water used, capped — this one is an ESTIMATE (median R2.22 off Davies),
  so the draft marks it "estimate" and you can type the figure from the City account.
  Add next year's tariffs with "Add a tariff year" when the City publishes them.

SETTINGS (⋯ → Billing settings)
  Letterhead (scheme name, reg no, email, phone, address), bank details, invoice
  numbering, optional CC address. These print on every PDF. The Davies address is
  gone; defaults are Park Manor Body Corporate / parkmanorbc@gmail.com — check them.

ALSO
- Reload units from schedule now updates only the Levies / CSOS / Reserve Fund
  lines and keeps everything else.
- Register shows "Fixed / month" (all fixed lines) instead of just the three levies.
- View-only Billing users see everything but can't create, finalise, credit or edit.

Headless tests: full import of all 74 Davies documents, draft → finalise → credit
note, a 12-house monthly run, settings and tariff check, re-import after issuing,
phone (375 and 320 px), tablet and desktop widths, light and dark: 0 issues.
Not yet tried on a real phone or with the live Brevo email — please run one unit
first and check the email that arrives.
