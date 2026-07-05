create table public.avatar_regens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  dj_id uuid not null references public.djs (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.avatar_regens enable row level security;

create index avatar_regens_user_time_idx
  on public.avatar_regens (user_id, created_at);