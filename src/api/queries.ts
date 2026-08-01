export const queryKeys = {
  auth: { session: ["auth", "session"] as const },
  djs: {
    all: ["djs"] as const,
    list: (userId: string | null) => ["djs", "list", userId] as const,
    details: (userId: string | null, id: string) =>
      ["djs", "detail", userId, id] as const,
  },
  creators: {
    all: ["creators"] as const,
    details: (id: string) => ["creators", id] as const,
  },
  tracks: {
    all: ["tracks"] as const,
    aiMix: (userId: string | null) => ["tracks", "ai-mix", userId] as const,
    focus: (userId: string | null) => ["tracks", "focus", userId] as const,
    recent: (userId: string | null, limit: number) =>
      ["tracks", "recent", userId, limit] as const,
    contextual: (userId: string | null, bucket: string) =>
      ["tracks", "contextual", userId, bucket] as const,
    details: (userId: string | null, id: string) =>
      ["tracks", "detail", userId, id] as const,
    myMood: (userId: string | null, mood: string) =>
      ["tracks", "mood", userId, mood] as const,
    byDj: (userId: string | null, id: string) =>
      ["tracks", "dj", userId, id] as const,
    ownership: (userId: string | null, id: string) =>
      ["tracks", "ownership", userId, id] as const,
  },
  generationJobs: {
    detail: (userId: string | null, jobId: string | null) =>
      ["generation-job", userId, jobId] as const,
    activity: (userId: string | null) =>
      ["generation-jobs", "activity", userId] as const,
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
    vibeCheck: (userId: string | null) =>
      ["stats", userId, "vibe-check"] as const,
    listening: (userId: string | null) =>
      ["stats", userId, "listening"] as const,
    djsHeard: (userId: string | null) =>
      ["stats", userId, "djs-heard"] as const,
    topGenre: (userId: string | null) =>
      ["stats", userId, "top-genre"] as const,
  },
  profile: {
    me: (userId: string | null) => ["profile", userId] as const,
  },
  settings: {
    me: (userId: string | null) => ["settings", "me", userId] as const,
  },
  musicPreferences: {
    me: (userId: string | null) => ["music-preferences", userId] as const,
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
    all: (userId: string | null) => ["favorites", userId] as const,
    isFavorited: (userId: string | null, trackId: string) =>
      ["favorites", userId, "is-favorited", trackId] as const,
  },
};
