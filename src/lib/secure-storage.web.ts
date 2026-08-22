type BrowserStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function browserStorage(): BrowserStorage | undefined {
  if (typeof window === "undefined") return undefined;

  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function createWebStorage(
  getStorage: () => BrowserStorage | undefined = browserStorage,
) {
  return {
    getItem: async (key: string) => getStorage()?.getItem(key) ?? null,
    setItem: async (key: string, value: string) => {
      getStorage()?.setItem(key, value);
    },
    removeItem: async (key: string) => {
      getStorage()?.removeItem(key);
    },
  };
}

export const secureStorage = createWebStorage();
