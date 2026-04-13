-- ---------------------------------------------------------------------------
-- Migration: add stripe_account_id to clubs
-- Supports Stripe Connect onboarding for club owners.
-- The column is nullable — clubs that have not connected Stripe will have NULL.
-- ---------------------------------------------------------------------------

ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS stripe_account_id text;
