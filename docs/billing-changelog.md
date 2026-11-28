# Billing changelog

## v2.50 — Clearer "Add to your home screen" steps; the Park Manor site keeps its own name
**Add to your home screen (report page)**
- The steps are rewritten for people who are not technical, one tap per step, each with a small picture of the button to look for.
- **iPhone (Safari):** 1. tap the three dots on the right of the address bar at the bottom → 2. tap Share → 3. scroll down and tap Add to Home Screen → 4. tap Add at the top right → 5. look for the icon. A note covers older iPhones, where the Share button is already on the bottom bar. It still explains that it only works in Safari, with the Copy the link button.
- **Android — Chrome:** three dots at the top right → Add to Home screen (or Install app) → Install / Add → look for the icon.
- **Samsung phones — Samsung Internet:** three lines at the bottom right → Add page to (or Add to) → Home screen → Add, with a fallback if the three lines are not there.
- On Android both sets are shown, the one for the browser in use first. The one-tap Install button still appears when the browser offers it.

**Naming**
- The Park Manor site is back to its own names and icon for the trustees' side ("PM Admin"). The Stoep name and icon from v2.49 are kept aside for the separate Stoep site that will be set up later; nothing on the Park Manor site says Stoep.

## v2.49 — The app has a name: Stoep
- The main app (the trustees' and managing agent's side) is now called **Stoep** when it is added to a home screen, with a new icon: steps up to a door, on the same navy. The install page at `/admin` says Stoep too.
- The residents' page is unchanged: it carries the community's own name ("Park Manor") and the teal icon.
- Icons already on a home screen keep their old name until they are removed and added again.
- Not changed yet: the web address, and the words "scheme" and "body corporate" inside the app. Those follow once the new address is chosen.

## v2.48 — More than one scheme, phase 1: the residents' side
The app already keeps each scheme's data apart (every record carries the scheme's prefix; Park Manor has none). This version makes the residents' side follow the scheme. The full audit and the remaining phases are in the project document *Multi_Scheme_Plan*.
- **Resident links can name their scheme:** `?report&s=<scheme id>`, `?water&s=…`, `?electricity&s=…`. The scheme applies to that page load only — it never changes which scheme an admin has open in the main app. **Park Manor's links are unchanged** (no `&s=`).
- Every resident link the app writes out — in Settings, in the readings reminders, in the home-screen hint — carries the scheme when it is not Park Manor.
- The report page is named after its scheme (header, page title, home-screen wording). The entrance photo shows for Park Manor only.
- Park Manor's own content does not show for another scheme until that scheme enters its own: the managing agent's numbers, the people who get the report emails, the WeconnectU row, the rules, and the standing meter-reading notice. Emergency numbers and City services show for every scheme.
- A link naming a scheme that does not exist shows "This link is not quite right" over the page, so nothing can be sent into a scheme that is not there.
- **Report emails now go only to that scheme's users.** The server used to read the trustees and managing-agent users of every scheme.
- On a scheme's report page, a trustee or managing-agent login from another scheme is refused ("That login is not for …"). An admin login works across schemes.
- Not yet per scheme (see the plan): logins in the main app, meter readings (12 houses assumed), the wording of emails, the embedded bank data, statement details, and the home-screen name and icon.

## v2.47 — Tracker tidy-up: less on screen, nothing taken away
**The tracker tab**
- Each status chip now carries its own count ("Open 3", "On Hold 0" …). The separate row of summary cards under the toolbar is gone — it showed the same statuses and counts a second time.
- The **Readings** button is out of the tracker toolbar; water and electricity readings are in the menu.

