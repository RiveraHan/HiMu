import assert from "node:assert/strict";
import { mapProviderReservation } from "../../supabase/functions/_shared/provider-usage";

assert.deepEqual(
  mapProviderReservation([{
    outcome: "created",
    event_id: "event-1",
    daily_limit: 3,
    resource_id: "resource-1",
  }]),
  {
    outcome: "created",
    eventId: "event-1",
    limit: 3,
    resourceId: "resource-1",
  },
);
assert.deepEqual(
  mapProviderReservation([{
    outcome: "existing",
    event_id: "event-1",
    daily_limit: 30,
    resource_id: null,
  }]),
  {
    outcome: "existing",
    eventId: "event-1",
    limit: 30,
    resourceId: null,
  },
);
assert.deepEqual(
  mapProviderReservation([{
    outcome: "quota",
    event_id: null,
    daily_limit: 3,
    resource_id: null,
  }]),
  { outcome: "quota", eventId: null, limit: 3, resourceId: null },
);

for (const malformed of [
  null,
  [],
  [{ outcome: "allow" }],
  [{ outcome: "created", event_id: null, daily_limit: 3, resource_id: null }],
  [{ outcome: "quota", event_id: "event", daily_limit: 3, resource_id: null }],
  [{ outcome: "quota", event_id: null, daily_limit: 0, resource_id: null }],
]) {
  assert.throws(() => mapProviderReservation(malformed), /reservation/i);
}

const databaseError = new Error("database failed");
assert.throws(() => mapProviderReservation(null, databaseError), /database failed/);

console.log("provider usage contracts passed");
