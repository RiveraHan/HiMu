export type ProviderReservation =
  | {
    outcome: "created" | "existing";
    eventId: string;
    limit: number;
    resourceId: string | null;
  }
  | {
    outcome: "quota";
    eventId: null;
    limit: number;
    resourceId: null;
  };

export function mapProviderReservation(
  data: unknown,
  error?: unknown,
): ProviderReservation {
  if (error) throw error;
  if (!Array.isArray(data) || data.length !== 1) {
    throw new Error("invalid provider reservation result");
  }

  const row = data[0] as Record<string, unknown>;
  if (!Number.isInteger(row.daily_limit) || (row.daily_limit as number) <= 0) {
    throw new Error("invalid provider reservation result");
  }
  const limit = row.daily_limit as number;

  if (
    row.outcome === "quota" && row.event_id === null &&
    row.resource_id === null
  ) {
    return {
      outcome: "quota",
      eventId: null,
      limit,
      resourceId: null,
    };
  }

  if (
    (row.outcome === "created" || row.outcome === "existing") &&
    typeof row.event_id === "string" && row.event_id.length > 0 &&
    (row.resource_id === null ||
      (typeof row.resource_id === "string" && row.resource_id.length > 0))
  ) {
    return {
      outcome: row.outcome,
      eventId: row.event_id,
      limit,
      resourceId: row.resource_id,
    };
  }

  throw new Error("invalid provider reservation result");
}
