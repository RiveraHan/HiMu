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
    aiMix: ["tracks", "ai-mix"] as const,
    focus: ["tracks", "focus"] as const,
    recent: ["tracks", "recent"] as const,
    contextual: (bucket: string) => ["tracks", "contextual", bucket] as const,
    details: (id: string) => ["tracks", id] as const,
    myMood: (mood: string) => ["tracks", "mood", mood] as const,
    byDj: (id: string) => ["tracks", "dj", id] as const,
    ownership: (id: string) => ["tracks", "ownership", id] as const,
  },
  generationJobs: {
    detail: (jobId: string | null) => ["generation-job", jobId] as const,
  },
  playlists: {
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
    djsHeard: ["stats", "djs-heard"] as const,
    topGenre: ["stats", "top-genre"] as const,
  },
  profile: {
    me: ["profile", "me"] as const,
  },
  settings: {
    me: (userId: string | null) => ["settings", "me", userId] as const,
  },
  musicPreferences: {
    me: ["music-preferences", "me"] as const,
  },
  onboarding: {
    current: (userId: string, version: number) =>
      ["onboarding", userId, version] as const,
  },
  audius: {
    trending: (genre: string) => ["audius", "trending", genre] as const,
    search: (q: string) => ["audius", "search", q] as const,
  },
  favorites: {
    all: ["favorites"] as const,
    isFavorited: (trackId: string) =>
      ["favorites", "is-favorited", trackId] as const,
  },
};
