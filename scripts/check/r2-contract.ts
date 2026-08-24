import assert from "node:assert/strict";
import { storageTarget } from "../../supabase/functions/_shared/r2-contract";

const environment = {
  accountId: "account",
  publicBucket: "himu-public",
  privateBucket: "himu-private",
  publicBase: "https://media.example/",
};
const key = "tracks/generated/job-1/attempt.mp3";

assert.deepEqual(storageTarget("private", key, environment), {
  bucket: "himu-private",
  objectUrl: `https://account.r2.cloudflarestorage.com/himu-private/${key}`,
  reference: `r2-private://${key}`,
});
assert.deepEqual(storageTarget("public", key, environment), {
  bucket: "himu-public",
  objectUrl: `https://account.r2.cloudflarestorage.com/himu-public/${key}`,
  reference: `https://media.example/${key}`,
});

assert.throws(
  () => storageTarget("private", key, { ...environment, privateBucket: "" }),
  /private bucket/i,
);
assert.throws(
  () => storageTarget("public", key, { ...environment, publicBase: "" }),
  /public base/i,
);
assert.throws(
  () => storageTarget("private", "avatars/generated/a.jpg", environment),
  /private media key/i,
);
assert.throws(
  () => storageTarget("public", "../secret", environment),
  /generated object key/i,
);

console.log("R2 contract checks passed");
