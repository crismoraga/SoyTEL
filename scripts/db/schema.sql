-- Esquema de la API de SoyTEL (Neon Postgres). Idempotente: se puede ejecutar varias veces.
-- Uso: npm run db:migrate

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  recovery_hash text not null unique,
  alias text not null,
  avatar smallint not null default 0,
  grade text,
  school text,
  contact_kind text,
  contact_value text,
  contact_consent boolean not null default false,
  guardian_consent boolean not null default false,
  consent_at timestamptz,
  xp integer not null default 0,
  level integer not null default 1,
  games integer not null default 0,
  streak integer not null default 0,
  best_route integer not null default 0,
  routes integer not null default 0,
  achievements text[] not null default '{}',
  flags integer not null default 0,
  hidden boolean not null default false,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint players_alias_length check (char_length(alias) between 2 and 20),
  constraint players_avatar_range check (avatar between 0 and 63),
  constraint players_contact_needs_consent check (contact_consent or contact_value is null)
);

create index if not exists players_rank_idx on players (xp desc, created_at asc) where not hidden;
create index if not exists players_contact_idx on players (created_at) where contact_consent;

create table if not exists rate_limits (
  bucket text primary key,
  window_start timestamptz not null,
  hits integer not null
);

-- Limpieza de contadores viejos (se ejecuta en cada migración).
delete from rate_limits where window_start < now() - interval '2 days';
