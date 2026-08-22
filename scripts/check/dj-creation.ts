import assert from "node:assert/strict";
import { parseIsPublic } from "../../supabase/functions/_shared/dj-input.ts";
import {
  isDjQuotaError,
  MAX_OWNED_DJS,
} from "../../supabase/functions/create-dj/create-dj-contract.ts";

assert.equal(parseIsPublic(false), false);
assert.equal(parseIsPublic(true), true);
for (const invalidValue of [undefined, null, "true", 1]) {
  assert.throws(
    () => parseIsPublic(invalidValue),
    /isPublic must be a boolean/,
  );
}

assert.equal(MAX_OWNED_DJS, 1);
assert.equal(
  isDjQuotaError({ code: "P0001", message: "dj_quota_reached" }),
  true,
);
for (const error of [
  undefined,
  { code: "P0001", message: "different_message" },
  { code: "23505", message: "dj_quota_reached" },
  new Error("dj_quota_reached"),
]) {
  assert.equal(isDjQuotaError(error), false);
}

console.log("DJ creation contract checks passed");
