# Billing module (levies, invoices, statements)

The Billing tab is the body corporate's own levy-billing system. It runs in
parallel with the managing agent (Davies / WeconnectU) for now: every month the
Davies invoices and statements are imported and treated as the **gold standard**,
and the app proves it can produce the same documents itself. The aim is to take
the billing in-house once a few months reconcile.

All code lives in `public/index.html` (`<style id="bl-css">`, `<script id="bl-ui">`
= register/unit sheet/dialogs, `<script id="bl-ui2">` = engine, PDFs, invoice
lifecycle, monthly run, settings) plus the pure importer modules
`public/pm-weconnectu.js` (PDF text → documents) and `public/pm-mapper.js`
(documents → per-unit updates, Park Manor rules).

## Rules that are baked in

- Only **doors 1–12** are invoiced. Sections 13–20 are garages/stores: never a
  separate invoice; the owner's main unit carries a "Garage Levy" fixed line.
  Door 19 (KOE002) postings fold onto door 10 on import.
- **Imported Davies documents are read-only.** Re-importing the same invoice
  number replaces it; earlier months are kept. The imported statement replaces
  the unit's ledger whole (anything the app posted that Davies doesn't show is
  reported in the import notes, and still exists under the unit's Invoices).
- **Drafts** (`u.invoices[]` with `status:'draft'`) have no number and are not
  on the statement. Edit or delete freely.
- **Issued invoices** (`status:'final'`) are numbered, posted to the ledger and
  locked. Corrections are credit notes (full or partial), optionally followed by
  a new invoice. They can be re-emailed any time.
- Numbers continue from the highest on file, Davies' included
  (`INV00093` follows `INV00092`; credit notes `CRN00004`…), so owners'
  statements stay continuous. Prefix/padding are settings.
- Anomalous municipal readings are billed as they come; corrections are credit
  notes later (that is how Davies handled door 9's solar credits).
- **Instalments** ("Backdate 2026 payment n of N") count from the documents on
  file — the highest *n* on an imported Davies invoice or an issued (not fully
  credited) app invoice — never from a stored counter. Deleting a test draft or
  crediting a test invoice winds the plan back by itself. The current plan
  recovers the fixed water/sanitation charges missed July–October 2026 over
  three months from November (trustees' decision of 30 Oct 2026; split kept on
  Azure's historic ratio, not PQ).

## Data (all under `settings.units` → `UNITS[unit_N]`, plus two settings keys)

```
unit.chargeLines[]   { id, kind:'fixed'|'instalment'|'water'|'sewer'|'elec',
                       account, desc, amount, active, from?, to? (YYYY-MM),
                       of?, paid? (instalments), source, since }
unit.meterReadings[] { date, water, wDate?, elec, eDate?, src }
                     wDate/eDate = real meter dates when they differ from the row
                     date (imported rows: row = usage-period end, src = INV no.)
unit.importedInvoices[] { invoiceNo, date, due, total, reconciles,
                       lines:[{kind, account, description, desc, amount, period?, meter?, inst?}] }
unit.invoices[]      { id, status, month, date, dueDate, no?, seq?, lines[], total,
                       reading?, warnings?, touched?, finalizedAt?, sentAt?, sentTo?, emailOk? }
unit.creditNotes[]   { creditNoteNo, date, total, appliesTo, lines[], reason?, generated? }
unit.statement       { ref, asOf, ageing, ledger:[{date, src, desc, debit, credit, inv?, crn?}] }
settings.billing_settings  letterhead, bank, numbering, invoice.cc, footer  (BL_SETTINGS)
settings.billing_tariffs   [{ id, from, label, water.steps[], sewer.steps[] + capKl, elec.rate }]
```

`unit.charges{adminLevy,maintLevy,csos}` is kept in sync from the schedule for
older code and the register. `blSchedule(u)` creates `chargeLines` on first use
from the newest imported invoice (or the legacy charges).

## How a month works

1. **Import** the Davies PDFs (⋯ → Import PDFs). Each unit's schedule is
   re-learned from its newest invoice: fixed lines keep their amounts, metered
   lines are marked, "payment n of N" lines become instalments with the counter
   set. Readings and periods come along; the statement replaces the ledger.
2. **Monthly run** (⋯ → Monthly invoice run): month → readings for every house →
   a draft per house (warnings for missing readings, negative or unusually high
   usage, no email) → finalise & send. Drafts are saved, so the run can be left
   and resumed. Single units: Overview → New invoice.
3. **Finalise** = next number, ledger posting (one line, or one per charge line
   when the unit's "breakdown" box is ticked), reading stored, instalment
   counters advanced, invoice + statement PDFs built and emailed
   (`/api/send-email`, same Brevo function as tickets), result recorded on the
   invoice (`sentAt`, `emailOk`). Failures leave the invoice issued; use Resend.

## Shared charges & recoveries (⋯ menu)

One screen for every charge raised on all the houses at once (`settings.billing_plans`,
`BL_PLANS`). A plan has a kind (every month / N instalments / once), a scheme-wide
total and a split basis: **participation quota** (`unit.pq`), **equal**,
**fixed-charge ratio** (`unit.fixedRatio` — Azure's historic water/sanitation
split, kept by trustee decision 30 Oct 2026; Park Manor's figures are built in as
`PARK_MANOR_FIXED_RATIO`), **manual** per house, or the **CSOS rule** (2% of the
house's monthly levy above R500, capped at R40 — matches Davies to the cent).
Cents are balanced with the largest-remainder rule so shares add up exactly.
Applying writes one line per house onto its charge schedule tagged `planId`
(adopting an existing identical line instead of duplicating it); removing a plan
takes the lines off. Instalment progress is counted from issued invoices, so
plans survive edits and re-imports. "Adopt existing" turns the lines learned
from the Davies invoices into plans with their current amounts kept as manual
splits — nothing on the next invoice changes until you choose a basis.

Billing settings → **Quotas & splits** edits each section's PQ and fixed-charge
ratio (totals must be 100) and the default bases (`BL_SETTINGS.split`:
levies by PQ, municipal fixed charges by ratio — Park Manor's current rules).

## Tariffs

`BL_TARIFFS` holds one era per municipal year (in force from a date; picked by
the usage period's end date). Water is stepped per kL; sewerage is stepped per
kL of water with the City's 70% rule folded into the rates and a cap;
electricity is a flat rate per kWh (the municipal service charge is a separate
fixed line on each house, split equally by Davies).

The shipped defaults were fitted to INV00001–INV00092: **water and electricity
reproduce Davies to the cent on every invoice**; sewerage is within a few rand
(median R2.22 — Davies appears to use a slightly different consumption figure
for sewerage), so sewerage lines are labelled *estimate* and can be overridden
on the draft. Settings → Tariffs → "Check tariffs against the imports" recomputes
every imported metered line and reports matches. Pre-October-2026 electricity
lines include the service charge; the check says so instead of flagging them.

## Access

Users → "Tabs this user can see" → Billing (Viewer / Trustee / Management).
"Billing is view only" (default) hides every write control and locks fields
(`body.bl-ro`, `blRO()` guards on the write functions). Admins always have full
access. This is UI-level only — there is no RLS on Supabase.

## Known gaps / next steps

- Sewerage tariff fit is approximate (see above).
- Payments still arrive via the imported Davies statements; once Davies is
  switched off, payments must be captured on the Statement tab (or a bank
  import built).
- Interest on arrears, levy clearance certificates and year-end roll-over
  aren't modelled yet.
