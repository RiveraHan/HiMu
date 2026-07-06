import { admin } from "./supabase.ts";

export const DAILY_GENERATION_LIMIT = 10;

// Manual mixes + cover regens in the last 24h. Drops are exempt (drop_date set)
// and excluded here.
export async function countDailyGenerations(userId: string): Promise<number> {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [{ count: mixes }, { count: covers }] = await Promise.all([
    admin
      .from("generation_jobs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("drop_date", null)
      .gt("created_at", dayAgo)
      .neq("status", "failed"),
    admin
      .from("cover_regens")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gt("created_at", dayAgo),
  ]);

  return (mixes ?? 0) + (covers ?? 0);
}
