-- A Moment is reachable through the field-whitelisted public-track Edge
-- Function. Publishing it must not make the complete `tracks` row available
-- through PostgREST: that row also carries ownership and internal metadata.
--
-- Signed-in listeners retain system catalogue access, and owners retain their
-- own tracks. Owner-created public Moments are intentionally served only by
-- the dedicated Edge Function.
revoke select on table public.tracks from public, anon;
grant select on table public.tracks to authenticated, service_role;

drop policy if exists "tracks_select_visible" on public.tracks;
drop policy if exists "tracks_select_owned_or_catalog" on public.tracks;
create policy "tracks_select_owned_or_catalog" on public.tracks
for select
to authenticated
using (
  owner_id = (select auth.uid())
  or owner_id is null
);
