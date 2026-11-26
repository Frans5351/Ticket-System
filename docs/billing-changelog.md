# Billing changelog

## v2.27 — the report page is now a menu; everything opens in place
- The report page (`?report`) shows, top to bottom: **Emergency numbers** · **Davies contact numbers** · **Report an issue** · **Water meter reading** and **Electricity meter reading** · **Current issues logged**.
- Every button works the same way: tap it and its content opens underneath; tap it again and it closes. Nothing leaves the page.
  - **Report an issue** opens the form (steps 1–5 and Send my report), which used to be on the page all the time.
  - **Water / Electricity meter reading** open their forms in place instead of replacing the page. They have left the category tiles inside the report form.
  - Only one form is open at a time. Opening a meter form while a report is half-written keeps the report — text and photos — and brings it back when the meter form closes. A half-written report also re-opens the form when the page is loaded again.
- **Davies contact numbers** is a solid green button with white text; **Report an issue** is the main teal button; the meter buttons are tinted blue and amber.
- **Current issues logged** (renamed, with the number open) stays on the page in a bordered card.
- The dedicated `?water` and `?electricity` links are unchanged.

## v2.26 — Davies contact numbers on the report page
- A second button under Emergency numbers: **Davies contact numbers** — who at the managing agent deals with what, with tap-to-call and tap-to-email.
- Starting list, as set out by the portfolio manager by email on 20 November 2026: **Ruaan Rossouw** and **Myolisi** — accounts (levies, water and electricity charges, payments, statements, general account queries); **Cheryl** — maintenance, repairs, insurance and related operational issues. All on the office line 021 419 5392; office hours Monday–Thursday 08:30–17:00, Friday until 16:00.
- **Settings → Managing agent contacts on the report page → Edit contacts** (admin): change the button title, the line under it (office hours), and each contact's name, phone, email and what they deal with. Up to 20; an entry needs a name plus a phone number or an email.
- Emergency numbers are unchanged and edited the same way. Stored in the `agent_contacts` and `emergency_contacts` settings.

## v2.25 — emergency numbers on the report page
- A red **Emergency numbers** button at the top of the report page (`?report`). It opens a list; tapping a number dials it on a phone (`tel:` link).
- Standard numbers until a list is saved: Police 10111 · Ambulance 10177 · Any emergency from a cellphone 112 · City of Cape Town emergency 021 480 7700 (checked against the Western Cape Government and City of Cape Town pages, November 2026).
- **Settings → Emergency numbers on the report page → Edit numbers** (admin): add, change or remove entries — name, number, optional note — up to 20, or reset to the standard four. Stored in the `emergency_contacts` setting; no deploy needed to change them.

## v2.24 — Electricity Reading on the report page; last photo from Google Drive
- **Electricity Reading** tile on the report page (`?report`), next to Water Reading. It opens the same electricity form as the `?electricity` link (with a way back to the report form). It can never become a ticket.
- **"Last reading" panel, with Google Drive as the fallback.** When a meter has no reading in the app for this month, the form looks in `Park Manor Electricity Meter Readings` for the newest photo of that meter (`Unit N…` / `Main Meter…`, newest dated folder first) and shows its date, with **Show the photo**. If that photo is from this month the panel says the reading is on file; if it is older it says none has come in this month and shows the last one.
- Needs version 5 of the Google script (paste `docs/water-readings-drive.gs`, put the password back, Deploy → Manage deployments → New version; the `/exec` link then shows `"v":5`). Until then the panel simply shows what is in the app.
- Server: `/api/water-reading` actions `elecLast` and `elecPhoto` (no login; only electricity meter photos can be fetched, and only by the id the first call returned).

## v2.23 — report form: a guided "how should we handle it?" flow
- The single "urgent" tick box is replaced by a short flow where each answer opens the next question:
  - **Do you want to give your name?** (in "Where & who") — *Yes* shows the name, email and phone fields; *Stay anonymous* hides them and nothing is recorded.
  - **Who should be emailed right now?** — *Just log it* (no email), *Managing agent*, *Trustees*, or *Both*.
  - **It's urgent** — appears only when someone is being emailed; marks the email URGENT and the ticket's priority Urgent.
  - **Can everyone follow this on the list?** — *Yes, show it* or *No, keep it private* (trustees and managing agent only).
  - A one-line summary of what will happen sits above the Send button.
