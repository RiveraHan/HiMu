export type Href = string;

export const router = {
  back: () => undefined,
  canGoBack: () => true,
  push: () => undefined,
  replace: () => undefined,
};

export function useLocalSearchParams<T>() {
  return {
    djId: "dj-browser",
    sourceTrackId: "source-browser",
  } as T;
}
