export const common = {
  actions: {
    back: "Back",
    close: "Close",
    cancel: "Cancel",
    confirm: "Confirm",
    retry: "Retry",
    dismiss: "Dismiss",
    play: "Play",
    pause: "Pause",
    next: "Next",
    previous: "Previous",
    remove: "Remove",
  },
  states: {
    loading: "Loading",
    empty: "No content",
  },
  errors: {
    generic: "Something went wrong. Please try again.",
    savePreference: "We couldn't sync your preference. It will be kept on this device.",
  },
} as const;
