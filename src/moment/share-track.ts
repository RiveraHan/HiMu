import type {
  TrackMomentShareContent,
  TrackMomentShareResult,
} from "@/src/moment/moment-types";

export type ShareTrackMomentDependencies = Readonly<{
  platform: "android" | "web" | "unsupported";
  nativeShare?: (
    content: TrackMomentShareContent,
  ) => Promise<"shared" | "cancelled">;
  isSecureContext?: boolean;
  webShare?: (content: TrackMomentShareContent) => Promise<void>;
  copy?: (url: string) => Promise<void>;
}>;

function isBrowserShareCancellation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

async function copyTrackUrl(
  url: string,
  copy: ShareTrackMomentDependencies["copy"],
): Promise<TrackMomentShareResult> {
  if (!copy) return { outcome: "copy_unavailable" };

  try {
    await copy(url);
    return { outcome: "copied" };
  } catch {
    return { outcome: "copy_unavailable" };
  }
}

export async function shareTrackMoment(
  content: TrackMomentShareContent,
  dependencies: ShareTrackMomentDependencies,
): Promise<TrackMomentShareResult> {
  if (dependencies.platform === "android") {
    if (!dependencies.nativeShare) return { outcome: "unavailable" };

    try {
      const action = await dependencies.nativeShare(content);
      return action === "shared"
        ? { outcome: "shared" }
        : action === "cancelled"
          ? { outcome: "cancelled" }
          : { outcome: "unavailable" };
    } catch {
      return { outcome: "unavailable" };
    }
  }

  if (dependencies.platform !== "web") {
    return { outcome: "unavailable" };
  }

  if (dependencies.isSecureContext && dependencies.webShare) {
    try {
      await dependencies.webShare(content);
      return { outcome: "shared" };
    } catch (error) {
      if (isBrowserShareCancellation(error)) {
        return { outcome: "cancelled" };
      }
    }
  }

  return copyTrackUrl(content.url, dependencies.copy);
}
