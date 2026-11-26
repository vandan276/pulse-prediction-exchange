-- PULSE Exchange — Supabase Postgres Schema
-- Run in Supabase SQL Editor once a free/Pro project slot is available.

CREATE TABLE IF NOT EXISTS public.pulse_users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  avatar_color TEXT NOT NULL DEFAULT '#00E599',
  balance_cents BIGINT NOT NULL DEFAULT 100000,
  total_bets INTEGER NOT NULL DEFAULT 0,
  total_wins INTEGER NOT NULL DEFAULT 0,
  total_wagered_cents BIGINT NOT NULL DEFAULT 0,
  total_won_cents BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pulse_payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('DEPOSIT', 'WITHDRAWAL')),
  rail TEXT NOT NULL,
  provider TEXT NOT NULL,
  asset TEXT NOT NULL,
  amount_cents BIGINT NOT NULL,
  fee_cents BIGINT NOT NULL DEFAULT 0,
  net_cents BIGINT NOT NULL,
  destination TEXT,
  provider_ref TEXT NOT NULL,
  status TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pulse_payments_user ON public.pulse_payments (user_id, created_at DESC);
