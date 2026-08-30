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
import { isBetaSmokeUser } from "@/src/beta-smoke";
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

function betaSmokeDraft(
  kind: CreativeDraftResponse["kind"],
): CreativeDraftResponse {
  if (kind === "dj-identity") {
    return {
      version: 1,
      kind,
      draft: {
        candidates: [
          { name: "Night Cartographer", identityConcept: "Maps patient rhythms into luminous shared journeys." },
          { name: "Quiet Meridian", identityConcept: "Finds warm horizons inside slow-moving sound." },
          { name: "Lumen Atlas", identityConcept: "Guides ambient textures toward calm discovery." },
        ],
      },
    };
  }
  if (kind === "track-brief") {
    return {
      version: 1,
      kind,
      draft: {
        title: "First Light",
        creativeDirection: "A gentle ambient journey for beginning something new.",
        lyricTheme: null,
        lyrics: null,
        productionPlan: {
          bpm: 80,
          key: "C",
          meter: "4/4",
          sections: [],
          leadInstruments: ["soft synth"],
          rhythmInstruments: ["subtle pulse"],
          textureInstruments: ["wide pads"],
          energyArc: "steady",
          productionCharacter: ["luminous", "calm"],
          vocalDirection: null,
          visual: {
            concept: "A first sunrise over a quiet city.",
            subject: "soft horizon",
            medium: "digital painting",
            composition: "wide horizon",
            palette: ["blue", "gold"],
            lighting: "gentle dawn",
            texture: "soft grain",
          },
          novelty: { coreMotifs: ["first light"], avoidRecentMotifs: [] },
        },
      },
    };
  }
  if (kind === "track-title") {
    return { version: 1, kind, draft: { title: "First Light" } };
  }
  if (kind === "creative-direction") {
    return { version: 1, kind, draft: { creativeDirection: "A gentle ambient journey for beginning something new." } };
  }
  return { version: 1, kind, draft: { lyricTheme: null, lyrics: null } };
}

function useDraftMutation(kind: CreativeDraftResponse["kind"]) {
  const userId = useCurrentUser()?.id ?? "";
  return useMutation({
    mutationKey: queryKeys.creativeDraft.mutation(userId, kind),
    mutationFn: async (variables: IdentityVariables | TrackVariables) => {
      if (isBetaSmokeUser(userId)) {
        return betaSmokeDraft(kind);
      }
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
