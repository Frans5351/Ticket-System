-- Run once in the Supabase SQL Editor (same place as PASSKEYS_SETUP.sql).
-- Stores water-meter readings submitted through the public forms so the
-- "Water meter readings" register in the app ticks them off automatically.
-- Same {id, data} shape as the other tables; RLS off like the rest.
CREATE TABLE IF NOT EXISTS public.water_readings (
  id text PRIMARY KEY,
  data jsonb,
  updated_at timestamptz DEFAULT now()
);
