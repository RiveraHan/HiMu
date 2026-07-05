import { queryKeys } from "@/src/api/queries";
import { supabase } from "@/src/api/supabase";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

// Requests a new mix from a DJ and polls the job until it's ready.
export function useGenerateMix() {
  const [jobId, setJobId] = useState<string | null>(null);

  const start = useMutation({
    mutationFn: async ({ djId, lyrics }: { djId: string; lyrics?: string }) => {
      const { data, error } = await supabase.functions.invoke<{
        jobId: string;
      }>("generate-mix", {
        body: {
          djId,
          localHour: new Date().getHours(),
          ...(lyrics ? { lyrics } : {}),
        },
      });
      if (error) throw error;
      if (!data?.jobId) throw new Error("generate-mix did not return a jobId");
      return data.jobId;
    },
    onSuccess: setJobId,
  });

  const job = useQuery({
    queryKey: queryKeys.generationJobs.detail(jobId),
    enabled: !!jobId,
    // Poll state machine: every 3s until it finishes.
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s === "ready" || s === "failed" ? false : 3000;
    },
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generation_jobs")
        .select("status, error, track_id, tracks(*)")
        .eq("id", jobId!)
        .single();

      if (error) throw error;

      return data;
    },
  });

  const reset = () => setJobId(null);

  return {
    generate: start.mutate,
    isStarting: start.isPending,
    status: job.data?.status ?? (start.isPending ? "queued" : null),
    track: job.data?.tracks ?? null, // ready for load() when status === "ready"
    error: job.data?.error ?? null,
    reset,
  };
}
