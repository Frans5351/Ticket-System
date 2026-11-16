# Billing changelog

## v2.4 — water meter readings
- General `?report` form: the **Water Reading** tile now swaps to the water-meter form (unit, photo, reading, note) with a way back; same routing as `?water` (managing agent + Park Manor inbox, not trustees).
- Both forms now also save the submission (unit, month, reading, note, up to 2 photos) to a new `water_readings` table — run `WATER_READINGS_SETUP.sql` once in Supabase.
- New **Water meter readings** register (Tracker header 💧 Readings for admin/trustees/management; Billing ⋯ menu): per month from Nov 2026, one row per house, ticked automatically from the forms, mark the rest by hand, copy a WhatsApp reminder of who is outstanding, push a reading into billing.


## v2.3 — quotas: load all 20 sections
- Quotas & splits says exactly why the PQs do not total 100 (which sections are missing or blank) and **Load Park Manor figures** fills PQ and fixed-charge ratio for all 20 sections from the Davies/Azure sheet, creating the garage sections if the register only has doors 1–12. Save, and the warning goes.


## v2.2 — shared charges, quotas & splits
- ⋯ → **Shared charges & recoveries**: set up any charge for all houses at once
  (every month / over N months / once), split by participation quota, equally,
  by the fixed-charge ratio, typed per house, or by the CSOS rule; preview per
  house, apply, and every house's Charges tab is updated. Backdated recoveries
  and special levies are "over N months" plans; progress is counted from the
  invoices issued.
- First open offers to adopt the shared lines already learned from the Davies
  invoices (levies, reserve fund, CSOS, garage levy, service charge, fixed basic
  charges, both backdate recoveries, garden service) with amounts kept exactly.
- Billing settings → **Quotas & splits**: edit each section's PQ and fixed-charge
  ratio (from the Davies/Azure sheet of 29 Oct 2026; totals checked), and the
  default bases: levies by PQ, municipal fixed charges by the ratio.

## v2.1 — instalments counted from the invoices on file
## v2 — invoicing engine (see billing.md)
