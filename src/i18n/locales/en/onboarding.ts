export const onboarding = {
  welcome: {
    eyebrow: "WELCOME TO HIMU",
    pages: {
      intro: {
        title: "YOUR MUSIC, IN THE RIGHT MOMENT",
        body: "HiMu blends AI-created music, curated drops, and listening tools around your mood.",
      },
      djs: {
        title: "MEET YOUR AI DJS",
        body: "Each DJ has a distinct sound and personality. Listen, favorite tracks, and shape what comes next.",
      },
    },
    pageCount: "Page {{page}} of {{count}}",
    actions: {
      skip: "Skip",
      back: "Back",
      continue: "Continue",
      showAround: "Show me around",
    },
    accessibility: {
      announcement: "{{title}}. {{body}} Page {{page}} of {{count}}",
      skip: "Skip introduction",
      back: "Back to introduction page {{page}}",
      continue: "Continue introduction",
      showAround: "Show me around HiMu",
    },
  },
  home: {
    dailyDrop: {
      title: "START HERE",
      description: "Your Daily Drop is a fresh track selected for this moment.",
    },
    djs: {
      title: "DIFFERENT MINDS, DIFFERENT SOUNDS",
      description: "Each AI DJ has a distinct sound and personality.",
    },
    discover: {
      title: "GO BEYOND YOUR FEED",
      description: "Search and explore more music whenever you want.",
    },
  },
  contextual: {
    discoverSearch: {
      title: "SEARCH THE WHOLE SOUND",
      description: "Find tracks, moods, and artists beyond your Home feed.",
    },
    djHero: {
      title: "GET TO KNOW YOUR DJ",
      description: "Each DJ has a personality, sound, and evolving relationship with your taste.",
    },
  },
  tooltip: {
    eyebrow: "GUIDED TOUR",
    stepCount: "Step {{step}} of {{count}}",
    progress: "Tour progress, step {{step}} of {{count}}",
    interactionHint: "Tap the highlight or use Next",
    actions: {
      back: "Back",
      skip: "Skip",
      next: "Next",
    },
    accessibility: {
      announcement: "{{title}}. {{description}} Step {{step}} of {{count}}",
      back: "Back to tour step {{step}}",
      skip: "Skip tour",
      next: "Next to tour step {{step}}",
      finish: "Finish tour steps",
    },
  },
  continueTour: {
    eyebrow: "GUIDED TOUR",
    title: "KEEP EXPLORING HIMU",
    body: "Pick up where you left off.",
    actions: {
      continue: "Continue tour",
      end: "End tour",
    },
    accessibility: {
      continue: "Continue guided tour",
      dismiss: "Dismiss guided tour",
    },
  },
  completion: {
    eyebrow: "TOUR COMPLETE",
    title: "YOU’RE READY",
    body: "HiMu gets better as you listen. Start with today’s sound and make it yours.",
    announcement: "You’re ready. Guided tour complete.",
    accessibility: "You’re ready. HiMu gets better as you listen. Start with today’s sound and make it yours.",
    actions: {
      playToday: "Play today’s drop",
      finish: "Finish",
    },
  },
  replay: {
    action: "Replay product tour",
  },
} as const;
