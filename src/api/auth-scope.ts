import type {
  FunctionInvokeOptions,
  FunctionsResponse,
} from "@supabase/functions-js";

import { useAuthStore } from "@/src/stores/auth-store";

export class AuthScopeChangedError extends Error {
  constructor() {
    super("Authentication scope changed");
    this.name = "AuthScopeChangedError";
  }
}

export type AuthScope = Readonly<{
  userId: string;
  authorization: string;
}>;

export function isCurrentMutationUser(expectedUserId: string): boolean {
  return useAuthStore.getState().session?.user.id === expectedUserId;
}

export function assertCurrentMutationUser(expectedUserId: string): void {
  if (!isCurrentMutationUser(expectedUserId)) {
    throw new AuthScopeChangedError();
  }
}

export function captureAuthScope(expectedUserId: string): AuthScope {
  const session = useAuthStore.getState().session;
  if (
    session?.user.id !== expectedUserId ||
    typeof session.access_token !== "string" ||
    session.access_token.length === 0
  ) {
    throw new AuthScopeChangedError();
  }

  return Object.freeze({
    userId: expectedUserId,
    authorization: `Bearer ${session.access_token}`,
  });
}

type EdgeFunctionsLike = {
  invoke(functionName: string, options?: FunctionInvokeOptions): Promise<unknown>;
};

export function invokeWithAuthScope<T = unknown>(
  functions: EdgeFunctionsLike,
  scope: AuthScope,
  functionName: string,
  options: FunctionInvokeOptions = {},
): Promise<FunctionsResponse<T>> {
  return functions.invoke(functionName, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: scope.authorization,
    },
  }) as Promise<FunctionsResponse<T>>;
}

type HeaderBuilder = {
  setHeader?(name: string, value: string): unknown;
};

export function setAuthScopeHeader<T extends HeaderBuilder>(
  builder: T,
  scope: AuthScope,
): T {
  return typeof builder.setHeader === "function"
    ? (builder.setHeader("Authorization", scope.authorization) as T)
    : builder;
}

export function authMutationKey(operation: string, userId: string) {
  return ["auth-mutation", operation, userId] as const;
}
