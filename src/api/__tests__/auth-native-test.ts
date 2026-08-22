import { GoogleSignin } from "@react-native-google-signin/google-signin";

import { supabase } from "@/src/api/supabase";
import { authApi } from "../auth.native";

jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(),
    signIn: jest.fn(),
    getTokens: jest.fn(),
    signOut: jest.fn(),
  },
}));

jest.mock("@/src/api/supabase", () => ({
  supabase: {
    auth: {
      signInWithIdToken: jest.fn(),
      signOut: jest.fn(),
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

test("native Google sign-in exchanges the provider ID token with Supabase", async () => {
  jest.mocked(GoogleSignin.signIn).mockResolvedValue({ type: "success" } as never);
  jest.mocked(GoogleSignin.getTokens).mockResolvedValue({
    idToken: "native-id-token",
    accessToken: "provider-access-token",
  });
  jest.mocked(supabase.auth.signInWithIdToken).mockResolvedValue({
    data: { user: null, session: null },
    error: null,
  } as never);

  await expect(authApi.signInWithGoogle()).resolves.toEqual({
    user: null,
    session: null,
  });
  expect(GoogleSignin.hasPlayServices).toHaveBeenCalledTimes(1);
  expect(supabase.auth.signInWithIdToken).toHaveBeenCalledWith({
    provider: "google",
    token: "native-id-token",
  });
});

test("native Google cancellation does not create a Supabase session", async () => {
  jest.mocked(GoogleSignin.signIn).mockResolvedValue({ type: "cancelled" } as never);

  await expect(authApi.signInWithGoogle()).resolves.toBeNull();
  expect(GoogleSignin.getTokens).not.toHaveBeenCalled();
  expect(supabase.auth.signInWithIdToken).not.toHaveBeenCalled();
});

test("native logout clears Supabase even when provider logout fails", async () => {
  jest.mocked(GoogleSignin.signOut).mockRejectedValue(new Error("provider unavailable"));
  jest.mocked(supabase.auth.signOut).mockResolvedValue({ error: null });

  await expect(authApi.signOut()).resolves.toBeUndefined();
  expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
});
