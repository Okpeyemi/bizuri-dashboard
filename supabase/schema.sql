-- Enable useful extensions (optional but recommended)
create extension if not exists pgcrypto with schema public;
create extension if not exists citext with schema public;

-- Roles enum
create type if not exists public.user_role as enum (
  'super_admin',
  'business_admin',
  'business_members'
);

-- Companies
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  business_email text not null unique,
  created_at timestamptz not null default now()
);

-- Profiles (1:1 with auth.users)
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.user_role not null default 'business_members',
  company_id uuid not null references public.companies(id) on delete restrict,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_profiles_company on public.profiles(company_id);

-- RLS
alter table public.companies enable row level security;
alter table public.profiles enable row level security;

-- Policies: profiles (user can read/update own)
drop policy if exists "Profiles: read own" on public.profiles;
create policy "Profiles: read own" on public.profiles
  for select using (auth.uid() = user_id);

drop policy if exists "Profiles: update own" on public.profiles;
create policy "Profiles: update own" on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Policies: companies (member can read their company)
drop policy if exists "Companies: read member's company" on public.companies;
create policy "Companies: read member's company" on public.companies
  for select using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.company_id = companies.id
    )
  );

-- Note: Inserts are performed by the service role via `/api/register`, which bypasses RLS.
