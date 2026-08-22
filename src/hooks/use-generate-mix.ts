import { queryKeys } from "@/src/api/queries";
import { supabase } from "@/src/api/supabase";
import { upsertQueuedGenerationActivity } from "@/src/activity/generation-activity";
import type { ActivityItem } from "@/src/activity/types";
import { useLocale } from "@/src/i18n/use-locale";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "./use-auth";
import { authMutationKey, captureAuthScope, invokeWithAuthScope, isCurrentMutationUser } from "@/src/api/auth-scope";
import type { ConfirmedGenerationBriefV1 } from "@/src/types/creative-generation";

type GenerateMixInput = {
  djId: string;
  brief: ConfirmedGenerationBriefV1;
  sourceTrackId?: string | null;
};

type GenerateMixResponse = {
  jobId: string;
  isPublic: boolean;
  brief: ConfirmedGenerationBriefV1;
  sourceTrackId: string | null;
};

function isConfirmedBrief(value: unknown): value is ConfirmedGenerationBriefV1 {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const brief = value as Record<string, unknown>;
  return brief.version === 1 && typeof brief.title === "string" &&
    typeof brief.creativeDirection === "string" &&
    (brief.mode === "instrumental" || brief.mode === "vocal") &&
    (brief.visibility === "private" || brief.visibility === "public") &&
    typeof brief.traitSnapshot === "object" && brief.traitSnapshot != null;
}

export function useGenerateMix() {
  const { resolvedLanguage } = useLocale();
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const userId = user?.id ?? "";

  const start = useMutation({
    mutationKey: authMutationKey("generate-mix", userId),
    mutationFn: async (input: GenerateMixInput) => {
      const { djId, brief, sourceTrackId = null } = input;
      const scope = captureAuthScope(userId);
      const { data, error } = await invokeWithAuthScope<GenerateMixResponse>(
        supabase.functions,
        scope,
        "generate-mix",
        {
        body: {
          djId,
          brief,
          sourceTrackId,
          language: resolvedLanguage,
          localHour: new Date().getHours(),
        },
      });
      if (error) throw error;
      if (
        typeof data?.jobId !== "string" ||
        data.jobId.trim().length === 0 ||
        typeof data.isPublic !== "boolean" ||
        !isConfirmedBrief(data.brief) ||
        (data.sourceTrackId !== null && typeof data.sourceTrackId !== "string")
      ) {
        throw new Error("generate-mix returned an invalid response");
      }
      return data;
    },
    onSuccess: (data, variables) => {
      if (!isCurrentMutationUser(userId)) return;
      const queryKey = queryKeys.generationJobs.activity(userId);
      queryClient.setQueryData<ActivityItem[]>(queryKey, (current) =>
        upsertQueuedGenerationActivity(current, {
          jobId: data.jobId,
          djId: variables.djId,
          title: data.brief.title,
          retryLyrics: null,
          retryBrief: data.brief,
          sourceTrackId: data.sourceTrackId,
          visibility: data.isPublic ? "public" : "private",
          nowMs: Date.now(),
        }),
      );
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    generate: start.mutate,
    generateAsync: start.mutateAsync,
    isStarting: start.isPending,
    error: start.error,
  };
}
