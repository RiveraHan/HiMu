import type { Visibility } from "@/src/types/content-visibility";

export type ActivityKind = "mix" | "create-dj" | "update-dj" | "cover";

export type ActivityFailureReason =
  | "generationFailed"
  | "stalled"
  | "operationFailed";

export type ActivityDetail = "portraitUnavailable" | null;

export type ActivityStatus =
  | "queued"
  | "running"
  | "slow"
  | "ready"
  | "failed";

export type ActivityItem = {
  id: string;
  source: "server" | "mutation";
  kind: ActivityKind;
  status: ActivityStatus;
  title: string;
  djId: string | null;
  trackId: string | null;
  createdAt: string;
  updatedAt: string;
  error: string | null;
  failureReason: ActivityFailureReason | null;
  recoveryAvailable: boolean;
  retryLyrics: string | null;
  visibility?: Visibility | null;
  detail: ActivityDetail;
  seen: boolean;
};

export type GenerationJobRow = {
  id: string;
  user_id: string;
  dj_id: string;
  status: string;
  prompt: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
  drop_date: string | null;
  track_id: string | null;
  is_public: boolean;
  djs: { id: string; name: string } | null;
  tracks: {
    id: string;
    title: string;
    artist: string;
    audio_url: string | null;
    album_art_url: string | null;
    duration: number | null;
    genre: string | null;
  } | null;
};
