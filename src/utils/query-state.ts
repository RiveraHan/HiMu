type FetchStatus = "fetching" | "paused" | "idle";

export type InitialQueryState<T> = {
  data: T | undefined;
  isPending: boolean;
  fetchStatus: FetchStatus;
};

export function isInitialQueryLoading<T>({
  data,
  isPending,
  fetchStatus,
}: InitialQueryState<T>): boolean {
  return data === undefined && isPending && fetchStatus !== "idle";
}
