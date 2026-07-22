export const home = {
  greeting: {
    morning: "Good morning",
    afternoon: "Good afternoon",
    evening: "Good evening",
  },
  subtitle: "Your sonic environment awaits.",
  openProfile: "Open your profile",
  dailyDrop: {
    eyebrow: "TODAY'S DROP",
    fresh: "Fresh, just for you",
    making: "Making today's drop…",
  },
  hero: {
    live: "LIVE",
    onAir: "ON AIR",
    playTrack: "Play {{trackTitle}} from {{djName}}",
  },
  yourDjs: "Your DJs",
  newDj: "New DJ",
  create: "Create",
  djLimit: {
    title: "DJ limit reached",
    message: "You already have 2 DJs. Delete one to create another.",
  },
  freshFrequencies: "Fresh from your DJs",
  forYou: "For you",
  library: {
    title: "Personalized Library",
    generated: "GENERATED",
    aiMixes: "AI Mixes",
    saved: "SAVED",
    favorites: "Favorites",
    noFavorites: "No favorites yet",
  },
  vibe: {
    open: "Open your Vibe Check",
    thisWeek: "THIS WEEK",
    hours: "HOURS",
    mostly: "Mostly {{genre}}",
    streak_one: "{{count}}-day streak",
    streak_other: "{{count}}-day streak",
  },
  focus: {
    title: "Focus Mode",
    subtitle: "Music + a timer to lock in",
    start: "Start a focus session",
  },
  captionVoice: {
    stop: "Stop the DJ",
    hear: "Hear the DJ",
  },
  timeOfDay: {
    morning: {
      headline: "Easing you into the morning.",
      label: "For your morning",
    },
    afternoon: {
      headline: "Keeping your afternoon in flow.",
      label: "For your afternoon",
    },
    evening: {
      headline: "Something warm to wind down.",
      label: "For your evening",
    },
    lateNight: {
      headline: "Late-night frequencies, just for you.",
      label: "Late night",
    },
  },
} as const;
