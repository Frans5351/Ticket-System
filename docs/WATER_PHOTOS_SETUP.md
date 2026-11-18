# Water meter photos: Google Drive filing + reading the meter from the photo

Both are optional and independent. Until they're set up the app works as
before; the readings register shows which are on.

## What happens once it's on

- Every water reading sent through the app (the water link, or the Water
  Reading tile on the general form) and every photo attached by hand in the
  register is filed in Google Drive as

      Park Manor Water Meter Readings / November 2026 / Unit 3.jpg

  (a second photo that month becomes `Unit 3 (2).jpg`). The folder is created
  next to "Park Manor Electricity Meter Readings". The register links to it.
- The first photo is read by Claude and the result is stored as a
  **suggestion**: "The photo reads 1480.25 kL (high confidence)" with a
  **Use** button. It never overwrites a typed reading; if the typed reading
  and the photo disagree by more than 0.5 kL the row is flagged.
- Entries captured before this was switched on get a **Save to Drive & read**
  button in the register.

## Part 1 — Google Drive (about 5 minutes)

1. Sign in to Google with the account whose Drive holds the electricity folder.
2. https://script.google.com → **New project**.
3. Paste the whole of `docs/water-readings-drive.gs` over the sample code.
4. Change `SECRET` near the top to a long password you make up.
5. Save, pick **pmTest** in the toolbar, press **Run**, approve the Drive
   permission. The log should say `Folder ready: …`.
6. **Deploy ▸ New deployment ▸ Web app** — Execute as **Me**, Who has access
   **Anyone** — Deploy, copy the URL (ends in `/exec`).
7. Netlify → Site configuration → Environment variables:
   - `WATER_DRIVE_URL` = that URL
   - `WATER_DRIVE_SECRET` = the password from step 4

## Part 2 — Reading the meter from the photo

1. https://console.anthropic.com → API keys → create a key.
2. Netlify → Environment variables: `ANTHROPIC_API_KEY` = the key.
   Optional: `WATER_READ_MODEL` (default `claude-sonnet-5-5`; `claude-haiku-5-5`
   is cheaper, `claude-opus-5-5` more careful). One photo costs well under a cent.

## Then

Netlify → Deploys → **Trigger deploy** (env vars only apply after a deploy).
Open the app → Water readings: the two chips at the top should say **on**.
Send yourself a test reading through the water link and check the Drive folder.

## If something's off

- Chip says "not set up" → the env var is missing or the site wasn't redeployed.
- Row shows "Drive: not filed: …" → the message says why. "did not return JSON"
  means the web app isn't deployed with access **Anyone**; "unauthorised" means
  the two passwords differ.
- "Couldn't read the photo" → blurry / glare / not a meter; type the reading.
- `Claude API 404` in the message → the model name in `WATER_READ_MODEL` is wrong.
- Requires the `water_readings` table (`WATER_READINGS_SETUP.sql`).

## Testing without emailing anyone

Open the water link while signed in to the app on the same device (or add `&test` to the link: `https://park-manor-bc.netlify.app/?water&test`). A tick box **Email this reading to the managing agent** appears above the Send button. Untick it, attach a photo and send: no email goes out, and the page lists what happened —

- `✓ Filed in Google Drive as Unit N - 16 Nov 2026 21h35.jpg` — working.
- `✕ Not filed in Google Drive: Drive script: unauthorised` — `WATER_DRIVE_SECRET` in Netlify differs from `SECRET` in the deployed script (after editing the script: Deploy → Manage deployments → New version).
- `✕ … did not return JSON` — wrong/old `WATER_DRIVE_URL`, or the web app's access is not "Anyone".
- `✕ Photo not read: Claude API 401` — `ANTHROPIC_API_KEY` is wrong; `404` — unknown model name in `WATER_READ_MODEL`.
- "The test reading could not be saved" — the `water_readings` table has not been created; run `WATER_READINGS_SETUP.sql` in Supabase.

Remove test readings afterwards from Water readings → the house → Edit → Remove.

## File names

Photos are filed as `Unit N - 16 Nov 2026 21h35.jpg`: the date and time the reading reached the app, in South African time (a reading captured by hand for another day carries just that day's date). This needs the v2.13 line in the script — if files are still named plain `Unit N.jpg`, the deployed script is the older one: in the script editor replace the `var name = nextName_(…)` line with the one in `docs/water-readings-drive.gs`, save, then Deploy → Manage deployments → pencil → Version: New version → Deploy (the URL and password stay the same).

## Photos you add to the Drive folder yourself

Drop a photo into `Park Manor Water Meter Readings / <Month Year>` named after the house (`Unit 3.jpg`, `House 3.jpeg`, `3.png`). Open **Water readings** in the app (or press ↻): a card says how many photos in the folder aren't on the list yet. **Add them to the list** shows each file with the house it will be recorded against — change it or skip it — then creates the readings, links the Drive file and reads the meter from the photo for you to confirm with **Use**.

- Needs version 3 of the Google script. Opening the `/exec` link in a browser shows `"v":3` when it is deployed. If the app says the script is an older version: paste the whole of `docs/water-readings-drive.gs` into the script editor, put your password back on the `SECRET` line, save, then Deploy → Manage deployments → pencil → Version: New version → Deploy. The URL and the Netlify settings stay as they are.
- "Please sign out and sign in again" — the app needs a fresh sign-in to prove who is asking; sign out, sign in, retry.
- A photo that was removed from the list in the app is not offered again. iPhone `.heic` files are recorded and linked but can't be previewed or read automatically — type the reading in.

## Electricity meter readings

Same Google script, same Netlify settings. Two things to do once:

1. Supabase → SQL Editor → run `ELECTRICITY_READINGS_SETUP.sql` (plain **Run**, not "Run and enable RLS").
2. Google script: paste the whole of `docs/water-readings-drive.gs`, put your password back on the `SECRET` line, save, Deploy → Manage deployments → pencil → Version: New version → Deploy. Opening the `/exec` link then shows `"v":4`.

Use `https://park-manor-bc.netlify.app/?electricity` on the walk-round (also the **Take readings now** button in Electricity readings). Photos land in `Park Manor Electricity Meter Readings / <day Month Year> / Unit N.jpg` and `Main Meter.jpg`.