**The ticket screen**
- **Header:** ticket number and status only. The clipped copy of the description that sat next to them is gone (the description is the first thing below).
- **Journey line:** one line — how long it has been open, how many events, last activity — plus the "Next:" hint. The row of small step dots and the second "Full timeline" link are gone; the status strip above and the Timeline button already do those jobs.
- **Sub-tickets:** just the heading and the Add button until there are sub-tickets.
- **Next-step panel:** shorter wording ("Work is under way. Mark it Done when it's finished — residents and the reporter are told.").
- **Details:** "Date closed" only appears once the ticket is closed (or has a closed date).
- **Reported by:** the "No users on file to link to" note is hidden when there is nobody to link.
- **On the report page:** the explanations are one line each.
- **Activity log:** starts open, so what residents see is visible straight away. Edit and Delete on each entry are small links instead of two full-width buttons; the note box is full width.
- **"Resync"** is out of the header. It is at the very bottom as "Send this ticket to the server again", next to "Changes are saved as you make them."
- No field was deleted and nothing about saving changed: hidden fields come back when they apply.

## v2.46 — Clearer step names on each issue
- On "Current issues logged", the five steps under each issue now read **Reported · Obtaining quotes · Awaiting approval · In progress · Done** (they were "Quotes" and "Approval", which read as if the quotes were in and the approval given). On a phone the two longer names wrap onto two lines.

## v2.45 — "Approvals" on the report page is now "Awaiting approval"
- The purple row a signed-in trustee sees on the report page is titled **Awaiting approval** instead of "Approvals", so it reads as things still waiting for a decision. Nothing else about it changed.

## v2.44 — A new status: On hold
- **On Hold** is a new ticket status for something that is parked for now — not closed, not being worked on. Choose it in the ticket's Status list from any other status.
- **While a ticket is on hold it is off the report page** ("Current issues logged") **and off the trustees' Approvals list** there. Residents cannot add updates or "Me too" to it in the meantime. Nothing is lost: its quotes, proposals, approvals, photos and log are kept.
- **In the tracker** it has its own filter chip (between Done and Closed, off to start with, like Closed), its own summary card with the count, and its own column in the board view. On-hold cards are greyed, with an "On Hold" badge and the progress strip showing where the ticket was when it was parked.
- **In the ticket** the status strip shows an "On hold" pill in front of the step it was at, and a **Resume** button puts it straight back to that step (for example "Resume — back to Awaiting Trustee Approval"). Resuming does **not** clear the trustee approvals already given.
- On hold cannot be used to skip the approval step: a ticket parked before it had three approvals still needs them before a non-admin can move it to Work In Progress.
- The reporter gets the usual status email ("put on hold for now — you will be told when it is picked up again"), and another when it is resumed.
- The Approvals row on the report page stays as it was in v2.43.

## v2.43 — Trustees approve quotes and proposals on the report page
**Signing in on the report page**
- At the bottom of the report page there is a quiet line: **Trustee or managing agent? Sign in**. Residents never need it; everything they see is unchanged.
- A trustee, an admin or the managing agent signs in with their existing username and password. A device that is already signed in to the main app in the same browser is recognised without signing in again. **Sign out** is in the panel.

**The Approvals row** (purple, under the notices — only when signed in)
- Lists every ticket that is **Awaiting trustee approval**: number, category, unit, title and description, and each **quote**, **supplier quote** and **proposal** on it — supplier, amount, quote number, **View the quote**, how many approvals it has (e.g. "2 of 3") and who gave them.
- A **trustee** taps **Approve**, is asked once in place, and the approval is recorded in their own name — the same approvals list, log line and 3-trustee threshold the main app uses. **Take it back** withdraws it.
- **The third approval moves the ticket to Work In Progress** in the same step. The trustee is told so before confirming; the reporter gets the usual status email. If an item already has three approvals (given in the main app) but the ticket was not moved, a **Move to Work in progress** button does it.
- **Emailing the managing agent:** at that step the people from *Settings → Who at the managing agent gets a report* are listed with tick-boxes — the maintenance person (or the admin-and-billing person for an Admin ticket) and whoever is copied on everything are ticked; change the ticks, or untick all to send nothing. The email says what was approved, the amount, who approved it, and links the quote. The ticket records who was told.
- **Approved — going ahead:** below the waiting list, the tickets approved in the last 90 days, with the chosen item, who approved it and who at the managing agent was told.
- **Admin and managing agent** see both lists but have no approve buttons here. (An admin still records an approval on a trustee's behalf in the main app, as before.)
- Before saving, the newest copy of the ticket is fetched, so two trustees approving close together both count.

**Technical:** `ta.js` in the page; new `functions/approved-notify.js` (`/api/approved-notify`) — it builds the email from the database, only for a ticket that really is in progress with three approvals on that item, and only to addresses in the saved routing list. Nothing in the main app's approval panel was changed.

## v2.42 — One log per ticket: activity log and report-page updates together
**In the ticket editor**
- The **Activity log** now lists everything in one place, newest first: the trustees' own entries *and* whatever came in through the report page (a resident's update, "this has been fixed", a public reply). The separate "Updates" list and "Public reply" box under *On the report page* are gone; a short note there says how many updates residents see and jumps to the log.
- Every entry has a tick **Show on the report page**, the same idea as the photos:
  - an activity-log entry is **not** shown to residents unless a trustee ticks it;
  - anything sent in through the report page arrives **already ticked**; unticking hides it from residents but keeps it in the log (greyed).
