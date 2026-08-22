import { createWebStorage } from "@/src/lib/secure-storage.web";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}

describe("web secure storage", () => {
  it("persists through browser storage when it is available", async () => {
    const browserStorage = memoryStorage();
    const storage = createWebStorage(() => browserStorage);

    await storage.setItem("session", "token");
    await expect(storage.getItem("session")).resolves.toBe("token");

    await storage.removeItem("session");
    await expect(storage.getItem("session")).resolves.toBeNull();
  });

  it("stays empty and does not throw during static rendering", async () => {
    const storage = createWebStorage(() => undefined);

    await expect(storage.getItem("session")).resolves.toBeNull();
    await expect(storage.setItem("session", "token")).resolves.toBeUndefined();
    await expect(storage.removeItem("session")).resolves.toBeUndefined();
  });
});
