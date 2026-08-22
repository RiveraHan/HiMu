const candidates = [
  {
    name: "Static Bloom",
    identityConcept:
      "A patient selector tracing city lights through warm analog haze.",
  },
  {
    name: "Velvet Index",
    identityConcept:
      "A curious archivist reshaping forgotten dance floors into intimate rituals.",
  },
  {
    name: "Orbit Mercy",
    identityConcept:
      "A celestial night guide balancing kinetic rhythm with quiet gravity.",
  },
];

export function useCreateDJ() {
  return {
    isPending: false,
    mutate: () => {
      const browserWindow = window as typeof window & {
        __HIMU_CREATE_CALLS__?: number;
      };
      browserWindow.__HIMU_CREATE_CALLS__ =
        (browserWindow.__HIMU_CREATE_CALLS__ ?? 0) + 1;
    },
  };
}

export function useDjIdentityDrafts() {
  return {
    error: null,
    isPending: false,
    mutateAsync: async () => ({
      version: 1 as const,
      kind: "dj-identity" as const,
      draft: { candidates },
    }),
  };
}

export function useMiniPlayerPadding() {
  return 0;
}

export function useCurrentUser() {
  return { id: "browser-owner" };
}

export function useDJ() {
  return {
    data: {
      id: "dj-browser",
      name: "Lumen",
      identity_concept: "A focused ambient guide.",
      slug: "lumen",
      avatar_url: null,
      character: null,
      genre_specialties: ["Ambient"],
      mood_tags: ["Focus"],
      is_premium: false,
      voice_style: null,
      owner_id: "browser-owner",
      is_public: false,
      personality_traits: {
        energy: 6,
        vibe: "Patient night drive",
        isInstrumental: true,
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

export function usePhaseRotation(phases: readonly string[]) {
  return phases[0];
}

export function useUpdateDJ() {
  return {
    isPending: false,
    mutate: () => {
      const browserWindow = window as typeof window & {
        __HIMU_UPDATE_CALLS__?: number;
      };
      browserWindow.__HIMU_UPDATE_CALLS__ =
        (browserWindow.__HIMU_UPDATE_CALLS__ ?? 0) + 1;
    },
  };
}
