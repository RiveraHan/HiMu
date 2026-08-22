import {
  assertCurrentMutationUser,
  captureAuthScope,
  invokeWithAuthScope,
} from "@/src/api/auth-scope";
import { queryKeys } from "@/src/api/queries";
import { supabase } from "@/src/api/supabase";
import type {
  CreativeDraftRequest,
  CreativeDraftResponse,
  TrackDraftKind,
} from "@/src/types/creative-generation";
import { useMutation } from "@tanstack/react-query";
import { useCurrentUser } from "./use-auth";

type IdentityVariables = Omit<
  Extract<CreativeDraftRequest, { kind: "dj-identity" }>,
  "version" | "kind" | "exclude"
> & { exclude?: string[] };

type TrackVariables = Omit<
  Extract<CreativeDraftRequest, { kind: TrackDraftKind }>,
  "version" | "kind" | "exclude"
> & { exclude?: string[] };

function boundedExclusions(values: string[] | undefined): string[] {
  const unique = new Map<string, string>();
  for (const value of values ?? []) {
    const normalized = value.trim().replace(/\s+/g, " ").slice(0, 80);
    if (!normalized) continue;
    const key = normalized.toLocaleLowerCase();
    unique.delete(key);
    unique.set(key, normalized);
  }
  return [...unique.values()].slice(-10);
}

function useDraftMutation(kind: CreativeDraftResponse["kind"]) {
  const userId = useCurrentUser()?.id ?? "";
  return useMutation({
    mutationKey: queryKeys.creativeDraft.mutation(userId, kind),
    mutationFn: async (variables: IdentityVariables | TrackVariables) => {
      const scope = captureAuthScope(userId);
      const body = {
        ...variables,
        version: 1 as const,
        kind,
        exclude: boundedExclusions(variables.exclude),
      } as CreativeDraftRequest;
      const { data, error } = await invokeWithAuthScope<CreativeDraftResponse>(
        supabase.functions,
        scope,
        "creative-draft",
        { body },
      );
      assertCurrentMutationUser(userId);
      if (error) throw error;
      if (!data || data.version !== 1 || data.kind !== kind) {
        throw new Error("creative-draft returned an invalid response");
      }
      return data;
    },
  });
}

export function useDjIdentityDrafts() {
  return useDraftMutation("dj-identity") as ReturnType<typeof useDraftMutation> & {
    mutateAsync: (variables: IdentityVariables) => Promise<CreativeDraftResponse>;
  };
}

export function useTrackBriefDraft() {
  return useDraftMutation("track-brief") as ReturnType<typeof useDraftMutation> & {
    mutateAsync: (variables: TrackVariables) => Promise<CreativeDraftResponse>;
  };
}

export function useRegenerateTrackField(
  kind: Exclude<TrackDraftKind, "track-brief">,
) {
  return useDraftMutation(kind) as ReturnType<typeof useDraftMutation> & {
    mutateAsync: (variables: TrackVariables) => Promise<CreativeDraftResponse>;
  };
}
