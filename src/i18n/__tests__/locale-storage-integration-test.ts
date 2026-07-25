import * as SecureStore from "expo-secure-store";
import { readLanguageState, writeLanguageState } from "../locale-storage";

const mockValues = new Map<string, string>();
const mockSecureStoreKey = /^[A-Za-z0-9._-]+$/;

function mockValidateKey(key: string) {
  if (!mockSecureStoreKey.test(key)) {
    throw new Error(`Invalid SecureStore key: ${key}`);
  }
}

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async (key: string) => {
    mockValidateKey(key);
    return mockValues.get(key) ?? null;
  }),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockValidateKey(key);
    mockValues.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockValidateKey(key);
    mockValues.delete(key);
  }),
}));

describe("language preference SecureStore integration", () => {
  beforeEach(() => {
    mockValues.clear();
    jest.clearAllMocks();
  });

  test("uses valid SecureStore keys and keeps UUID users isolated", async () => {
    const firstUser = "550e8400-e29b-41d4-a716-446655440000";
    const secondUser = "11111111-2222-3333-4444-555555555555";

    await writeLanguageState(firstUser, {
      preference: "es",
      pendingSync: true,
    });
    await writeLanguageState(secondUser, {
      preference: "en",
      pendingSync: false,
    });

    await expect(readLanguageState(firstUser)).resolves.toEqual({
      preference: "es",
      pendingSync: true,
    });
    await expect(readLanguageState(secondUser)).resolves.toEqual({
      preference: "en",
      pendingSync: false,
    });

    const touchedKeys = [
      ...jest.mocked(SecureStore.getItemAsync).mock.calls,
      ...jest.mocked(SecureStore.setItemAsync).mock.calls,
      ...jest.mocked(SecureStore.deleteItemAsync).mock.calls,
    ].map(([key]) => key);

    expect(touchedKeys.length).toBeGreaterThan(0);
    expect(touchedKeys).toEqual(
      expect.arrayContaining([
        `himu.language.${firstUser}_meta`,
        `himu.language.${secondUser}_meta`,
      ]),
    );
    expect(touchedKeys.every((key) => mockSecureStoreKey.test(key))).toBe(true);
  });
});
