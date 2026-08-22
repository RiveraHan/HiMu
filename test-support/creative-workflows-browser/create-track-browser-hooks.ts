const privateSourceLyrics =
  "[Verse]\nOwner-private source line\n[Chorus]\nKeep this version private";

export function useTrackBriefDraft() {
  return {
    isPending: false,
    mutateAsync: async () => ({
      version: 1 as const,
      kind: "track-brief" as const,
      draft: {
        title: "Prepared Horizon",
        creativeDirection:
          "Open with a patient pulse before the arrangement reaches the morning light.",
        lyricTheme: "holding a private memory with care",
        lyrics: "provider lyrics must not replace the private source",
      },
    }),
  };
}

export function useRegenerateTrackField(kind: string) {
  return {
    isPending: false,
    mutateAsync: async () => {
      if (kind === "track-title") {
        return {
          version: 1 as const,
          kind: "track-title" as const,
          draft: { title: "Another Horizon" },
        };
      }
      if (kind === "creative-direction") {
        return {
          version: 1 as const,
          kind: "creative-direction" as const,
          draft: {
            creativeDirection:
              "Let the private motif expand slowly through warm harmonic layers.",
          },
        };
      }
      return {
        version: 1 as const,
        kind: "lyrics" as const,
        draft: {
          lyricTheme: "a private signal returning home",
          lyrics: "[Verse]\nA private light\n[Chorus]\nReturns tonight",
        },
      };
    },
  };
}

export function useCurrentUser() {
  return { id: "browser-owner" };
}

export function useDJ() {
  return {
    data: {
      id: "dj-browser",
      name: "Lumen",
      identity_concept: "A careful guide for warm, hopeful private songs.",
      slug: "lumen",
      avatar_url: null,
      character: "patient",
      genre_specialties: ["Pop"],
      mood_tags: ["Hopeful"],
      is_premium: false,
      voice_style: null,
      owner_id: "browser-owner",
      is_public: false,
      personality_traits: {
        energy: 6,
        vibe: "Patient sunrise",
        isInstrumental: false,
      },
    },
    fetchStatus: "idle" as const,
    isError: false,
    isLoading: false,
    isPending: false,
    isSuccess: true,
    refetch: async () => undefined,
  };
}

export function useOnlineStatus() {
  return true;
}

export function useMiniPlayerPadding() {
  return 0;
}

export function useTrackPrivateDetails(trackId: string | undefined, owned: boolean) {
  return {
    data: trackId === "source-browser" && owned
      ? {
          trackId: "source-browser",
          confirmedLyrics: privateSourceLyrics,
          djId: "dj-browser",
        }
      : null,
    isFetched: true,
  };
}

export function useGenerateMix() {
  return {
    generateAsync: async () => {
      const browserWindow = window as typeof window & {
        __HIMU_GENERATE_CALLS__?: number;
      };
      browserWindow.__HIMU_GENERATE_CALLS__ =
        (browserWindow.__HIMU_GENERATE_CALLS__ ?? 0) + 1;
      return { jobId: "browser-job" };
    },
    isStarting: false,
    error: null,
  };
}

export function useActivity() {
  return { activeMixForDj: () => null };
}

export { privateSourceLyrics };
