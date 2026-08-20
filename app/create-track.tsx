import { useActivity } from "@/src/activity";
import { Button } from "@/src/components/Button";
import { GenerationBriefEditor } from "@/src/components/dj/GenerationBriefEditor";
import { GenerationConfirmation } from "@/src/components/dj/GenerationConfirmation";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { StateNotice } from "@/src/components/StateNotice";
import {
  useRegenerateTrackField,
  useTrackBriefDraft,
} from "@/src/hooks/use-creative-draft";
import { useCurrentUser } from "@/src/hooks/use-auth";
import { useDJ } from "@/src/hooks/use-dj";
import { useGenerateMix } from "@/src/hooks/use-generate-mix";
import { useOnlineStatus } from "@/src/hooks/use-online-status";
import { useMiniPlayerPadding } from "@/src/hooks/use-tab-bar-padding";
import { useTrackPrivateDetails } from "@/src/hooks/use-track-private-details";
import { useLocale } from "@/src/i18n/use-locale";
import type {
  CreativeDraftResponse,
  DjTraitSnapshot,
  GenerationBriefDraft,
} from "@/src/types/creative-generation";
import {
  applyRegeneratedField,
  canConfirmBrief,
  confirmBrief,
  createBriefDraft,
  editBriefField,
  markTraitsStale,
  type EditableBriefField,
  type GenerationBriefState,
  type RegeneratableBriefField,
} from "@/src/utils/generation-brief-state";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { StyleSheet, useUnistyles } from "@/src/theme/unistyles";

function draftFromDJ(
  dj: NonNullable<ReturnType<typeof useDJ>["data"]>,
  seedLyrics?: string,
): GenerationBriefDraft {
  const traits = (dj.personality_traits ?? {}) as {
    energy?: number;
    isInstrumental?: boolean;
  };
  const instrumental = traits.isInstrumental !== false;
  return {
    title: "",
    creativeDirection: "",
    mode: instrumental ? "instrumental" : "vocal",
    lyricTheme: instrumental ? null : "",
    lyrics: instrumental ? null : seedLyrics ?? "",
    visibility: "private",
    traitSnapshot: {
      genres: [...(dj.genre_specialties ?? [])],
      moods: [...(dj.mood_tags ?? [])],
      energy: Number.isFinite(traits.energy) ? Number(traits.energy) : 5,
      vibe: dj.character?.trim() || null,
      identityConcept: dj.identity_concept?.trim() || null,
    },
  };
}

function mergeInitialDraft(
  base: GenerationBriefDraft,
  response: CreativeDraftResponse,
  preserveLyrics: boolean,
): GenerationBriefDraft {
  if (response.kind !== "track-brief") throw new Error("invalid_track_brief");
  return base.mode === "instrumental"
    ? { ...base, ...response.draft, lyricTheme: null, lyrics: null }
    : preserveLyrics
      ? { ...base, ...response.draft, lyrics: base.lyrics }
      : { ...base, ...response.draft };
}

function sameSnapshot(left: DjTraitSnapshot, right: DjTraitSnapshot): boolean {
  return left.energy === right.energy && left.vibe === right.vibe &&
    left.identityConcept === right.identityConcept &&
    left.genres.length === right.genres.length &&
    left.genres.every((value, index) => value === right.genres[index]) &&
    left.moods.length === right.moods.length &&
    left.moods.every((value, index) => value === right.moods[index]);
}

function preparationKey(draft: GenerationBriefDraft | null): string {
  return draft
    ? JSON.stringify([draft.mode, draft.traitSnapshot, draft.lyrics])
    : "missing";
}

