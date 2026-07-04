// Standard shell for authenticated endpoints: CORS preflight, JWT auth,
// and uncaught errors → 500. Business logic stays in the handler.
import type { User } from "jsr:@supabase/supabase-js@2";
import { cors, json } from "./http.ts";
import { getUser } from "./supabase.ts";

export function serveAuthed(
  handler: (req: Request, user: User) => Promise<Response>,
) {
  Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

    try {
      const user = await getUser(req);
      if (!user) return json({ error: "Unauthorized" }, 401);
      return await handler(req, user);
    } catch (e) {
      return json({ error: String(e) }, 500);
    }
  });
}
