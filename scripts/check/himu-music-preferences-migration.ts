import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const migrationNames = readdirSync(resolve("supabase/migrations")).filter(
  (name) => name.endsWith("_himu_music_preferences_atmosphere.sql"),
);

assert.equal(
  migrationNames.length,
  1,
  "expected one music-preferences atmosphere migration",
);

const sql = readFileSync(
  resolve("supabase/migrations", migrationNames[0]!),
  "utf8",
);
const additiveAtmosphereOnly = /^\s*alter\s+table\s+public\.music_preferences\s+add\s+column\s+atmosphere\s+text\s+not\s+null\s+default\s+'balanced'\s+check\s*\(\s*atmosphere\s+in\s*\(\s*'calm'\s*,\s*'balanced'\s*,\s*'intense'\s*\)\s*\)\s*;\s*$/i;

assert.match(
  sql,
  additiveAtmosphereOnly,
  "migration must contain only the canonical additive atmosphere column",
);
assert.doesNotMatch(sql, /\b(?:drop|rename|update)\b/i);
assert.doesNotMatch(
  sql,
  /\b(?:vibe_mapping|ai_frequency|discovery_depth|bpm_range|focus_modes)\b/i,
);

console.log("music preferences atmosphere migration checks passed");
