import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  authMutationKey,
  captureAuthScope,
  invokeWithAuthScope,
  isCurrentMutationUser,
} from "@/src/api/auth-scope";
import { queryKeys } from "@/src/api/queries";
import { supabase } from "@/src/api/supabase";
import { isBetaSmokeUser } from "@/src/beta-smoke";
import {
  applyBetaSmokeExperienceAction,
  readBetaSmokeExperienceState,
} from "@/src/beta-smoke-storage";
import { useCurrentUser } from "@/src/hooks/use-auth";
import {
  experienceActions,
  type ExperienceAction,
} from "@/shared/experience-action";

export type ExperienceState = {
  introVersionSeen: number;
  firstOwnedTrackId: string | null;
  firstOwnedTrackReadyAt: string | null;
  preferenceNudgeStatus:
    | "ineligible"
    | "eligible"
    | "shown"
    | "dismissed"
    | "completed";
  preferenceNudgeTrackId: string | null;
};

const EXPERIENCE_STATE_COLUMNS = [
  "intro_version_seen",
  "first_owned_track_id",
  "first_owned_track_ready_at",
  "preference_nudge_status",
  "preference_nudge_track_id",
].join(", ");

const NUDGE_STATUSES = new Set<ExperienceState["preferenceNudgeStatus"]>([
  "ineligible",
  "eligible",
  "shown",
  "dismissed",
  "completed",
]);

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function nullableString(value: unknown): string | null | undefined {
  return value === null || typeof value === "string" ? value : undefined;
}

export function parseExperienceState(raw: unknown): ExperienceState {
  const value = record(raw);
  if (!value) throw new Error("Invalid experience state response");

  const firstOwnedTrackId = nullableString(value.first_owned_track_id);
  const firstOwnedTrackReadyAt = nullableString(value.first_owned_track_ready_at);
  const preferenceNudgeTrackId = nullableString(value.preference_nudge_track_id);
  if (
    !Number.isInteger(value.intro_version_seen) ||
    (value.intro_version_seen as number) < 0 ||
    firstOwnedTrackId === undefined ||
    firstOwnedTrackReadyAt === undefined ||
    preferenceNudgeTrackId === undefined ||
    typeof value.preference_nudge_status !== "string" ||
    !NUDGE_STATUSES.has(value.preference_nudge_status as ExperienceState["preferenceNudgeStatus"])
  ) {
    throw new Error("Invalid experience state response");
  }

  return {
    introVersionSeen: value.intro_version_seen as number,
    firstOwnedTrackId,
    firstOwnedTrackReadyAt,
    preferenceNudgeStatus:
      value.preference_nudge_status as ExperienceState["preferenceNudgeStatus"],
    preferenceNudgeTrackId,
  };
}

export function useExperienceState() {
  const user = useCurrentUser();
  const userId = user?.id ?? null;

  return useQuery({
    queryKey: queryKeys.experienceState.me(userId),
    enabled: !!userId,
    queryFn: async (): Promise<ExperienceState | null> => {
      if (isBetaSmokeUser(userId)) {
        return readBetaSmokeExperienceState(userId!);
      }
      const { data, error } = await supabase
        .from("user_experience_state")
        .select(EXPERIENCE_STATE_COLUMNS)
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data ? parseExperienceState(data) : null;
    },
  });
}

function useExperienceMutation<T>(operation: string, toAction: (value: T) => ExperienceAction) {
  const userId = useCurrentUser()?.id ?? "";
  const queryClient = useQueryClient();
  const queryKey = queryKeys.experienceState.me(userId || null);

  return useMutation({
    mutationKey: authMutationKey(operation, userId),
    mutationFn: async (value: T): Promise<ExperienceState> => {
      const action = toAction(value);
      if (isBetaSmokeUser(userId)) {
        return applyBetaSmokeExperienceAction(userId, action);
      }
      const { data, error } = await invokeWithAuthScope<{ state: unknown }>(
        supabase.functions,
        captureAuthScope(userId),
        "experience-state",
        { body: action },
      );
      if (error) throw error;
      return parseExperienceState(data?.state);
    },
    onSuccess: (state) => {
      if (!isCurrentMutationUser(userId)) return;
      queryClient.setQueryData(queryKey, state);
    },
  });
}

export function useSyncIntroVersion() {
  return useExperienceMutation("sync-experience-intro", experienceActions.syncIntro);
}

export function useClaimPreferenceNudge() {
  return useExperienceMutation("claim-experience-nudge", experienceActions.claimNudge);
}

export function useDismissPreferenceNudge() {
  return useExperienceMutation("dismiss-experience-nudge", experienceActions.dismissNudge);
}

export function useCompletePreferenceNudge() {
  return useExperienceMutation("complete-experience-nudge", experienceActions.completeNudge);
}
