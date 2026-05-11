create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  primary_wallet_address text not null unique,
  display_name text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.users
add column if not exists display_name text;

create table if not exists public.wallet_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  wallet_address text not null unique,
  created_at timestamptz not null default timezone('utc', now()),
  verified_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.auth_challenges (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null,
  purpose text not null check (purpose in ('login', 'verify_protocol_control')),
  protocol_address text,
  challenge_message text not null,
  nonce text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  wallet_address text not null,
  token_hash text not null unique,
  created_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create table if not exists public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  label text,
  token_hash text not null unique,
  created_at timestamptz not null default timezone('utc', now()),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create table if not exists public.protocol_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  protocol_address text not null,
  label text,
  claimed_by_wallet text not null,
  status text not null default 'claimed' check (status in ('claimed', 'verified', 'manual_review')),
  verification_method text check (verification_method in ('upgrade_authority', 'known_admin_signer')),
  verification_target text,
  verification_notes text,
  registration_tx_signature text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_wallet_identities_user_id on public.wallet_identities(user_id);
create index if not exists idx_auth_challenges_wallet_address on public.auth_challenges(wallet_address);
create index if not exists idx_sessions_user_id on public.sessions(user_id);
create index if not exists idx_sessions_token_hash on public.sessions(token_hash);
create index if not exists idx_api_tokens_user_id on public.api_tokens(user_id);
create index if not exists idx_api_tokens_token_hash on public.api_tokens(token_hash);
create index if not exists idx_protocol_claims_user_id on public.protocol_claims(user_id);

alter table public.protocol_claims
drop constraint if exists protocol_claims_protocol_address_key;

create unique index if not exists idx_protocol_claims_user_protocol
on public.protocol_claims(user_id, protocol_address);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists users_touch_updated_at on public.users;
create trigger users_touch_updated_at
before update on public.users
for each row execute function public.touch_updated_at();

drop trigger if exists protocol_claims_touch_updated_at on public.protocol_claims;
create trigger protocol_claims_touch_updated_at
before update on public.protocol_claims
for each row execute function public.touch_updated_at();
