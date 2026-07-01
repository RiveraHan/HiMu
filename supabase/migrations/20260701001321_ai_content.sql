create table if not exists public.generation_jobs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  dj_id uuid references public.djs(id) not null,
  prompt text,
  status text not null default 'queued'
    check (status in ('queued', 'generating', 'ready', 'failed')),
  track_id uuid references public.tracks(id),
  error text,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

alter table public.generation_jobs enable row level security;
create policy "Users can view own jobs" on public.generation_jobs
  for select using (auth.uid() = user_id);

create index idx_generation_jobs_user on public.generation_jobs (user_id, created_at desc);