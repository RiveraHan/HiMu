import { supabase } from "@/src/api/supabase";
import { authApi } from "../auth.web";

jest.mock("@/src/api/supabase", () => ({
  supabase: {
    auth: {
      signInWithOAuth: jest.fn(),
      signOut: jest.fn(),
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { origin: "https://web.test" },
  });
});

test("web Google sign-in starts Supabase OAuth with the current origin", async () => {
  jest.mocked(supabase.auth.signInWithOAuth).mockResolvedValue({
    data: { provider: "google", url: "https://accounts.google.test" },
    error: null,
  });

  await expect(authApi.signInWithGoogle()).resolves.toEqual({
    provider: "google",
    url: "https://accounts.google.test",
  });
  expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
    provider: "google",
    options: { redirectTo: "https://web.test" },
  });
});

test("web Google sign-in rejects Supabase OAuth errors", async () => {
  const oauthError = new Error("oauth unavailable");
  jest.mocked(supabase.auth.signInWithOAuth).mockResolvedValue({
    data: { provider: "google", url: null },
    error: oauthError,
  } as never);

  await expect(authApi.signInWithGoogle()).rejects.toBe(oauthError);
});

test("web logout clears the persisted Supabase browser session", async () => {
  jest.mocked(supabase.auth.signOut).mockResolvedValue({ error: null });

  await expect(authApi.signOut()).resolves.toBeUndefined();
  expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
});
