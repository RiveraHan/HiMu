import { useMemo } from "react";

import { CreateDjIdentityStep } from "@/src/components/dj/CreateDjIdentityStep";
import { useDjIdentityController } from "@/src/hooks/use-dj-identity-controller";
import type { DjDraftTraits } from "@/src/types/creative-generation";

export type DjIdentityDraftValue = {
  name: string;
  identityConcept: string;
  provenance: "suggested" | "edited" | "custom";
  confirmed: boolean;
};

type Props = Readonly<{
  active?: boolean;
  traits: DjDraftTraits;
  value: DjIdentityDraftValue;
  onChange: (value: DjIdentityDraftValue) => void;
  disabled?: boolean;
}>;

function traitsFingerprint(traits: DjDraftTraits): string {
  return JSON.stringify([traits.genres, traits.moods, traits.energy, traits.isInstrumental, traits.vibe]);
}

/** @deprecated New create flows keep the controller mounted and render CreateDjIdentityStep only while active. */
export function DjIdentityDraftStep({ active = false, traits, value, onChange, disabled = false }: Props) {
  const fingerprint = useMemo(() => traitsFingerprint(traits), [traits]);
  const controller = useDjIdentityController({ active, fingerprint, traits, value, onChange, disabled });
  return <CreateDjIdentityStep active={active} controller={controller} value={value} disabled={disabled} />;
}
