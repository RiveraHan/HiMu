import { withTransientRetry } from "../retry";

test("retries a transient operation up to the configured limit", async () => {
  let attempts = 0;
  const value = await withTransientRetry(async () => {
    attempts += 1;
    if (attempts < 3) throw new TypeError("fetch failed");
    return "ok";
  }, { attempts: 3, delay: async () => {} });

  expect(value).toBe("ok");
  expect(attempts).toBe(3);
});

test("preserves the final error after exhausting retries", async () => {
  let attempts = 0;
  await expect(withTransientRetry(async () => {
    attempts += 1;
    throw new TypeError("fetch failed");
  }, { attempts: 2, delay: async () => {} })).rejects.toThrow("fetch failed");
  expect(attempts).toBe(2);
});
