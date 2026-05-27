# Park Manor — "Fix Everything" action checklist

This is the short, do-this-in-order list to clear the errors showing in your
browser console (missing Supabase tables, 406s, and the `/api/*` 404s for the
email button and attachments). Full reference detail is in `FULL_DEPLOY_GUIDE.md`;
this file is just the ordered steps.

There are three independent problems. Do them in this order.

---

## 1. Create the missing database tables  (fixes: meetings, resolutions, 406s)

**Symptoms this fixes:** console errors
`Could not find the table 'public.meetings'`, `...'public.resolutions'`, and
`406` errors on flagged / role_permissions / beneficiaries / public_reports_enabled.

**Steps:**
1. Open your Supabase project → **SQL Editor** → **New query**.
2. Open `SUPABASE_TABLES_SETUP.sql` (included), copy its entire contents in.
3. Click **Run**. It's safe to run more than once.
4. Back in the app, **hard refresh** (Ctrl+Shift+R).

The missing-table and 406 errors should be gone. If any 406 remains on a table
that already existed (e.g. tickets), that table has stricter RLS — tell me and
we'll align it.

This step needs **no deploy** — it's pure database, independent of everything else.

---

## 2. Deploy via Git so the functions run  (fixes: ALL /api/* 404s)

**Symptoms this fixes:** `404` on `/api/send-email` (the email button),
`/api/attachments/...` (attachment probe), `/api/send-edit-link`, etc.

**Why:** these `/api/*` paths are served by the Netlify **functions** in
`functions/`. Those functions only get deployed when Netlify **builds from your
Git repo**. If the site was put up by drag-and-drop, only `public/` was uploaded
and the functions never ran — so every `/api/*` call 404s. (The function routing
itself is already correct — each function declares its own `/api/...` path via
`export const config`, so no `netlify.toml` redirects are needed.)

**Steps (you already have the GitHub repo connected):**
1. Make sure the latest files are committed and pushed:
   ```
   cd "C:\park manor"
   git add .
   git commit -m "Add send-edit-link function + Supabase table SQL"
   git push
   ```
2. In **Netlify** → your site → **Site configuration → Build & deploy →
   Continuous deployment**: confirm it's linked to the GitHub repo
   `Frans5351/Ticket-System` (branch `master`). If not linked, click
   **Link repository** and pick it. Build command can be empty; publish dir
   `public`; functions dir `functions` (these come from `netlify.toml`).
3. Trigger a deploy (push, or **Deploys → Trigger deploy → Deploy site**).
4. After it finishes, open **Deploys → (latest) → Functions** and confirm you
   see `send-email`, `send-edit-link`, the `passkey-*` and attachment functions
   listed. If they're listed, routing is live.

---

## 3. Set the email environment variable  (fixes: email actually sending)

Once functions run (step 2), the email endpoints exist — but to actually send,
Resend needs configuring. This is only for the email features (supplier quote
request + resident edit-link email).

**Steps:**
1. Create a free account at https://resend.com.
2. **Resend → Domains:** add and verify your sending domain (e.g.
   `parkmanor.co.za`) by adding the DNS records Resend shows you. Until a domain
   is verified, mail can only send from `onboarding@resend.dev`.
3. **Resend → API Keys:** create a key.
4. **Netlify → Site configuration → Environment variables:** add
   `RESEND_API_KEY` = that key. (Optional: `EMAIL_FALLBACK_FROM` = a verified
   from-address.)
5. **Redeploy** (env-var changes need a new deploy to take effect).

**How to read the email result after this:**
- `404` → functions still not running (step 2 not done / not deployed from Git).
- `500` "not configured" → `RESEND_API_KEY` missing (step 3.4).
- `422` "domain not verified" → key set, but the from-domain isn't verified (step 3.2).
- success → you're done.

---

## Order recap
1. Run the SQL (independent, do anytime) → clears DB/406 errors.
2. Deploy from Git → makes `/api/*` work (clears 404s).
3. Set `RESEND_API_KEY` + verify Resend domain + redeploy → email actually sends.

Steps 2 and 3 are what the email button needs; step 1 is what meetings,
resolutions, flags, etc. need.
