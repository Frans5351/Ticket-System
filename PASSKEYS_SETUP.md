# Passkeys (Face ID / Touch ID / Windows Hello) — setup

Three things need doing once before this feature works.

## 1. Run the SQL migration

Open Supabase → SQL Editor → paste the contents of `PASSKEYS_SETUP.sql` → Run.
This creates two new tables: `passkeys` and `passkey_challenges`. Both are RLS-locked
so only the service role key can touch them.

## 2. Get your Supabase service role key

Supabase → Project Settings → API → copy the **`service_role` secret**
(NOT the anon key — different key).

WARNING: This key bypasses RLS. It lives only in Netlify env vars; never expose to the browser.

## 3. Set Netlify env vars

Netlify site → Site configuration → Environment variables → Add the following:

| Name | Value | Notes |
| --- | --- | --- |
| `PASSKEY_RP_ID` | `your-site.netlify.app` | Your domain, NO `https://` prefix |
| `PASSKEY_RP_NAME` | `Park Manor` | Display name shown in the OS biometric prompt |
| `PASSKEY_ORIGIN` | `https://your-site.netlify.app` | WITH `https://` |
| `PASSKEY_JWT_SECRET` | (long random string) | Generate with: `openssl rand -hex 32` |
| `SUPABASE_SERVICE_ROLE_KEY` | (from step 2) | The service_role key |
| `SUPABASE_URL` | `https://spagcmzhlngtqvrydzvi.supabase.co` | Optional — defaults to this |

Trigger a redeploy after adding env vars (Netlify won't pick them up otherwise).

## How it works

1. **First login on a new device:** User enters username + password as today.
2. **After successful login:** App asks "Save passkey to this device?" → tap yes →
   OS prompts for Face ID / fingerprint / passcode → done.
3. **Every future login on that device:** User types username → "Sign in with Face ID"
   button appears → tap → OS prompt → in.
4. **Sessions last 90 days** (JWT in localStorage). Logout clears it.
5. **Manage devices:** Settings → 🔐 Devices lists each registered device with a Remove button.

## Troubleshooting

- **Face ID button doesn't appear:** The username field needs to match a username
  that previously enrolled a passkey *on this browser*. The hint is stored in
  localStorage under `pm_passkey_users`. Clearing browser data removes the hint.
- **"Passkeys not supported on this browser":** Browser is too old, or you're on
  http:// (passkeys require https or localhost). Netlify uses https by default.
- **"No pending challenge":** The 5-minute challenge window expired. Click Sign in again.
- **Built-in admin can't enrol:** The `admin/admin` fallback doesn't go through the
  server endpoint, so it never gets a session JWT. Create a real admin user in the
  Users panel and use that account for passkey enrolment.
