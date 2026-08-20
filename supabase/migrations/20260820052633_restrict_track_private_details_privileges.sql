revoke insert, update, delete, truncate, references, trigger
  on table public.track_private_details
  from authenticated;

grant select on table public.track_private_details to authenticated;
