create extension if not exists pgcrypto;

create table if not exists public.quiz_sessions (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'waiting' check (status in ('waiting', 'running', 'completed')),
  started_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.app_state (
  id text primary key check (id = 'current'),
  session_id uuid not null references public.quiz_sessions(id)
);

create table if not exists public.check_ins (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.quiz_sessions(id),
  username text not null check (char_length(username) between 3 and 24),
  created_at timestamptz not null default now()
);

create unique index if not exists check_ins_unique_username_per_session
  on public.check_ins (session_id, lower(username));

create table if not exists public.quiz_results (
  id uuid primary key default gen_random_uuid(),
  check_in_id uuid not null unique references public.check_ins(id),
  session_id uuid not null references public.quiz_sessions(id),
  username text not null,
  score integer not null check (score between 0 and 100),
  elapsed_ms integer not null default 0 check (elapsed_ms between 0 and 86400000),
  scores jsonb not null,
  ai_report jsonb,
  scenario_count integer not null check (scenario_count between 1 and 20),
  decision_count integer not null check (decision_count between 1 and 500),
  created_at timestamptz not null default now()
);

create table if not exists public.quiz_progress (
  check_in_id uuid primary key references public.check_ins(id),
  session_id uuid not null references public.quiz_sessions(id),
  username text not null,
  score integer not null check (score between 0 and 100),
  elapsed_ms integer not null check (elapsed_ms between 0 and 86400000),
  scores jsonb not null,
  scenario_count integer not null check (scenario_count between 1 and 20),
  decision_count integer not null check (decision_count between 1 and 500),
  updated_at timestamptz not null default now()
);

create index if not exists quiz_results_by_session_score
  on public.quiz_results (session_id, score desc, created_at asc);

create index if not exists quiz_progress_by_session_score_time
  on public.quiz_progress (session_id, score desc, elapsed_ms asc, updated_at asc);

alter table public.quiz_results
  add column if not exists elapsed_ms integer not null default 0
  check (elapsed_ms between 0 and 86400000);

alter table public.quiz_results
  add column if not exists ai_report jsonb;

create index if not exists quiz_results_by_session_score_time
  on public.quiz_results (session_id, score desc, elapsed_ms asc, created_at asc);

insert into public.quiz_sessions (id, status)
values ('00000000-0000-4000-8000-000000000001', 'waiting')
on conflict (id) do nothing;

insert into public.app_state (id, session_id)
values ('current', '00000000-0000-4000-8000-000000000001')
on conflict (id) do nothing;

alter table public.quiz_sessions enable row level security;
alter table public.app_state enable row level security;
alter table public.check_ins enable row level security;
alter table public.quiz_results enable row level security;
alter table public.quiz_progress enable row level security;