- Whatever is chosen, the report is always logged on the tracker.
- Emails: *Managing agent* = users with the managing-agent role (plus `AGENT_NOTIFY_EMAIL`); *Trustees* = trustee users plus the Park Manor inbox; *Just log it* sends no email at all. Anonymous reports say so in the email.
- The ticket stores `notify`, `anonymous` and `public`. Older copies of the form still work as in v2.22.

## v2.22 — report page: current issues for everyone, and an "urgent" tick box
- **Current issues list on the report page (`?report`), no login.** Every public ticket that is still open is listed with its status; closed ones stay for 14 days under "Sorted in the last 14 days". Tap one to read the description and updates.
- **Residents can add an update and say "This has been fixed".** That flags the ticket ("Reported fixed") and emails the Park Manor inbox; a trustee confirms by closing it, or chooses **Not fixed yet**. Residents cannot close a ticket themselves.
- **What is shown:** number, title, category, unit, status, dates, description and public updates. Never the reporter's name, phone or email, the activity log, quotes or photos (the server strips them — `functions/public-tickets.js`).
- **Which tickets are public:** everything logged through the report page; a ticket made in the tracker only when **Visible to everyone on the report page** is ticked in the ticket editor. The same box hides a public ticket. Meter readings, action items and sub-tickets are never listed.
- **🚨 This is urgent** tick box on the report form. Ticked: all trustees and the managing agent are emailed at once (subject starts "URGENT") and the ticket's priority is Urgent. Not ticked: only the Park Manor inbox is emailed and the report shows on the list. (If no inbox is set up, everyone is emailed as before.)
- **Tracker:** a bar at the top lists tickets residents say are fixed; the ticket editor shows the public updates, the "reported fixed" note, and a box to post a public reply.
- Public updates are stored separately from the ticket (settings rows `tpub:<ticket id>`), so saving a ticket in the tracker can't overwrite a resident's update. No new table, no SQL to run, no new Netlify settings.

## v2.21 — electricity link on the Settings page
- Settings → public links: the **Electricity meter reading link** (`…/?electricity`) is listed under the water link, with **Copy** and **Open**. It is shown and hidden together with the other public links.

## v2.20 — a meter photo is never dropped for being too big
- **Fix (water and electricity forms, including the Water Reading tile on the report link):** photos used to be attached to the email only while they fitted a size budget; any that didn't were left out of the email ("too large… view in the tracker") **and** were not stored or filed in Drive. Now every photo is resized until all of them fit, so each one is emailed, stored on the reading and filed in Drive. Tested with five 6.6 MB photos.
- If filing still fails for any reason, the reading says "not filed: …" in the list and offers **Save to Drive** again, instead of failing silently.
- A file the phone can't read as a photo (a video, some file types) is named in a clear message before anything is sent.
- Emails about meter readings no longer mention the ticket tracker; they point to Water / Electricity readings in the app.
- Safeguard: the general report form can no longer create a ticket with the category Water Reading — it always hands over to the water form. The tile and the `?water` link run the same code.

## v2.19 — electricity meter readings (form, register, Drive, photo reading)
- **New link `?electricity`** — a walk-round form: tap the meter (1–12 or **Main meter**), take the photo, send. Meters already read this month show a tick and the next unread meter is selected after each send. Optional typed reading and note. No "email me a copy" step. The "Email this reading to the managing agent" tick box behaves as on the water form (shown when signed in or with `&test`).
- **Each reading is emailed** to the managing agent and the Park Manor inbox (not the trustees), subject `⚡ Electricity meter reading — Unit 7`, photo attached.
- **Drive:** photos are filed in the existing structure, `Park Manor Electricity Meter Readings / 15 November 2026 / Unit 7.jpg` (`Main Meter.jpg` for the main meter). A month's readings go into that month's existing dated folder; the first reading of a new month creates one named after that day.
- **Electricity readings** in the sidebar and burger menu (admin, trustees, managing agent): one line per meter per month from September 2026, usage since the previous month, photo, Drive link, reading taken from the photo to confirm, agent status, edit / add by hand, "To billing".
- **Existing photos:** the register lists photos already in the month's Drive folder(s) that aren't on the list (September, October, November) and adds them as readings dated by the folder name.
- Readings typed on the Billing meters tab count here too; readings that came with imported Davies invoices don't.
- Needs: `ELECTRICITY_READINGS_SETUP.sql` run once in Supabase, and version 4 of the Google script (paste `docs/water-readings-drive.gs`, put the password back, Deploy → Manage deployments → New version). No new Netlify settings. Until the script is updated, electricity photos are not filed (nothing is misfiled) and the app says so.
- Built from the water module by `gen_er.py` (same code with names, table, labels and units swapped), so fixes to one carry to the other.

