export const queryKeys = {
  auth: { session: ["auth", "session"] as const },
  djs: {
    all: ["djs"] as const,
    details: (id: string) => ["djs", id] as const,
  },
  creators: {
    all: ["creators"] as const,
    details: (id: string) => ["creators", id] as const,
  },
  tracks: {
    all: ["tracks"] as const,
    details: (id: string) => ["tracks", id] as const,
    myMood: (mood: string) => ["tracks", "mood", mood] as const,
    byDj: (id: string) => ["tracks", "dj", id] as const,
  },
  playlists: {
    all: ["playlists"] as const,
    details: (id: string) => ["playlists", id] as const,
  },
  sessions: {
    all: ["sessions"] as const,
    live: ["sessions", "live"] as const,
  },
  community: {
    all: ["community"] as const,
    posts: (communityId: string) => ["community", "post", communityId] as const,
  },
  stats: {
    vibeCheck: ["stats", "vibe-check"] as const,
    listening: ["stats", "listening"] as const,
  },
  profile: {
    me: ["profile", "me"] as const,
  },
  settings: {
    me: ["settings", "me"] as const,
  },
  musicPreferences: {
    me: ["music-preferences", "me"] as const,
  },
};
