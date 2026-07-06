
create table public.listening_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  track_id uuid not null references public.tracks (id) on delete cascade,
  event text not null check (event in ('completed', 'skipped')),
  created_at timestamptz not null default now()
);

alter table public.listening_events enable row level security;

create policy listening_events_insert_own
  on public.listening_events for insert
  to authenticated with check (user_id = auth.uid());

create policy listening_events_select_own
  on public.listening_events for select
  to authenticated using (user_id = auth.uid());

create index listening_events_user_time_idx
  on public.listening_events (user_id, created_at);