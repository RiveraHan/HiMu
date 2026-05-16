export const APP_NAME = "HiMu";
export const APP_TAGLINE = "Your AI Music Companion";

export const DEFAULT_DJ_CONFIGS = {
  nova: {
    name: "Nova",
    basePrompt:
      "Lo-fi ambient, soft piano, gentle pads, melancholic, poetic atmosphere",
    isInstrumental: true,
    temperature: 0.6,
    maxDuration: 120,
    personalityTraits: ["calm", "introspective", "poetic"],
  },
  axon: {
    name: "Axon",
    basePrompt:
      "Techno house, driving bassline, energetic drop, 128 BPM, club atmosphere",
    isInstrumental: true,
    temperature: 1.2,
    maxDuration: 180,
    personalityTraits: ["energetic", "confident", "direct"],
  },
  luna: {
    name: "Luna",
    basePrompt:
      "Dreamy synth-pop, ethereal vocals, soft beats, nighttime vibes",
    isInstrumental: true,
    temperature: 0.8,
    maxDuration: 150,
    personalityTraits: ["dreamy", "gentle", "mysterious"],
  },
  spark: {
    name: "Spark",
    basePrompt:
      "Upbeat electronic, catchy melodies, bright synths, feel-good energy",
    isInstrumental: true,
    temperature: 1.1,
    maxDuration: 200,
    personalityTraits: ["cheerful", "creative", "playful"],
  },
} as const;

export const STORAGE_KEYS = {
  AUTH_TOKEN: "himu_auth_token",
  REFRESH_TOKEN: "himu_refresh_token",
  USER_PREFERENCES: "himu_user_preferences",
  PLAYER_STATE: "himu_player_state",
} as const;

export const MUSIC_GEN = {
  DEFAULT_TIMEOUT: 60000, // 60s for generation
  MAX_TRACK_DURATION: 300, // 5 minutes
  FREE_TIER_DAILY_LIMIT: 10, // tracks per day
} as const;

export const AUDIO = {
  DEFAULT_VOLUME: 1.0,
  FADE_DURATION: 500, // ms
  BUFFER_SIZE: 1024,
} as const;

export const QUERY_KEYS = {
  TRACKS: "tracks",
  DJS: "djs",
  CREATORS: "creators",
  PLAYLISTS: "playlists",
  SESSIONS: "sessions",
  PROFILE: "profile",
  COMMUNITY: "community",
  GENERATED_TRACKS: "generated-tracks",
} as const;
