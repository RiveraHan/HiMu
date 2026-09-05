import { json } from "../_shared/http.ts";
import { R2_PUBLIC_BASE } from "../_shared/r2.ts";
import { admin } from "../_shared/supabase.ts";
import {
  createPublicTrackDependencies,
  handlePublicTrackHttpRequest,
  type PublicTrackDatabase,
} from "./handler.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const dependencies = createPublicTrackDependencies(
  admin as unknown as PublicTrackDatabase,
  R2_PUBLIC_BASE,
);

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }
  const result = await handlePublicTrackHttpRequest(request, dependencies);
  const response = json(result.body, result.status);
  response.headers.set("Cache-Control", "no-store");
  for (const [name, value] of Object.entries(cors)) {
    response.headers.set(name, value);
  }
  return response;
});
