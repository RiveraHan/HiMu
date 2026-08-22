-- Apply only after the compatible generate-mix and create-dj Edge Functions
-- have been deployed; generate-mix must call the four-argument reservation RPC.
revoke all on function public.reserve_manual_generation_job(uuid, uuid, text)
  from public, anon, authenticated, service_role;
drop function public.reserve_manual_generation_job(uuid, uuid, text);
