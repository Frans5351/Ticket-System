-- Run this in the Supabase SQL Editor BEFORE deploying.
-- Creates the two tables passkey enrolment / login uses.

CREATE TABLE IF NOT EXISTS public.passkeys (
  id text PRIMARY KEY,                  -- credential id from authenticator
  user_id text NOT NULL,                -- users.id (your USERS table id)
  public_key text NOT NULL,             -- base64-encoded public key
  counter bigint NOT NULL DEFAULT 0,    -- signature counter (replay protection)
  device_name text,
  transports text[],                    -- ['internal','hybrid','usb',...]
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS passkeys_user_id_idx ON public.passkeys(user_id);

CREATE TABLE IF NOT EXISTS public.passkey_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL,
  challenge text NOT NULL,
  intent text NOT NULL,                 -- 'register' or 'authenticate'
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS passkey_challenges_lookup_idx
  ON public.passkey_challenges(username, intent, expires_at DESC);

-- Lock both tables to service role only (the Netlify function holds that key).
ALTER TABLE public.passkeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passkey_challenges ENABLE ROW LEVEL SECURITY;

-- No anon policy is created, so the anon key cannot read or write either table.
