# Park Manor — local dev

## Quick start (no passkeys, no functions — static only)

The simplest option. Runs the app against Supabase directly. Passkey login won't
work locally (it 404s on `/api/passkey/*`), but everything else is fine and the
client falls back to username + password.

**Mac / Linux:** `./dev.sh`
**Windows:** double-click `dev.bat`

Opens `http://localhost:8080`.

## With passkeys (matches production)

If you want Face ID / fingerprint login to work on localhost too, use Netlify Dev.
This runs the static site + the API functions on the same origin.

### One-time setup

1. Install the Netlify CLI: `npm install -g netlify-cli`
2. Copy `.env.example` to `.env` in this folder and fill in real values:
   - `PASSKEY_JWT_SECRET` — any long random string, e.g. `openssl rand -hex 32`
   - `SUPABASE_SERVICE_ROLE_KEY` — from Supabase → Project Settings → API → service_role

### Run

```
netlify dev
```

Opens `http://localhost:8888`. Both the app and the `/api/passkey/*` endpoints work.

### Important: passkeys are bound to a domain

`PASSKEY_RP_ID=localhost` in `.env` means passkeys you enrol locally only work locally.
Production passkeys (where `PASSKEY_RP_ID=your-site.netlify.app`) only work in production.
So you'll typically register one passkey on your phone for production and a separate
one in your local dev browser. They don't share.

### Supabase setup (one-time)

The `passkeys` and `passkey_challenges` tables need to exist. See `PASSKEYS_SETUP.sql`
and `PASSKEYS_SETUP.md` in this folder.

## Emails & `/api/*` in plain local dev (August 2026)

`server.py` now **forwards any `/api/*` request to the production site**
(`NETLIFY_SITE` constant at the top of `server.py`). That means the plain
`./dev.sh` / `dev.bat` workflow exercises the real Netlify functions — emails
genuinely send, attachments upload — using production's environment variables.
Caveat: local email tests therefore send **real emails** through the live
Brevo account; use your own address.

## Email env vars (Brevo — replaced Resend, August 2026)

Set in Netlify → Environment variables, then redeploy:

| Variable | Value |
|---|---|
| `BREVO_API_KEY` | Brevo → SMTP & API → **API Keys** (starts `xkeysib-`) |
| `BREVO_FROM_EMAIL` | The sender address verified in Brevo |
| `BREVO_FROM_NAME` | Optional display name, e.g. `Park Manor` |
| `AGENT_NOTIFY_EMAIL` | Optional extra notification recipient(s) |
| `APP_BASE_URL` | Optional; defaults to the production URL |

Brevo's **IP restriction for API keys must stay OFF** (serverless IPs rotate).
