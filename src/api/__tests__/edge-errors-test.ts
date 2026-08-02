import { FunctionsHttpError } from "@supabase/supabase-js";

import { getEdgeErrorPayload } from "../edge-errors";

function httpError(body: unknown) {
  return new FunctionsHttpError({ json: jest.fn(async () => body) } as never);
}

test("parses a structured quota response in one pass", async () => {
  await expect(
    getEdgeErrorPayload(
      httpError({ code: "daily_quota_reached", dailyLimit: 3, limit: null }),
    ),
  ).resolves.toEqual({ code: "daily_quota_reached", dailyLimit: 3, limit: null });
});

test.each([
  [new Error("network"), { code: null, dailyLimit: null, limit: null }],
  [httpError({ code: 7, dailyLimit: 0, limit: 2.5 }), { code: null, dailyLimit: null, limit: null }],
])("normalizes malformed and non-HTTP errors", async (error, expected) => {
  await expect(getEdgeErrorPayload(error)).resolves.toEqual(expected);
});

test("returns null fields when the response body cannot be read", async () => {
  const error = new FunctionsHttpError({
    json: jest.fn(async () => { throw new Error("invalid json"); }),
  } as never);
  await expect(getEdgeErrorPayload(error)).resolves.toEqual({
    code: null,
    dailyLimit: null,
    limit: null,
  });
});
