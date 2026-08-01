import { createClient, type Session } from "@supabase/supabase-js";

import { useAuthStore } from "@/src/stores/auth-store";
import {
  AuthScopeChangedError,
  assertCurrentMutationUser,
  authMutationKey,
  captureAuthScope,
  invokeWithAuthScope,
  setAuthScopeHeader,
} from "../auth-scope";

function session(userId: string, token: string): Session {
  return {
    access_token: token,
    refresh_token: `refresh-${userId}`,
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id: userId,
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: "2026-01-01T00:00:00Z",
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

afterEach(() => useAuthStore.setState({ session: null }));

test("captured scope pins explicit authorization for Edge and PostgREST requests", async () => {
  useAuthStore.setState({ session: session("A", "token-a") });
  const scope = captureAuthScope("A");
  const invoke = jest.fn().mockResolvedValue({ data: { ok: true }, error: null });
  const builder = { setHeader: jest.fn().mockReturnThis() };

  useAuthStore.setState({ session: session("B", "token-b") });

  await invokeWithAuthScope({ invoke }, scope, "operation", { body: { id: 1 } });
  expect(invoke).toHaveBeenCalledWith("operation", {
    body: { id: 1 },
    headers: { Authorization: "Bearer token-a" },
  });
  expect(setAuthScopeHeader(builder, scope)).toBe(builder);
  expect(builder.setHeader).toHaveBeenCalledWith(
    "Authorization",
    "Bearer token-a",
  );
});
test("queued work refuses to capture a previous user's scope before I/O", () => {
  useAuthStore.setState({ session: session("A", "token-a") });
  const invoke = jest.fn();
  useAuthStore.setState({ session: session("B", "token-b") });

  expect(() => assertCurrentMutationUser("A")).toThrow(AuthScopeChangedError);
  expect(() => captureAuthScope("A")).toThrow(AuthScopeChangedError);
  expect(invoke).not.toHaveBeenCalled();
  expect(authMutationKey("save", "A")).toEqual(["auth-mutation", "save", "A"]);
});

test("explicit scope wins over a deferred ambient token lookup in the real client", async () => {
  useAuthStore.setState({ session: session("A", "token-a") });
  const scope = captureAuthScope("A");
  const ambient = deferred<string>();
  const fetchRequest = jest.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
    ({
      ok: true,
      status: 200,
      headers: new Headers({ "Content-Type": "application/json" }),
      json: async () => ({ ok: true }),
      text: async () => JSON.stringify({ ok: true }),
    }) as Response,
  );
  const realClient = createClient("https://project.supabase.co", "public-key", {
    accessToken: () => ambient.promise,
    global: { fetch: fetchRequest },
  });

  useAuthStore.setState({ session: session("B", "token-b") });
  const request = invokeWithAuthScope(
    realClient.functions,
    scope,
    "operation",
    { body: { id: 1 } },
  );
  expect(fetchRequest).not.toHaveBeenCalled();

  ambient.resolve("token-b");
  await expect(request).resolves.toMatchObject({
    data: { ok: true },
    error: null,
  });
  const headers = new Headers(fetchRequest.mock.calls[0]?.[1]?.headers);
  expect(headers.get("Authorization")).toBe("Bearer token-a");
});
