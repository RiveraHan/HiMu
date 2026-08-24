import type { ProviderReservation } from "../_shared/provider-usage.ts";

export type AvatarReservationInput = {
  userId: string;
  operation: "initial_avatar" | "avatar_regen";
  requestId: string;
};

export async function runAvatarGeneration<T>(
  input: AvatarReservationInput,
  dependencies: {
    reserve: (input: AvatarReservationInput) => Promise<ProviderReservation>;
    generate: () => Promise<T>;
  },
): Promise<
  | { outcome: "quota"; limit: number }
  | { outcome: "generated"; value: T }
> {
  const reservation = await dependencies.reserve(input);
  if (reservation.outcome === "quota") {
    return { outcome: "quota", limit: reservation.limit };
  }

  return { outcome: "generated", value: await dependencies.generate() };
}