## v2.18 — the unit lookup shows the photo whenever one is on file
- **Fix:** when a house had two readings on the same day — one typed on the Billing meters tab and one that came with a photo — the residents' lookup showed the Billing one, which has no photo. It now ranks the same way as the Water readings list: by the reading's date, and on the same day the one that arrived with a photo first.
- If the newest reading was typed in without a photo, the lookup shows the most recent photo on file for that month beside it, captioned with the photo's date.

## v2.17 — "the managing agent has this reading" can be set by hand
- Each reading in Water readings now has an **Agent** line: *emailed by the app*, *sent outside the app · marked by <name>*, or *not sent yet*.
- Edit a reading (the latest or any earlier one) and tick **The managing agent has this reading** if it was sent to them another way, e.g. by email or WhatsApp. Untick to undo. Readings the app emailed itself are shown ticked and locked.
- New readings captured by hand can be ticked the same way when they are added.

## v2.16 — Water readings list shows the newest reading, and all of them
- **Fix:** a house's entry is now chosen by the reading's own date. Before, a reading typed on the Billing meters tab (e.g. dated the 8th) could sit on top of a photo the resident sent later, because Billing readings were time-stamped when they were copied into the list rather than when they were taken. On the same day, a reading sent with a photo ranks above the Billing copy.
- **Every reading of the month is shown** under the house ("Also this month"), each with its date, reading, how it arrived, photo thumbnails and Drive link — not just a count. Any of them can be edited or removed (Billing-tab readings are changed in Billing).
- **Fresh every time:** opening Water readings always reloads from the database, so readings that came in while the app was open appear without pressing ↻.

## v2.15 — residents can get a copy of their water reading by email
- Water reading form (`?water` and the Water Reading tile): new optional step 4, **Email me a copy**. If an address is filled in, the resident is emailed their reading as a record — unit, date and time received, what they typed, and the photo attached. The address is remembered on that device.
- The copy is a separate email (`functions/send-edit-link.js`), not a CC, so the managing agent's addresses aren't shown to the resident. Replies to it go to the Park Manor inbox. The agent's email still names the resident's address and replies from the agent go straight to them.
- Test mode (email box unticked): the managing agent and Park Manor inbox are skipped as before, but a copy still goes to the address typed, so the copy can be tested on its own.
- The page says whether the copy went out; the register shows "Copy: emailed to …" on the reading. A copy that can't be delivered never blocks the reading itself.

## v2.14 — photos dropped into Drive are picked up; status panel uses only the readings table
- **Photos added straight into the Drive folder.** Water readings checks `Park Manor Water Meter Readings / <Month Year>` each time it is opened (and on ↻). Photos it doesn't know yet are listed with **Add them to the list**: the house comes from the file name (`Unit 3.jpg`), the date from when the file was added, the meter is read from the photo for confirmation, and the Drive file is linked (nothing is uploaded twice). Files with other names can be assigned to a house or skipped. Needs version 3 of the Google script (`docs/water-readings-drive.gs`: paste, put the password back, Deploy → Manage deployments → New version).
- **Residents' status panel** ("when did you last get my reading?") now reads only the `water_readings` table. Old tick marks kept in settings — some copied from Davies invoice dates such as 1 November — are no longer shown.
- **Register clean-up** (once, on opening): ticks copied from the Billing meters tab before the table existed are dropped (genuine Billing readings are re-derived), and ticks made by hand become proper readings.
- "Save to Drive & read" on a reading that is already in Drive only reads the photo; it no longer uploads a second copy.
- Server: `/api/water-reading` gains `driveList` / `driveGet` (trustees, admin and managing agent only — checked against the signed-in session when `PASSKEY_JWT_SECRET` is configured). The script only serves files inside the water readings folder.

## v2.13 — date and time in the Drive file name
- Water-meter photos are filed as `Unit N - 16 Nov 2026 21h35.jpg` (when the reading reached the app, South African time) instead of plain `Unit N.jpg`. Needs a one-line change in the Google script plus a New version of its deployment; until then files keep the old name and nothing breaks.
- `WATER_READINGS_SETUP.sql` now also switches row-level security off on `water_readings` and grants the app access, matching the other tables (the cause of "test reading could not be saved").

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