- Under the note box: **Also show this note on the report page** — one step to add a note and publish it.
- Entries that are on the report page have a teal edge and an "on the report page" / "from the report page" tag. The line at the top says how many of the entries residents can see, and whether the ticket itself is on the report page at all.
- Editing or deleting a ticked entry (admin) updates or removes what residents see as well.

**Timeline**
- The Timeline button works as before, and **everything that is on the report page is on the timeline automatically** — residents' updates, "reported fixed", and ticked log entries — in date order with the ticket's other events. A hidden update drops off the timeline too.
- "Show on timeline" on an internal entry still works on its own (on the timeline, not on the report page). An entry that is on the report page shows that tick as on and locked; nothing appears twice.
- A closed or private ticket keeps its report-page history in its log and on its timeline.

**Underneath (nothing to migrate)**
- Storage is unchanged: the log stays on the ticket, the public side stays in its own `tpub:` row, so a resident's update and a trustee's save still cannot overwrite each other. A ticked log entry gets an id (`pid`) and its text is kept on the public side under that id.
- `functions/public-tickets.js`: new signed-in actions `publish`, `unpublish`, `hide`, `unhide`, and `GET ?one=<ticket>` (one ticket's public side for the editor, any status). Hidden updates are never sent to the public list. Existing tickets, updates and logs appear as they are: old log entries unticked, old report-page updates ticked.

## v2.41 — Usage: is the report page being used?
**New "Usage" item in the main app** (menu, for admin and trustees)
- Six totals: devices that have opened the report page, active in the last 7 days, visits in the last 7 and 30 days, how many use the home-screen icon, and how many units are recognised.
- **Visits per day** for the last 30 days as a bar chart (tap a bar for the day's count; "Show as a table" underneath).
- **What gets opened** (Emergency numbers, Documents, Current issues logged …) and **What gets done** (numbers tapped to call, documents opened, readings sent, "Me too", updates, reports sent with a name) — times and number of devices.
- **Devices:** one entry per phone or computer browser — kind of device and browser, home-screen icon or browser, first seen, last seen, visits, what it opened and did. **Name this device** adds a name and unit and can leave it out of the resident totals; **Remove** deletes its counts.
- "Residents / Everyone" switch: a device where a trustee or admin is signed in is marked as a trustee's device and left out of "Residents".

**How a device is recognised**
- The page never asks who someone is. A **unit number** shows only when that device has sent a meter reading. Every device shows a four-character **device code** at the bottom of the report page; the same code is on its entry under Usage, so a resident (or you, on your own phone) can say which one is theirs.
- The same person on two devices — or in Safari and on the home-screen icon — counts as two devices.

**What is deliberately not kept**
- No names, no IP addresses or locations, no exact times (days only), no full browser string.
- **A visit in which a report is sent anonymously is removed from the counts**, and nothing more is counted on that page load — so this screen cannot be used to work out who sent an anonymous report.
- A short line at the bottom of the report page tells residents the page is counted.
- Link previews and bots are ignored; links opened with `&test` are not counted; the trustees' app itself is not counted.

**Technical:** `functions/usage.js` (`/api/usage`) and `functions/_usage-shared.js`; one `settings` row per device, key `usage:<device id>`, per complex — no new table. Counting starts when this version is live; there is no history before that.

## v2.40 — A report goes to the right person at the managing agent
**On the report page**
- New category tile **Admin & billing** in "Report an issue" (levies, statements, payments, account queries). In the tracker it is the existing **Admin** category.
- Under **Managing agent** (and under **Both**) in "Who should be emailed right now?" there is now a short list of the people at the managing agent, each with what they handle and a tick-box. The right ones are ticked already, from the category picked:
  - Admin & billing → **Ruaan** (admin and billing) and **Tara** (copied on every report)
  - anything else → **Cheryl** (maintenance and repairs) and **Tara**
- The resident can change the ticks — take Tara off, add Cheryl, and so on. Picking a different category starts again from the usual people. At least one person must be ticked.
- The summary line names them ("Ruaan and Tara at the managing agent are emailed now"), and the ticket's activity log records who was emailed on submission.
- **Admin & billing reports are always private**: the "can everyone follow this on the list?" question is replaced by a note, and the report never goes on the public list.

**The email**
- It is addressed to the ticked person or people; anyone marked "copied on every report" is in Cc, with the resident as before. The email has a "Sent to" line.
- When this is on, a report for the managing agent no longer goes to everyone with the managing-agent role under Users (or `AGENT_NOTIFY_EMAIL`) — only to the people ticked. Trustees, the Park Manor inbox, "Just log it" and meter readings are unchanged.
- The form only sends back addresses; the server uses an address only if it is in the saved list, so the form cannot send mail anywhere else (`functions/_route-shared.js`).

**Settings → Who at the managing agent gets a report → Edit people** (admin)
- A list of people: name, email address and what they handle — **Admin and billing**, **Maintenance and repairs**, or **Managing agent — copied on every report**. Add or remove people; more than one person can have the same job.
- A tick at the top switches the whole thing off (back to emailing everyone with the managing-agent role).
- `settings` key `agent_routing`, per complex. Park Manor starts with Ruaan, Cheryl and Tara until a list is saved; another complex starts empty and behaves as before until its own people are entered.

## v2.39 — Two separate home-screen icons: the report page and the trustees' app
- **The fault:** adding the main app (the tracker) to an iPhone home screen gave an icon that opened the report page. The page source named the report page's manifest, whose start address is `/?report`; the page switched to the admin manifest by script, but the iPhone used the one in the page source.
- **The fix:** the manifest named in the page source (`manifest-page.json`, new) has no start address, so a phone that reads only that one opens the icon on the page it was added from. The script still switches to the full manifest for each side (`manifest.json` on the resident links, `manifest-admin.json` everywhere else), which is what Android uses.
- **New page `/admin`** (`public/admin/index.html`): a small page whose own source carries the admin name ("PM Admin"), the navy icon and the admin manifest. Add *that* page to the home screen for the trustees' app; opened from the icon it goes straight to the main app. Opened in a browser it shows the steps and an "Open the trustees' app" button.
- The residents' icon is unchanged: `/?report`, "Park Manor", teal icon.
- An icon that was added before this version keeps its old start address — remove it and add it again.

## v2.38 — The tracker in the report page's look, and WeconnectU inside the app
**The tracker tab**
- The top of the tab is laid out in four tidy rows: the title with the **New** button, the search box, the status chips, then sort / unit filter / list-or-board / Share overview / Export / Readings. On a phone the chips and tools scroll sideways instead of wrapping into a pile.
- The summary cards and the ticket list use the report page's cards: rounded, bordered, a soft shadow, and a coloured edge (teal, amber for high, red for urgent, green for done and closed, blue for an action item).
- Each ticket card reads top to bottom: number · category · unit · date, the title, one line of the description, the status with Urgent / High / Low and **On the report page** chips, a six-step progress strip (Reported › Quotes › Approval › In progress › Done › Closed), then who reported it, files, notes and the expected date. "Your approval needed" and the other prompts are unchanged.

**The ticket screen**
- Same fields, same behaviour, regrouped into titled cards on the page colour: **Description**, Sub-tickets, the approval / next-step panel, **Details** (status, priority, category, unit, date opened, date closed, and the "requires quotes & trustee approval" tick on its own line), **Reported by** (name, phone, email, Anonymous), **On the report page** (visible to everyone, expected by, photos, me-too, public updates and reply), **Photos and documents**, suppliers, rating and the **Activity log**.
- Every field has the same height, corners and type as the report page; the small typewriter-style labels are gone. Camera / Gallery / Audio sit side by side. On a phone the screen is full width, scrolls as one page and the header buttons share one row.
- The **action item** screen, the "What are you adding?" chooser and the New ticket / New action item sheets have the same fields, labels and cards.
- Nothing about saving, statuses, approvals, sub-tickets, suppliers or emails was changed — this is layout and styling only (`tk.js`, `tk.css`).

**Davies invoices and billing: WeconnectU inside the page**
- Opening the row now tries to show the WeconnectU login inside the report page, so the resident stays in the Park Manor app. A new function, `/api/frame-check`, first asks WeconnectU's server whether it allows being shown inside another site (`X-Frame-Options` / `frame-ancestors`). If it does not, or the check fails, the row shows the **Log in to WeconnectU** button exactly as in v2.37 — no blank box.
- **Settings → Invoices and billing link on the report page → Edit link → "Show it inside the app when the site allows it"** switches the embedding off altogether; the button is always there as well.
- Nothing typed into WeconnectU passes through or is stored by this app; the frame is WeconnectU's own page.

## v2.37 — Davies invoices and billing: a link to WeconnectU
- New row on the report page, directly under Davies contact numbers: **Davies invoices and billing — Log in to WeconnectU**. It is in WeconnectU's red, blue and white (red row, blue icon tile and button, white text).
- It opens in place like the other rows: "For your Davies invoices, statements and billing, please log in to WeconnectU", and a **Log in to WeconnectU** button that opens https://app.weconnectu.co.za/signin in a new tab. It is only a link; nothing is sent to or read from WeconnectU.
- **Settings → Invoices and billing link on the report page → Edit link** changes the title, the wording, the button and the link (https only). Clearing the link hides the row; "Reset to WeconnectU" puts the standard one back. `settings` key `billing_portal`.

## v2.36 — My Smart City links under City services
- **City services** now ends with three links to **My Smart City**, the app for reporting City faults and following them: the website (mysmart.city), the iPhone app on the App Store and the Android app on Google Play. Each has an **Open** button where the other entries have a call button, and opens in a new tab. The note says it is an independent service, not run by the City.
- An entry in the City services list can now have a **link** as well as, or instead of, a phone number or email address (Settings → City services on the report page → Edit numbers). Only https:// links are accepted. The emergency and managing-agent lists stay numbers and email only.
- If the City services list was already edited in Settings, the saved list is shown as saved — add the three links there.

## v2.35 — Fire department in the emergency numbers, and a City services row
- **Emergency numbers** now lists **Fire department** by name: 021 480 7700 (City of Cape Town Fire and Rescue, 24 hours; 107 from a landline). The standard list is Police · Ambulance · Fire department · 112 from a cellphone · City of Cape Town emergency. A list that was already saved in Settings is shown exactly as saved — add the fire entry there if so.
- New row **City services**, under Davies contact numbers: who to contact when the fault is the City's, not the body corporate's — water and sewerage, electricity, roads and stormwater, Metro Police and Traffic Services, and any other City service. Tap to call or email; the WhatsApp and SMS numbers for water and electricity are shown too. It says plainly that anything inside the complex goes to the trustees with Report an issue.
- The numbers are the ones on the City of Cape Town's own pages (Contact us; Submit a service request; Fire and Rescue Service), checked 26 November 2026.
- **Settings → City services on the report page → Edit numbers** changes the title, the line underneath and the entries (`settings` key `city_contacts`).

## v2.34 — A "Done" status, one look for the whole report page, and each issue as its own card
**Done**
- New ticket status **Done**, between Work In Progress and Closed: the work is finished, but the ticket has not been closed yet. It is in the status list in the ticket editor, the progress strip, the filter chips, the summary cards and the board, and it counts as active (shown by default).
- In a ticket that is in Work In Progress the shortcut button is now **Mark as Done**; in a Done ticket it is **Close ticket**. The reporter is emailed on both, as with every status change. Done cannot be used to skip the trustee-approval step.
- On the report page a Done issue shows step 5 of 5 in green and moves to the bottom of the list under a **Done** heading. Residents can still add an update to it ("it is leaking again"); Me too and "This has been fixed" are no longer offered on it.
- **Closing a ticket now takes it off the report page straight away** (it used to stay for 14 days). Its photos stop being served at the same moment.

**The report page**
- Every entry — Emergency numbers, Davies contact numbers, Documents, Report an issue, Water meter reading, Electricity meter reading, Current issues logged, Add to your home screen — is now the same kind of row: an icon in a rounded tile, a title, one line underneath and an arrow that turns when it is open. Same height, width, corners, spacing and type; the colours are unchanged (red, green, white, teal, blue, amber).
- The two meter readings are full-width rows like the rest, and each form opens directly under the row that was tapped.
- **Current issues logged:** each issue is its own card with a border, a shadow and space around it, and a coloured edge (teal, red for urgent, green for done). The number, category, unit and date sit in a small line above the title; Me too is a footer on the card.

## v2.33 — A clearer issues list (steps, latest update, expected date, photos) and a fix to "Add to home screen"
**Current issues logged**
- **Progress steps.** Each open issue shows five steps — Reported · Quotes · Approval · In progress · Done — with the current one highlighted, in place of the single status label. (Urgent and "Reported fixed" labels stay; closed issues keep "Closed".)
- **Latest update on the row.** The newest update and when it was posted ("Plumber booked for Friday · 2 days ago") show without opening the issue.
- **Expected date.** In the ticket editor, under "Visible to everyone", a trustee can set **Expected by**. Residents see "Expected by Fri, 5 Dec", or "Was expected by … — running late" once the date has passed.
- **Photos, chosen by a trustee.** The same block lists the ticket's photos, each with **Hidden / Show / Show: After**. Nothing is shown until a trustee chooses it — that includes every existing ticket. Shown photos appear as a small picture on the row and a strip inside the issue; a tap enlarges one. "After" marks the photo of the finished job, which leads on a closed issue. Up to six per issue; only JPEG, PNG, WebP and GIF; videos and documents are never offered.
- The report form now tells residents that a trustee may show their photo on the list, and asks them to keep faces, number plates and the inside of their home out of the picture.
- Server: `functions/public-tickets.js` serves an approved photo at `/api/public-tickets?photo=…&p=…` only while the issue is on the public list and that photo is ticked. Ticket fields: `expectedBy`, `publicPhotos`, `afterPhotos`.

**Add to home screen**
- After **Install Park Manor** on Android the page now says "Park Manor is being added… look for the icon on your home screen or in your list of apps" instead of the button simply disappearing; if the browser's prompt is declined it says so and keeps the menu steps.
- The menu steps (⋮ → Add to Home screen) are always shown under the Install button, with a note to open the page in Chrome first if it opened inside WhatsApp.
- iPhone: the steps now say plainly that it only works from Safari and has to be done by hand, cover the newer layout where Share is under ⋯, and offer **Copy the link** for pasting into Safari.
- "Don't show this again" folds the hint to one small line at the bottom instead of removing it, so it can always be brought back.
- The app settings files are now `manifest.json` and `manifest-admin.json` (the `.webmanifest` files were being served as a generic download type).

**Housekeeping**
- The old "Import bank statements" help box no longer prints the statement password in the page.

## v2.32 — The report page can be added to the home screen like an app
- The site now carries an app name, icon and settings file, so a phone can keep the report page as a **Park Manor** icon that opens full-screen, without the browser bar. Nothing comes from an app store, and **the link works exactly as before** — the icon is an extra way in, not a replacement.
- At the bottom of the report page, on phones and tablets only, there is a rolled-up **Add Park Manor to your home screen** button. It opens the steps for that phone: on iPhone, Share → Add to Home Screen → Add; on Android, the ⋮ menu → Add to Home screen / Install app, or a single **Install Park Manor** button when the browser offers one. It is not shown when the page was opened from the icon, and "Don't show this again" removes it on that phone.
- The resident links (`?report`, `?water`, `?electricity`) install as **Park Manor** (teal icon) and open the report page. Any other page — the trustees' app — installs as **Park Manor Admin** (navy icon) and opens the tracker.
- Staying current: there is no offline copy, so the icon always loads the build that is live. When the page is brought back after being put away for more than a minute it re-reads the notices and the issues list, and if a newer build has been published it reloads itself, but only when no form is open.
- New files in `public/`: `manifest.webmanifest`, `manifest-admin.webmanifest`, `app-icon-180/192/512.png`, `admin-icon-180/192/512.png`. Nothing to set up in Supabase, Netlify or the Drive script.

## v2.31 — Notices at the top of the report page
- A **Notices** card now sits at the very top of the report page, above Emergency numbers. It is always in view (it does not roll up) and disappears when there is nothing to show.
- **Settings → Notices at the top of the report page → Edit notices** (admin or trustee): each notice has a first line, optional detail, and an optional **Show until** date. With a date it shows up to and including that day (South African date) and then drops off by itself; without one it is a standing notice. New notices go on top; up to 10.
- Until a list is saved, one standing notice shows: **Meter readings: 15th to 18th of each month**. Once a list has been saved it is used exactly as saved, so removing every notice leaves the top of the page empty.
- Stored in `settings` under `report_notices` — nothing to set up in Supabase, Netlify or the Drive script.

## v2.30 — "Me too" on current issues, and a Documents button
- **Me too.** Every open issue on the report page has a **Me too** button. One tap adds the resident to that issue instead of logging it again; a second tap takes it back. The line next to it shows how many have it ("3 other residents have this too").
  - No login. The phone keeps a random id so it counts once, and remembers which issues it ticked.
  - Everyone sees only the count. In the tracker, the ticket shows the count to trustees, plus unit numbers where the phone remembered one from a meter reading.
  - No email is sent for a Me too. Closed issues have no button. At most 60 per issue.
  - Stored with the public updates (`tpub:<ticket>` in `settings`, field `metoo`), so saving a ticket in the tracker never wipes it. Server: `functions/public-tickets.js`, actions `metoo` / `unmetoo`.
- **Documents.** A new **Documents** button sits under Davies contact numbers and opens in place like the others. It lists the **Conduct rules** (CSOS approved 23 November 2023) and the **Management rules**; a tap opens the PDF.
  - The two PDFs ship with the site in `public/documents/`. They are the copies Azure emailed on 30 April 2026; the scanned management rules were reduced from 7 MB to under 1 MB (black and white, same pages) so they open quickly on a phone.
  - Admins can add, rename or remove documents in **Settings → Documents on the report page**. A link must start with `https://` (for example a Google Drive file shared as "Anyone with the link") or be a file on the site.
- Typing an update in one issue is no longer lost when another part of the list refreshes.

## v2.29 — Current issues logged starts rolled up
- When the report page opens, **Current issues logged** is now rolled up like the other sections. The title still shows how many are open (for example "Current issues logged · 2 open"); tap it to see the list, tap again to close it.

## v2.28 — Current issues logged rolls up too
- The **Current issues logged** card on the report page now rolls up and down from its title, like the other sections. It starts open; the title always shows how many are open, so the count is visible even when it is rolled up.

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
