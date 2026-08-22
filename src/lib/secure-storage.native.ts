import * as SecureStore from "expo-secure-store";

const CHUNK_SIZE = 2000;

/**
 * Chunked storage adapter compatible with Supabase Auth and Zustand `persist`.
 *
 * Works around `expo-secure-store`'s ~2 KB per-entry limit on Android by
 * splitting values into 2000-char chunks plus a `{key}_meta` entry that
 * records the chunk count.`.
 */
export const secureStorage = {
  getItem: async (key: string) => {
    const meta = await SecureStore.getItemAsync(`${key}_meta`);
    if (!meta) return null;
    const { chunks } = JSON.parse(meta);
    const parts = await Promise.all(
      Array.from({ length: chunks }, (_, i) =>
        SecureStore.getItemAsync(`${key}_${i}`),
      ),
    );
    return parts.join("");
  },

  setItem: async (key: string, value: string) => {
    // Clear prior entry so a smaller value doesn't leave orphaned chunks behind.
    await secureStorage.removeItem(key);

    const chunks = Math.ceil(value.length / CHUNK_SIZE);
    await SecureStore.setItemAsync(`${key}_meta`, JSON.stringify({ chunks }));
    await Promise.all(
      Array.from({ length: chunks }, (_, i) =>
        SecureStore.setItemAsync(
          `${key}_${i}`,
          value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
        ),
      ),
    );
  },

  removeItem: async (key: string) => {
    const meta = await SecureStore.getItemAsync(`${key}_meta`);
    if (!meta) return;
    const { chunks } = JSON.parse(meta);
    await Promise.all([
      SecureStore.deleteItemAsync(`${key}_meta`),
      ...Array.from({ length: chunks }, (_, i) =>
        SecureStore.deleteItemAsync(`${key}_${i}`),
      ),
    ]);
  },
};
