-- Park Manor — electricity meter readings register
-- Run once in Supabase → SQL Editor. Safe to run again.
-- If the editor offers "Run and enable RLS", choose plain "Run": the app talks
-- to this table the same way as the others (no row-level security).

CREATE TABLE IF NOT EXISTS public.electricity_readings (
  id text PRIMARY KEY,
  data jsonb,
  updated_at timestamptz DEFAULT now()
);

-- Same access as the app's other tables.
ALTER TABLE public.electricity_readings DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.electricity_readings TO anon, authenticated, service_role;
