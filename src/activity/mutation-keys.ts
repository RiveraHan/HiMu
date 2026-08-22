export const activityMutationKeys = {
  createDjRoot: ["activity", "create-dj"] as const,
  createDj: (userId: string) => ["activity", "create-dj", userId] as const,
  updateDjRoot: ["activity", "update-dj"] as const,
  updateDj: (userId: string) => ["activity", "update-dj", userId] as const,
  regenerateCoverRoot: ["activity", "cover"] as const,
  regenerateCover: (userId: string) =>
    ["activity", "cover", userId] as const,
};
