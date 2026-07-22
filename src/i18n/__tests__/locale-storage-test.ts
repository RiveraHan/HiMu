import { secureStorage } from "@/src/lib/secure-storage";
import { readLanguageState, writeLanguageState } from "../locale-storage";

jest.mock("@/src/lib/secure-storage", () => ({
  secureStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

describe("language preference storage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("uses a per-user storage key", async () => {
    jest.mocked(secureStorage.getItem).mockResolvedValue(null);

    await readLanguageState("user-42");

    expect(secureStorage.getItem).toHaveBeenCalledWith("himu:language:user-42");
  });

  test.each([
    ["an absent value", null],
    ["malformed JSON", "{"],
    ["an invalid preference", JSON.stringify({ preference: "fr", pendingSync: true })],
    ["an invalid pending flag", JSON.stringify({ preference: "es", pendingSync: "yes" })],
  ])("returns null for %s", async (_description, raw) => {
    jest.mocked(secureStorage.getItem).mockResolvedValue(raw);

    await expect(readLanguageState("user-1")).resolves.toBeNull();
  });

  test("round-trips a valid language state", async () => {
    let stored: string | null = null;
    jest.mocked(secureStorage.setItem).mockImplementation(async (_key, value) => {
      stored = value;
    });
    jest.mocked(secureStorage.getItem).mockImplementation(async () => stored);

    await writeLanguageState("user-1", {
      preference: "es",
      pendingSync: true,
    });

    expect(secureStorage.setItem).toHaveBeenCalledWith(
      "himu:language:user-1",
      JSON.stringify({ preference: "es", pendingSync: true }),
    );
    await expect(readLanguageState("user-1")).resolves.toEqual({
      preference: "es",
      pendingSync: true,
    });
  });

  test("returns null when storage throws", async () => {
    jest.mocked(secureStorage.getItem).mockRejectedValue(new Error("storage failed"));

    await expect(readLanguageState("user-1")).resolves.toBeNull();
  });
});
