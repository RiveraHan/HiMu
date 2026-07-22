create table public.user_onboarding (
  user_id uuid not null references public.profiles(id) on delete cascade,
  version integer not null check (version > 0),
  status text not null check (status in ('in_progress', 'completed', 'skipped')),
  last_step text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  skipped_at timestamptz,
  first_play_at timestamptz,
  contextual_tips jsonb not null default '{}'::jsonb,
  replay_count integer not null default 0 check (replay_count >= 0),
  last_replayed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, version),
  check (
    (status = 'completed' and completed_at is not null and skipped_at is null)
    or (status = 'skipped' and skipped_at is not null and completed_at is null)
    or (status = 'in_progress' and completed_at is null and skipped_at is null)
  )
);

create function public.enforce_user_onboarding_monotonic_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  merged_tips jsonb;
  old_tip timestamptz;
  new_tip timestamptz;
  incoming_terminal_promotion boolean;
begin
  incoming_terminal_promotion :=
    (new.status = 'completed' and old.status <> 'completed')
    or (new.status = 'skipped' and old.status = 'in_progress');

  if new.updated_at <= old.updated_at and not incoming_terminal_promotion then
    new.last_step := old.last_step;
  end if;
  new.updated_at := greatest(old.updated_at, new.updated_at);

  if old.status = 'completed' then
    new.status := 'completed';
    new.completed_at := old.completed_at;
    new.skipped_at := null;
  elsif old.status = 'skipped' and new.status <> 'completed' then
    new.status := 'skipped';
    new.skipped_at := old.skipped_at;
    new.completed_at := null;
  elsif old.status = 'skipped' and new.status = 'completed' then
    new.skipped_at := null;
  end if;

  new.started_at := least(old.started_at, new.started_at);
  new.first_play_at := coalesce(old.first_play_at, new.first_play_at);
  new.replay_count := greatest(old.replay_count, new.replay_count);
  new.last_replayed_at := case
    when old.last_replayed_at is null then new.last_replayed_at
    when new.last_replayed_at is null then old.last_replayed_at
    else greatest(old.last_replayed_at, new.last_replayed_at)
  end;

  merged_tips := coalesce(old.contextual_tips, '{}'::jsonb)
    || coalesce(new.contextual_tips, '{}'::jsonb);

  old_tip := (old.contextual_tips ->> 'discover.search')::timestamptz;
  new_tip := (new.contextual_tips ->> 'discover.search')::timestamptz;
  if old_tip is not null or new_tip is not null then
    merged_tips := jsonb_set(
      merged_tips,
      '{discover.search}',
      to_jsonb(
        case
          when old_tip is null then new_tip
          when new_tip is null then old_tip
          else least(old_tip, new_tip)
        end
      ),
      true
    );
  end if;

  old_tip := (old.contextual_tips ->> 'dj.hero')::timestamptz;
  new_tip := (new.contextual_tips ->> 'dj.hero')::timestamptz;
  if old_tip is not null or new_tip is not null then
    merged_tips := jsonb_set(
      merged_tips,
      '{dj.hero}',
      to_jsonb(
        case
          when old_tip is null then new_tip
          when new_tip is null then old_tip
          else least(old_tip, new_tip)
        end
      ),
      true
    );
  end if;

  new.contextual_tips := merged_tips;
  return new;
end;
$$;

revoke execute on function public.enforce_user_onboarding_monotonic_update()
from public, anon, authenticated;

create trigger enforce_user_onboarding_monotonic_update
before update on public.user_onboarding
for each row
execute function public.enforce_user_onboarding_monotonic_update();

alter table public.user_onboarding enable row level security;

revoke all on table public.user_onboarding from anon;
grant select, insert, update on table public.user_onboarding to authenticated;

create policy "Users can read their onboarding"
on public.user_onboarding for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their onboarding"
on public.user_onboarding for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their onboarding"
on public.user_onboarding for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
