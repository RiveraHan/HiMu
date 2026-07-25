const fs = jest.requireActual("fs") as {
  readFileSync(path: string, encoding: string): string;
};

const sql = fs
  .readFileSync(
    "supabase/migrations/20260716184556_add_user_onboarding.sql",
    "utf8",
  )
  .toLowerCase();

describe("user_onboarding migration", () => {
  it("installs an invoker trigger with a locked search path", () => {
    expect(sql).toMatch(
      /create function public\.enforce_user_onboarding_monotonic_update\(\)[\s\S]*returns trigger[\s\S]*security invoker[\s\S]*set search_path = ''/,
    );
    expect(sql).toContain("before update on public.user_onboarding");
    expect(sql).not.toContain("security definer");
  });

  it("revokes direct execution of the trigger function", () => {
    expect(sql).toMatch(
      /revoke execute on function public\.enforce_user_onboarding_monotonic_update\(\)\s+from public, anon, authenticated/,
    );
  });

  it("guards terminal lifecycle transitions atomically", () => {
    expect(sql).toContain("old.status = 'completed'");
    expect(sql).toContain("old.status = 'skipped'");
    expect(sql).toContain("new.status <> 'completed'");
    expect(sql).toContain("new.status := 'completed'");
    expect(sql).toContain("new.status := 'skipped'");
  });

  it("merges monotonic fields and both known contextual tips", () => {
    expect(sql).toContain("new.started_at := least(old.started_at, new.started_at)");
    expect(sql).toContain("new.first_play_at := coalesce(old.first_play_at, new.first_play_at)");
    expect(sql).toContain("new.replay_count := greatest(old.replay_count, new.replay_count)");
    expect(sql).toContain("new.last_replayed_at := case");
    expect(sql).toContain("greatest(old.last_replayed_at, new.last_replayed_at)");
    expect(sql).toContain("discover.search");
    expect(sql).toContain("dj.hero");
    expect(sql).toContain("least(");
  });

  it("prevents stale or equal updates from regressing the cursor", () => {
    expect(sql).toContain("incoming_terminal_promotion");
    expect(sql).toMatch(
      /if new\.updated_at <= old\.updated_at and not incoming_terminal_promotion then\s+new\.last_step := old\.last_step/,
    );
    expect(sql).toContain("new.updated_at := greatest(old.updated_at, new.updated_at)");
  });
});
