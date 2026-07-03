
alter table public.djs
  add column owner_id uuid references auth.users(id) on delete cascade,
  add column is_public boolean not null default false;

create index djs_owner_id_idx on public.djs(owner_id);

-- Create policies for visibility: system users can see all, owners can see their own, and public djs are visible to everyone
drop policy "DJs viewable by everyone" on public.djs;
create policy "djs_select_visible" on public.djs for select 
using (owner_id is null or owner_id = auth.uid() or is_public);

drop policy "Tracks viewable by everyone" on public.tracks;
create policy "tracks_select_visible" on public.tracks for select
using (
  dj_id is null
  or exists (
    select 1 from public.djs d
    where d.id = tracks.dj_id
      and (d.owner_id is null or d.owner_id = auth.uid() or d.is_public)
  )
);

-- Update foreign key constraints to cascade on delete for djs and tracks
alter table public.tracks
  drop constraint tracks_dj_id_fkey,
  add constraint tracks_dj_id_fkey 
    foreign key (dj_id) references public.djs (id) on delete cascade;

alter table public.generation_jobs
  drop constraint generation_jobs_dj_id_fkey,
  add constraint generation_jobs_dj_id_fkey 
    foreign key (dj_id) references public.djs (id) on delete cascade,
  drop constraint generation_jobs_track_id_fkey,
  add constraint generation_jobs_track_id_fkey
    foreign key (track_id) references public.tracks (id) on delete set null;