export default function CreateTrackScreen() {
  const { t } = useTranslation();
  const { resolvedLanguage } = useLocale();
  const { djId = "", sourceTrackId } = useLocalSearchParams<{
    djId: string;
    sourceTrackId?: string;
  }>();
  const insets = useSafeAreaInsets();
  const paddingBottom = useMiniPlayerPadding();
  const { theme } = useUnistyles();
  const online = useOnlineStatus();
  const user = useCurrentUser();
  const djQuery = useDJ(djId);
  const dj = djQuery.data;
  const owned = !!dj && !!user?.id && dj.owner_id === user.id;
  const sourceDetails = useTrackPrivateDetails(sourceTrackId, owned);
  const sourceInvalid = !!sourceTrackId && sourceDetails.isFetched &&
    (!sourceDetails.data || sourceDetails.data.djId !== djId);
  const { activeMixForDj } = useActivity();
  const active = activeMixForDj(djId);
  const generationBlocked = active?.status === "queued" ||
    active?.status === "running" || active?.status === "slow";

  const initialDraft = useTrackBriefDraft();
  const prepareDraft = initialDraft.mutateAsync;
  const titleDraft = useRegenerateTrackField("track-title");
  const directionDraft = useRegenerateTrackField("creative-direction");
  const lyricsDraft = useRegenerateTrackField("lyrics");
  const { generateAsync, isStarting } = useGenerateMix();
  const [state, setState] = useState<GenerationBriefState | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [initialError, setInitialError] = useState(false);
  const [pendingField, setPendingField] = useState<RegeneratableBriefField | null>(null);
  const [errors, setErrors] = useState<Partial<Record<RegeneratableBriefField, string>>>({});
  const [submitError, setSubmitError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const editEpoch = useRef(0);
  const draftRevision = useRef(0);
  const prepareFlight = useRef<symbol | null>(null);
  const regenerationFlight = useRef<symbol | null>(null);
  const submitFlight = useRef<symbol | null>(null);
  const fieldEpoch = useRef<Record<RegeneratableBriefField, number>>({
    title: 0,
    creativeDirection: 0,
    lyrics: 0,
  });

  const baseDraft = useMemo(() => {
    if (!dj || sourceInvalid || (sourceTrackId && !sourceDetails.isFetched)) {
      return null;
    }
    return draftFromDJ(dj, sourceDetails.data?.confirmedLyrics);
  }, [dj, sourceDetails.data?.confirmedLyrics, sourceDetails.isFetched, sourceInvalid, sourceTrackId]);
  const baseKey = preparationKey(baseDraft);
  const recordKey = JSON.stringify([
    djId,
    sourceTrackId ?? null,
    sourceDetails.data?.trackId ?? null,
    sourceDetails.data?.confirmedLyrics ?? null,
  ]);
  const latestBaseKey = useRef(baseKey);
  latestBaseKey.current = baseKey;
  const previousRecordKey = useRef(recordKey);
  const recordChanged = previousRecordKey.current !== recordKey;
  const language = resolvedLanguage.startsWith("es") ? "es" as const : "en" as const;

  const installDraft = useCallback((draft: GenerationBriefDraft) => {
    draftRevision.current += 1;
    fieldEpoch.current.title += 1;
    fieldEpoch.current.creativeDirection += 1;
    fieldEpoch.current.lyrics += 1;
    setState(createBriefDraft(draft));
  }, []);

  const prepare = useCallback(async () => {
    if (!baseDraft || !owned || isPreparing || prepareFlight.current) return;
    const requestedAtEpoch = editEpoch.current;
    const requestedBaseKey = preparationKey(baseDraft);
    setInitialError(false);
    if (!online) {
      installDraft(baseDraft);
      return;
    }
    const flight = Symbol(recordKey);
    prepareFlight.current = flight;
    setIsPreparing(true);
    try {
      const response = await prepareDraft({
        language,
        djId,
        current: baseDraft,
        exclude: [],
      });
      if (
        editEpoch.current === requestedAtEpoch &&
        latestBaseKey.current === requestedBaseKey
      ) {
        installDraft(mergeInitialDraft(baseDraft, response, !!sourceTrackId));
      }
    } catch {
      if (
        editEpoch.current === requestedAtEpoch &&
        latestBaseKey.current === requestedBaseKey
      ) {
        setState((current) => {
          if (current) return current;
          draftRevision.current += 1;
          return createBriefDraft(baseDraft);
        });
        setInitialError(true);
      }
    } finally {
      if (prepareFlight.current === flight) {
        prepareFlight.current = null;
        setIsPreparing(false);
      }
    }
  }, [
    baseDraft,
    djId,
    installDraft,
    isPreparing,
    language,
    online,
    owned,
    prepareDraft,
    recordKey,
    sourceTrackId,
  ]);

  useEffect(() => {
    if (previousRecordKey.current === recordKey) return;
    previousRecordKey.current = recordKey;
    editEpoch.current += 1;
    draftRevision.current += 1;
    fieldEpoch.current.title += 1;
    fieldEpoch.current.creativeDirection += 1;
    fieldEpoch.current.lyrics += 1;
    prepareFlight.current = null;
    regenerationFlight.current = null;
    submitFlight.current = null;
    setState(null);
    setIsPreparing(false);
    setPendingField(null);
    setIsSubmitting(false);
    setInitialError(false);
    setErrors({});
    setSubmitError(false);
  }, [recordKey]);

  useEffect(() => {
    if (state || !baseDraft || !owned) return;
    void prepare();
  }, [baseDraft, owned, prepare, state]);

  useEffect(() => {
    if (!baseDraft) return;
    setState((current) => {
      if (
        !current || current.isTraitSnapshotStale ||
        (current.draft.mode === baseDraft.mode &&
          sameSnapshot(current.draft.traitSnapshot, baseDraft.traitSnapshot))
      ) {
        return current;
      }
      draftRevision.current += 1;
      fieldEpoch.current.title += 1;
      fieldEpoch.current.creativeDirection += 1;
      fieldEpoch.current.lyrics += 1;
      return markTraitsStale(current);
    });
  }, [baseDraft]);

  const onEdit = <K extends EditableBriefField>(field: K, value: GenerationBriefDraft[K]) => {
    editEpoch.current += 1;
    const regeneratedField: RegeneratableBriefField | null =
      field === "lyricTheme" || field === "lyrics"
      ? "lyrics"
      : field === "title" || field === "creativeDirection"
        ? field
        : null;
    if (regeneratedField) fieldEpoch.current[regeneratedField] += 1;
    setErrors((current) => regeneratedField
      ? { ...current, [regeneratedField]: undefined }
      : current);
    setSubmitError(false);
    setState((current) => current ? editBriefField(current, field, value) : current);
  };

  const onRegenerate = async (field: RegeneratableBriefField) => {
    if (!state || !online || regenerationFlight.current) return;
    const flight = Symbol(field);
    regenerationFlight.current = flight;
    const mutation = field === "title"
      ? titleDraft
      : field === "creativeDirection"
        ? directionDraft
        : lyricsDraft;
    const kind = field === "title"
      ? "track-title"
      : field === "creativeDirection"
        ? "creative-direction"
        : "lyrics";
    const requestedAtEpoch = fieldEpoch.current[field];
    const requestedAtRevision = draftRevision.current;
    setPendingField(field);
    setErrors((current) => ({ ...current, [field]: undefined }));
    try {
      const currentValue = field === "lyrics"
        ? state.draft.lyrics
        : state.draft[field];
      const response = await mutation.mutateAsync({
        language,
        djId,
        current: state.draft,
        exclude: currentValue
          ? [...state.exclusions[field], currentValue]
          : state.exclusions[field],
      });
      const value = response.kind === "track-title"
        ? response.draft.title
        : response.kind === "creative-direction"
          ? response.draft.creativeDirection
          : response.kind === "lyrics"
            && typeof response.draft.lyricTheme === "string"
            && typeof response.draft.lyrics === "string"
            ? {
                lyricTheme: response.draft.lyricTheme,
                lyrics: response.draft.lyrics,
              }
            : null;
      if (value == null || response.kind !== kind) throw new Error("invalid_draft_field");
      if (
        fieldEpoch.current[field] !== requestedAtEpoch ||
        draftRevision.current !== requestedAtRevision
      ) return;
      setState((current) => current ? applyRegeneratedField(current, field, value) : current);
    } catch {
      if (
        regenerationFlight.current === flight &&
        fieldEpoch.current[field] === requestedAtEpoch &&
        draftRevision.current === requestedAtRevision
      ) {
        setErrors((current) => ({ ...current, [field]: t("dj.profile.genericError") }));
      }
    } finally {
      if (regenerationFlight.current === flight) {
        regenerationFlight.current = null;
        setPendingField(null);
      }
    }
  };

  const onReview = () => {
    setState((current) => current ? confirmBrief(current) : current);
  };

  const onGenerate = async () => {
    if (
      !state?.confirmed || !online || generationBlocked || isStarting ||
      submitFlight.current
    ) return;
    const flight = Symbol(recordKey);
    submitFlight.current = flight;
    setIsSubmitting(true);
    setSubmitError(false);
    try {
      await generateAsync({
        djId,
        brief: state.confirmed,
        sourceTrackId: sourceTrackId ?? null,
      });
      if (submitFlight.current !== flight) return;
      router.replace({ pathname: "/dj/[id]", params: { id: djId } });
    } catch {
      if (submitFlight.current === flight) {
        setSubmitError(true);
      }
    } finally {
      if (submitFlight.current === flight) {
        submitFlight.current = null;
        setIsSubmitting(false);
      }
    }
  };

  const content = (() => {
    if (djQuery.isError || sourceInvalid || (dj !== undefined && !owned)) {
      return <StateNotice kind="error" title={t("dj.brief.ownershipError")} />;
    }
    if (recordChanged || !state) {
      return <StateNotice kind="empty" title={t("dj.brief.preparing")} />;
    }
    if (state.confirmed) {
      return (
        <>
          <GenerationConfirmation
            brief={state.confirmed}
            disabled={!online || generationBlocked || isStarting || isSubmitting}
            isSubmitting={isStarting || isSubmitting}
            onBack={() => {
              setSubmitError(false);
              setState((current) => current ? { ...current, confirmed: null } : current);
            }}
            onGenerate={() => void onGenerate()}
          />
          {submitError ? (
            <StateNotice kind="error" title={t("dj.profile.genericError")} compact />
          ) : null}
        </>
      );
    }
    return (
      <>
        {initialError ? (
          <StateNotice
            kind="error"
            title={t("dj.brief.unavailableTitle")}
            message={t("dj.brief.unavailable")}
            actionLabel={online ? t("dj.brief.retry") : undefined}
            onAction={online ? () => void prepare() : undefined}
          />
        ) : null}
        {!online ? (
          <StateNotice kind="offline" title={t("dj.brief.offlineDraft")} compact />
        ) : null}
        {state.isTraitSnapshotStale ? (
          <StateNotice
            kind="error"
            title={t("dj.brief.staleTitle")}
            message={t("dj.brief.staleMessage")}
            actionLabel={online ? t("dj.brief.retry") : undefined}
            onAction={online ? () => void prepare() : undefined}
          />
        ) : null}
        <GenerationBriefEditor
          state={state}
          disabled={isStarting || isSubmitting || generationBlocked}
          isOnline={online}
          pendingField={pendingField}
          errors={errors}
          onEdit={onEdit}
          onRegenerate={(field) => void onRegenerate(field)}
        />
        <Button
          label={t("dj.brief.review")}
          disabled={!canConfirmBrief(state) || isStarting || isSubmitting || generationBlocked}
          onPress={onReview}
        />
      </>
    );
  })();

  return (
    <View style={styles.root}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + theme.spacing.stackMd, paddingBottom },
        ]}
      >
        <ScreenHeader
          title={t("dj.profile.prepareAction")}
          disabled={isStarting || isSubmitting}
        />
        {content}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    gap: theme.spacing.stackLg,
    paddingHorizontal: theme.spacing.gutter,
  },
}));
