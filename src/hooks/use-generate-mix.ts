import { queryKeys } from "@/src/api/queries";
import { supabase } from "@/src/api/supabase";
import { upsertQueuedGenerationActivity } from "@/src/activity/generation-activity";
import type { ActivityItem } from "@/src/activity/types";
import { useLocale } from "@/src/i18n/use-locale";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "./use-auth";
import { authMutationKey, captureAuthScope, invokeWithAuthScope, isCurrentMutationUser } from "@/src/api/auth-scope";

type GenerateMixInput = {
  djId: string;
  title: string;
  lyrics?: string;
  isPublic: boolean;
};

export function useGenerateMix() {
  const { resolvedLanguage } = useLocale();
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const userId = user?.id ?? "";

  const start = useMutation({
    mutationKey: authMutationKey("generate-mix", userId),
    mutationFn: async ({ djId, lyrics, isPublic }: GenerateMixInput) => {
      const scope = captureAuthScope(userId);
      const { data, error } = await invokeWithAuthScope<{
        jobId: string;
        isPublic: boolean;
      }>(supabase.functions, scope, "generate-mix", {
        body: {
          djId,
          language: resolvedLanguage,
          localHour: new Date().getHours(),
          isPublic,
          ...(lyrics ? { lyrics } : {}),
        },
      });
      if (error) throw error;
      if (
        typeof data?.jobId !== "string" ||
        data.jobId.trim().length === 0 ||
        typeof data.isPublic !== "boolean"
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
          title: variables.title,
          retryLyrics: variables.lyrics ?? null,
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
