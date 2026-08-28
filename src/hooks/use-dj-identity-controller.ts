import { useEffect, useRef, useState } from "react";

import type { DjIdentityDraftValue } from "@/src/components/dj/DjIdentityDraftStep";
import { useLocale } from "@/src/i18n/use-locale";
import { useCurrentUser } from "@/src/hooks/use-auth";
import { useDjIdentityDrafts } from "@/src/hooks/use-creative-draft";
import type { DjDraftTraits, DjIdentityCandidate } from "@/src/types/creative-generation";

export type DjIdentityController = Readonly<{
  candidates: readonly DjIdentityCandidate[];
  selectedName: string | null;
  status: "idle" | "loading" | "ready" | "error";
  request(): Promise<void>;
  select(candidate: DjIdentityCandidate): void;
  edit(field: "name" | "identityConcept", text: string): void;
  startCustom(): void;
  confirm(): void;
}>;

type Options = Readonly<{
  active: boolean;
  fingerprint: string;
  traits: DjDraftTraits;
  value: DjIdentityDraftValue;
  onChange: (value: DjIdentityDraftValue) => void;
  disabled?: boolean;
}>;

function canDraft(traits: DjDraftTraits, disabled: boolean): boolean {
  return !disabled && traits.genres.length > 0 && traits.moods.length > 0;
}

function canConfirm(value: DjIdentityDraftValue): boolean {
  const name = value.name.trim();
  const concept = value.identityConcept.trim();
  return name.length >= 2 && name.length <= 24 && concept.length >= 10 && concept.length <= 240;
}

export function useDjIdentityController({
  active,
  fingerprint,
  traits,
  value,
  onChange,
  disabled = false,
}: Options): DjIdentityController {
  const { resolvedLanguage: language } = useLocale();
  const userId = useCurrentUser()?.id ?? null;
  const draftMutation = useDjIdentityDrafts();
  const [candidates, setCandidates] = useState<readonly DjIdentityCandidate[]>([]);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [status, setStatus] = useState<DjIdentityController["status"]>("idle");
  const requestGeneration = useRef(0);
  const requestedFingerprint = useRef<string | null>(null);
  const previousFingerprint = useRef(fingerprint);
  const currentFingerprint = useRef(fingerprint);
  const currentTraits = useRef(traits);
  const currentDisabled = useRef(disabled);
  const currentUserId = useRef(userId);
  const currentCandidates = useRef(candidates);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);

  currentFingerprint.current = fingerprint;
  currentTraits.current = traits;
  currentDisabled.current = disabled;
  currentUserId.current = userId;
  currentCandidates.current = candidates;
  valueRef.current = value;
  onChangeRef.current = onChange;

  const request = async () => {
    if (!canDraft(currentTraits.current, currentDisabled.current)) return;
    const requestFingerprint = currentFingerprint.current;
    const requestUserId = currentUserId.current;
    const requestToken = ++requestGeneration.current;
    requestedFingerprint.current = requestFingerprint;
    setStatus("loading");
    try {
      const response = await draftMutation.mutateAsync({
        language,
        traits: currentTraits.current,
        exclude: currentCandidates.current.map((candidate) => candidate.name),
      });
      if (response.kind !== "dj-identity" || response.draft.candidates.length < 3) {
        throw new Error("invalid identity draft");
      }
      if (
        requestGeneration.current !== requestToken ||
        currentFingerprint.current !== requestFingerprint ||
        currentUserId.current !== requestUserId ||
        !canDraft(currentTraits.current, currentDisabled.current)
      ) return;
      setCandidates(response.draft.candidates.slice(0, 3));
      setSelectedName(null);
      setStatus("ready");
    } catch {
      if (
        requestGeneration.current !== requestToken ||
        currentFingerprint.current !== requestFingerprint ||
        currentUserId.current !== requestUserId ||
        !canDraft(currentTraits.current, currentDisabled.current)
      ) return;
      setStatus("error");
    }
  };

  useEffect(() => {
    if (previousFingerprint.current !== fingerprint) {
      requestGeneration.current += 1;
      requestedFingerprint.current = null;
      previousFingerprint.current = fingerprint;
      const current = valueRef.current;
      if (current.confirmed) onChangeRef.current({ ...current, confirmed: false });
    }
    if (active && canDraft(traits, disabled) && requestedFingerprint.current !== fingerprint) {
      void request();
    }
    // Identity entry, not individual trait edits, owns automatic generation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, disabled, fingerprint]);

  function select(candidate: DjIdentityCandidate) {
    setSelectedName(candidate.name);
    onChange({ name: candidate.name, identityConcept: candidate.identityConcept, provenance: "suggested", confirmed: false });
  }

  function edit(field: "name" | "identityConcept", text: string) {
    setSelectedName(null);
    onChange({
      ...valueRef.current,
      [field]: text,
      provenance: valueRef.current.provenance === "custom" ? "custom" : "edited",
      confirmed: false,
    });
  }

  function startCustom() {
    setSelectedName(null);
    onChange({ name: "", identityConcept: "", provenance: "custom", confirmed: false });
  }

  function confirm() {
    const current = valueRef.current;
    if (canConfirm(current)) onChange({ ...current, confirmed: true });
  }

  return { candidates, selectedName, status, request, select, edit, startCustom, confirm };
}
