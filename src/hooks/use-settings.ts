import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "./use-auth";
import { queryKeys } from "@/src/api/queries";
import {
  mergePreferences,
  patchPreferences,
  type UserPreferences,
  type UserPreferencesPatch,
} from "@/src/types/preferences";
import { supabase } from "@/src/api/supabase";

const updateQueues = new Map<string, Promise<void>>();

async function persistSettingsPatch(
  userId: string,
  patch: UserPreferencesPatch,
): Promise<void> {
  const { data, error: readError } = await supabase
    .from("profiles")
    .select("preferences")
    .eq("id", userId)
    .maybeSingle();

  if (readError) throw readError;

  const next = patchPreferences(mergePreferences(data?.preferences), patch);
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ preferences: next })
    .eq("id", userId);

  if (updateError) throw updateError;
}

function enqueueSettingsPatch(
  userId: string,
  patch: UserPreferencesPatch,
): Promise<void> {
  const previous = updateQueues.get(userId) ?? Promise.resolve();
  const operation = previous
    .catch(() => undefined)
    .then(() => persistSettingsPatch(userId, patch));
  const settled = operation.then(
    () => undefined,
    () => undefined,
  );
  updateQueues.set(userId, settled);
  void settled.then(() => {
    if (updateQueues.get(userId) === settled) updateQueues.delete(userId);
  });
  return operation;
}

export function useSettings() {
  const user = useCurrentUser();
  const queryKey = queryKeys.settings.me(user?.id ?? null);

  return useQuery({
    queryKey,
    enabled: !!user,
    queryFn: async (): Promise<UserPreferences> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("preferences")
        .eq("id", user!.id)
        .maybeSingle();

      if (error) throw error;

      return mergePreferences(data?.preferences);
    },
  });
}

export function useUpdateSettings() {
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const queryKey = queryKeys.settings.me(user?.id ?? null);

  return useMutation({
    mutationFn: async (patch: UserPreferencesPatch) => {
      if (!user) throw new Error("Cannot update settings without a user");
      await enqueueSettingsPatch(user.id, patch);
    },

    // Optimistically merge only the fields owned by this mutation.
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<UserPreferences>(queryKey);

      queryClient.setQueryData(
        queryKey,
        patchPreferences(previous ?? mergePreferences(null), patch),
      );

      return { previous };
    },
    onError: (_err, _next, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}
