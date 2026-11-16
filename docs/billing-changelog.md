# Billing changelog

## v2.12 — test a water reading without emailing anyone
- Water reading form (`?water` and the Water Reading tile): a tick box **Email this reading to the managing agent**, ticked by default. Untick it and nothing is emailed; the reading is still saved, the photo filed in Google Drive and the meter read from it. The register marks such a reading "test, not emailed".
- The box only appears when someone is signed in to the app on that device, or the link ends in `&test` (e.g. `…/?water&test`). Residents never see it, so their readings are always emailed.
- After a test send the page shows exactly what happened: saved or not, the Drive file (or why it wasn't filed), and what the photo was read as (or why not).
- Zip carries complete folders (as from v2.11).

## v2.11 — repair: complete folders
- No app changes. The v2.10 zip carried only the changed files, and replacing the `functions/` folder with it in Finder removed the other 17 server functions, so the Netlify build failed (`Could not resolve "./_passkey-shared.js"`). This zip carries the **complete** `functions/`, `public/` and `docs/` folders, so replacing those folders is safe. It also restores `public/park-manor-entrance.jpg`, `public/deploy.txt` and the architecture docs that went missing the same way.
- From now on every zip contains complete folders.

## v2.10 — residents see the photo on file
- Water form status panel: the photo that goes with the reading shown (this month, else the last one) appears beside the date and reading; tap to enlarge. Served from the copy in the database (Drive files are private).


## v2.9 — water photos to Google Drive; meter read from the photo
- New server function `functions/water-reading.js` + Apps Script `docs/water-readings-drive.gs`: every water-meter photo (from the forms or attached in the register) is filed as `Park Manor Water Meter Readings / <Month Year> / Unit N.jpg`, and Claude reads the meter from the first photo. Setup in `docs/WATER_PHOTOS_SETUP.md` (three Netlify env vars).
- Register: Drive link per reading; "The photo reads X (confidence)" suggestion with **Use**; a flag when the typed reading and the photo disagree; **Save to Drive & read** for older entries; chips showing whether each feature is on.
- Public form: after sending, the resident sees that the photo was filed and what the meter was read as (to be confirmed).


## v2.8 — imported invoice readings never count; Water readings in the sidebar
- Meter rows that came in with a Davies invoice (dated by the invoice, e.g. 1 November) are recognised even without an invoice number on the row — by matching the reading to the imported invoice — and never count as a reading received. Rows an earlier build wrongly ticked off are removed the next time the register is opened. On the Meters tab they are labelled "Davies invoice · billing date".
- "Water readings" is now an item in the desktop sidebar as well as the burger menu (admin, trustees, management).


## v2.7 — Billing meter readings count as received
- A water reading saved on a unit’s Meters tab in Billing (or captured on an invoice issued here) now ticks that house off on the Water readings register and shows as received on the resident’s status panel. Readings that arrived with imported Davies invoices do not count. Deleting the reading in Billing takes the tick off again.
- Existing Billing readings are picked up the next time the register is opened.


## v2.6 — residents see when their reading was last received
- Water form (`?water` and the Water Reading tile): typing the unit number shows whether this month has been received and the date/reading of the last one on file, including readings captured by hand in the register. The unit is remembered on the device.
- Form submissions now store every attached photo (shrunk) plus the full message, and are dated in local time.


## v2.5 — capture water readings by hand
- Water meter readings register: **Add reading** per house (or from the footer with a house picker): type the reading, set the date, attach up to 3 photos (camera or gallery), add a note. Stored alongside the form submissions.
- Any entry can be edited (e.g. type in the reading from a photo that came through the form) or removed; the row shows who captured or edited it and the usage since last month.
- Also reachable from the burger menu (Water readings) for admin, trustees and management.
- Readings load one month at a time and stored photos are shrunk, so the screen stays fast.


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
