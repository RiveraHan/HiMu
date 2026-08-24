import assert from "node:assert/strict";
import {
  CREATIVE_ROLE_BUDGETS_USD,
  MODEL_CATALOG,
  REQUIRED_CREATIVE_MODEL_ROLES,
  assertWithinModelBudget,
  estimateModelCost,
  modelPredictionEndpoint,
  resolveCreativeModel,
} from "../../supabase/functions/_shared/creative-models.ts";

const roles = new Set(MODEL_CATALOG.map((model) => model.role));
assert.deepEqual(roles, new Set(REQUIRED_CREATIVE_MODEL_ROLES));

const catalogKeys = MODEL_CATALOG.map((model) =>
  `${model.role}:${model.id}:${model.lifecycle}`
);
assert.equal(new Set(catalogKeys).size, catalogKeys.length);

for (const model of MODEL_CATALOG) {
  assert.match(model.id, /^[a-z0-9-]+\/[a-z0-9.-]+$/);
  assert.equal(
    model.endpoint,
    `https://api.replicate.com/v1/models/${model.id}/predictions`,
  );
  assert.equal(model.endpoint, modelPredictionEndpoint(model.id));
  assert.equal(new URL(model.endpoint).protocol, "https:");
  assert.equal(model.verifiedAt, "2026-08-24");
  assert.ok(model.price.per > 0);
  assert.ok((model.price.inputUsd ?? 0) >= 0);
  assert.ok(model.price.outputUsd >= 0);
  assert.ok(model.limits.input > 0);
  assert.ok(model.limits.output > 0);
  assert.ok(model.limits.timeoutMs >= 5_000);
  assert.ok(model.limits.maxCostUsd > 0);
}

for (const role of REQUIRED_CREATIVE_MODEL_ROLES) {
  const promoted = MODEL_CATALOG.filter((model) =>
    model.role === role && model.lifecycle === "promoted"
  );
  assert.ok(promoted.length <= 1, `${role} has multiple promoted models`);
  assert.doesNotThrow(() => resolveCreativeModel(role));
}

assert.deepEqual(CREATIVE_ROLE_BUDGETS_USD, {
  creative_longform: 0.015,
  creative_shortform: 0.005,
  format_repair: 0.001,
  music_full: 0.08,
  image_cover: 0.025,
  image_avatar: 0.025,
  voice_caption: 0.005,
  quality_judge: 0.01,
});

assert.equal(resolveCreativeModel("music_full").id, "google/lyria-3-pro");
assert.equal(resolveCreativeModel("voice_caption").id, "inworld/realtime-tts-2");
assert.equal(
  resolveCreativeModel("creative_longform", {
    candidateId: "anthropic/claude-sonnet-5",
  }).adapter,
  "anthropic",
);
assert.throws(
  () => resolveCreativeModel("creative_longform", { candidateId: "reve/create" }),
  /creative_model_not_available/,
);

const sonnet = resolveCreativeModel("creative_longform", {
  candidateId: "anthropic/claude-sonnet-5",
});
assert.equal(
  estimateModelCost(sonnet, { input: 900, output: 1_200 }),
  0.0138,
);

const lyria = resolveCreativeModel("music_full");
assert.equal(estimateModelCost(lyria, { input: 1, output: 1 }), 0.08);

const inworld = resolveCreativeModel("voice_caption");
assert.equal(estimateModelCost(inworld, { input: 160, output: 0 }), 0.004);

const fluxKlein = resolveCreativeModel("image_cover", {
  candidateId: "black-forest-labs/flux-2-klein-9b",
});
assert.equal(estimateModelCost(fluxKlein, { input: 0, output: 1 }), 0.015);

assert.doesNotThrow(() => assertWithinModelBudget("music_full", 0.08));
assert.throws(
  () => assertWithinModelBudget("music_full", 0.080001),
  /creative_cost_guard/,
);
assert.throws(
  () => assertWithinModelBudget("image_cover", 0.025001),
  /creative_cost_guard/,
);
assert.throws(
  () => assertWithinModelBudget("creative_longform", Number.NaN),
  /creative_cost_guard/,
);

console.log("creative model catalog checks passed");
