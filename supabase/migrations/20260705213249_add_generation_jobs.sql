alter table public.generation_jobs
  add column drop_date date;

create unique index generation_jobs_user_drop_date_idx
  on public.generation_jobs (user_id, drop_date)
  where drop_date is not null;