export type TrackMomentVisibility = "private" | "public";

export type TrackMomentFeedbackPatch = Readonly<{
  trackId: string;
  surprised?: boolean;
  wouldShare?: boolean;
}>;

export type PublicTrackMoment = Readonly<{
  id: string;
  title: string;
  artist: string;
  albumArtUrl: string | null;
  audioUrl: string;
  duration: number | null;
  genre: string | null;
  moods: readonly string[];
}>;

export type TrackMomentShareContent = Readonly<{
  url: string;
  title: string;
  message?: string;
}>;

export type TrackMomentShareOutcome =
  | "shared"
  | "copied"
  | "copy_unavailable"
  | "cancelled"
  | "unavailable";

export type TrackMomentShareResult = Readonly<{
  outcome: TrackMomentShareOutcome;
}>;
