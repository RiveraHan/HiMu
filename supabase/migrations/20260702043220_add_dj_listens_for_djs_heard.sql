
create table if not exists public.dj_listens (
  user_id uuid not null references auth.users (id) on delete cascade,
  dj_id uuid not null references public.djs (id) on delete cascade,
  first_listened_at timestamptz not null default now(),
  primary key (user_id, dj_id)
);

alter table public.dj_listens enable row level security;

create policy "dj_listens_select_own" on public.dj_listens
  for select to authenticated using (auth.uid() = user_id);
  
create policy "dj_listens_insert_own" on public.dj_listens
  for insert to authenticated with check (auth.uid() = user_id);