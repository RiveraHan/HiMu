create table public.cover_regens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  track_id uuid not null references public.tracks (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.cover_regens enable row level security;

create policy cover_regens_select_own
  on public.cover_regens for select
  to authenticated
  using (user_id = auth.uid());

create index cover_regens_user_time_idx
  on public.cover_regens (user_id, created_at);