-- Run once in Supabase: SQL Editor → New query → Run.
create extension if not exists pgcrypto;

create table if not exists public.guard_accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (char_length(email) <= 254),
  username text not null unique check (char_length(username) between 3 and 48),
  first_name text not null check (char_length(first_name) between 1 and 80),
  last_name text not null check (char_length(last_name) between 1 and 80),
  birth_date date not null,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.guard_accounts enable row level security;
revoke all on public.guard_accounts from anon, authenticated;
