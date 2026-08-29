import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { BackHandler, Platform } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";

import { getEdgeErrorPayload, type EdgeErrorPayload } from "@/src/api/edge-errors";
import { isCurrentMutationUser } from "@/src/api/auth-scope";
import { Button } from "@/src/components/Button";
import { Text } from "@/src/components/Text";
import { CreateDjIdentityStep } from "@/src/components/dj/CreateDjIdentityStep";
import { CreateDjReview } from "@/src/components/dj/CreateDjReview";
import { CreateDjWizardLayout } from "@/src/components/dj/CreateDjWizardLayout";
import { DjSoundFields } from "@/src/components/dj/DjSoundFields";
import {
  canEnterCreateDjStep,
  createDjTraitsFingerprint,
  createInitialCreateDjWizardState,
  intensityToEnergy,
  isCreateDjWizardValid,
  reduceCreateDjWizard,
  toCreateDjInput,
  type CreateDjStep,
  type CreateDjWizardState,
} from "@/src/components/dj/create-dj-wizard-state";
import {
  pendingIntentStore,
  trackProductEvent,
  type FirstTrackReturnIntent,
} from "@/src/experience";
import { useCurrentUser } from "@/src/hooks/use-auth";
import { useConfirm } from "@/src/hooks/use-confirm";
import { useCreateDJ } from "@/src/hooks/use-create-dj";
import { useDjIdentityController } from "@/src/hooks/use-dj-identity-controller";
import { useLocale } from "@/src/i18n/use-locale";

export type CreateDjErrorCategory = "quota" | "validation" | "provider" | "unknown";

export function mapCreateDjErrorCategory(
  payload: EdgeErrorPayload,
): CreateDjErrorCategory {
  switch (payload.code) {
    case "dj_quota_reached":
      return "quota";
    case "invalid_input":
      return "validation";
    case "provider_error":
    case "provider_unavailable":
    case "generation_failed":
      return "provider";
    default:
      return "unknown";
  }
}

function errorMessageKey(category: CreateDjErrorCategory) {
  switch (category) {
    case "quota":
      return "dj.create.quotaError" as const;
    case "validation":
      return "dj.create.invalidError" as const;
    case "provider":
      return "dj.create.providerError" as const;
    case "unknown":
      return "dj.create.genericError" as const;
  }
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseStep(value: string | string[] | undefined): CreateDjStep | null {
  const candidate = single(value);
  return candidate === "sound" || candidate === "identity" || candidate === "review"
    ? candidate
    : null;
}

function completedSteps(state: CreateDjWizardState): CreateDjStep[] {
  const completed: CreateDjStep[] = [];
  if (canEnterCreateDjStep(state, "identity")) completed.push("sound");
  if (canEnterCreateDjStep(state, "review")) completed.push("identity");
  return completed;
}

export default function CreateDJScreen() {
  const { t } = useTranslation();
  const { resolvedLanguage } = useLocale();
  const userId = useCurrentUser()?.id ?? "";
  const { mutate: createDJ, isPending } = useCreateDJ();
  const params = useLocalSearchParams<{
    step?: string | string[];
    returnIntent?: string | string[];
  }>();
  const confirm = useConfirm();
  const initialReturnIntent = useRef<FirstTrackReturnIntent>(
    single(params.returnIntent) === "first_track" ? "first_track" : null,
  ).current;
  const [state, dispatch] = useReducer(
    reduceCreateDjWizard,
    initialReturnIntent,
    createInitialCreateDjWizardState,
  );
  const stateRef = useRef(state);
  const backInFlight = useRef(false);
  const intentAdopted = useRef(false);
  const submitInFlight = useRef(false);
  const isPendingRef = useRef(isPending);
  const [submitAccepted, setSubmitAccepted] = useState(false);
  const [submitError, setSubmitError] = useState<CreateDjErrorCategory | null>(null);
  const submissionPending = submitAccepted || isPending;
  stateRef.current = state;
  isPendingRef.current = isPending;

  useEffect(() => {
    if (intentAdopted.current) return;
    intentAdopted.current = true;
    if (initialReturnIntent !== "first_track") return;
    void pendingIntentStore.consume("first_track").catch(() => undefined);
  }, [initialReturnIntent]);

  const identityController = useDjIdentityController({
    active: state.step === "identity",
    fingerprint: createDjTraitsFingerprint(state.sound),
    traits: {
      genres: state.sound.genres,
      moods: state.sound.moods,
      energy: intensityToEnergy(state.sound.intensity),
      isInstrumental: state.sound.mode === "instrumental",
      vibe: state.sound.vibe.trim() || null,
    },
    value: state.identity,
    onChange: (value) => dispatch({ type: "identity_changed", value }),
  });

  const pushWebStep = useCallback((step: CreateDjStep) => {
    if (Platform.OS !== "web") return;
    router.push({
      pathname: "/create-dj",
      params: initialReturnIntent === "first_track"
        ? { step, returnIntent: initialReturnIntent }
        : { step },
    });
  }, [initialReturnIntent]);

  const requestStep = useCallback((step: CreateDjStep) => {
    dispatch({ type: "step_requested", step });
    pushWebStep(step);
  }, [pushWebStep]);

  const requestEditableStep = useCallback((step: CreateDjStep) => {
    if (isPendingRef.current || submitInFlight.current) return;
    requestStep(step);
  }, [requestStep]);

  useEffect(() => {
    if (isPendingRef.current || submitInFlight.current) return;
    const requested = parseStep(params.step);
    if (requested && canEnterCreateDjStep(stateRef.current, requested)) {
      dispatch({ type: "step_requested", step: requested });
      return;
    }
    if (Platform.OS === "web") router.setParams({ step: "sound" });
    dispatch({ type: "step_requested", step: "sound" });
  }, [params.step]);

  const exitRoute = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/(app)");
  }, []);

  const handleBack = useCallback(async () => {
    if (isPendingRef.current || submitInFlight.current) {
      exitRoute();
      return;
    }
    const current = stateRef.current;
    if (current.step === "review") {
      requestStep("identity");
      return;
    }
    if (current.step === "identity") {
      requestStep("sound");
      return;
    }
    if (!current.dirty) {
      exitRoute();
      return;
    }
    if (backInFlight.current) return;
    backInFlight.current = true;
    try {
      const discard = await confirm({
        title: t("dj.create.abandon.title"),
        message: t("dj.create.abandon.message"),
        confirmLabel: t("dj.create.abandon.discard"),
        cancelLabel: t("dj.create.abandon.stay"),
        destructive: true,
      });
      if (!discard) return;
      dispatch({ type: "discard" });
      dispatch({ type: "return_intent_consumed" });
      exitRoute();
    } finally {
      backInFlight.current = false;
    }
  }, [confirm, exitRoute, requestStep, t]);

  const submit = useCallback(() => {
    const current = stateRef.current;
    if (
      current.step !== "review" ||
      isPendingRef.current ||
      submitInFlight.current ||
      !isCreateDjWizardValid(current)
    ) {
      return;
    }

    submitInFlight.current = true;
    setSubmitAccepted(true);
    setSubmitError(null);
    const input = toCreateDjInput(current);
    const submittedUserId = userId;
    const submittedReturnIntent = current.returnIntent;
    const eventContext = {
      flowVersion: 1,
      platform: Platform.OS === "web" ? "web" : "android",
      locale: resolvedLanguage,
    } as const;

    void trackProductEvent("dj_creation_started", eventContext);
    createDJ(input, {
      onSuccess: ({ djId }) => {
        if (!isCurrentMutationUser(submittedUserId)) return;
        void trackProductEvent("dj_created", eventContext);
        router.replace(
          submittedReturnIntent === "first_track"
            ? { pathname: "/create-track", params: { djId } }
            : `/dj/${djId}`,
        );
      },
      onError: async (error) => {
        if (!isCurrentMutationUser(submittedUserId)) return;
        const payload = await getEdgeErrorPayload(error);
        if (!isCurrentMutationUser(submittedUserId)) return;
        const errorCategory = mapCreateDjErrorCategory(payload);
        submitInFlight.current = false;
        setSubmitAccepted(false);
        setSubmitError(errorCategory);
        void trackProductEvent("dj_creation_failed", {
          ...eventContext,
          errorCategory,
        });
      },
    });
  }, [createDJ, resolvedLanguage, userId]);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === "web") return;
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        void handleBack();
        return true;
      });
      return () => subscription.remove();
    }, [handleBack]),
  );

  const editor = state.step === "sound" ? (
    <DjSoundFields
      {...state.sound}
      onChange={(patch) => dispatch({ type: "sound_changed", patch })}
    />
  ) : state.step === "identity" ? (
    <CreateDjIdentityStep
      active
      controller={identityController}
      value={state.identity}
      onContinue={() => requestStep("review")}
    />
  ) : (
    <CreateDjReview
      readOnly={submissionPending}
      sound={state.sound}
      identity={state.identity}
      visibility={state.visibility}
      onVisibilityChange={(visibility) => dispatch({ type: "visibility_changed", visibility })}
      onEdit={requestEditableStep}
    />
  );

  const action = state.step === "sound" ? (
    <Button
      testID="create-dj-sound-action"
      label={t("dj.create.continue")}
      disabled={!canEnterCreateDjStep(state, "identity")}
      onPress={() => requestStep("identity")}
    />
  ) : state.step === "review" ? (
    <>
      <Button
        testID="create-dj-submit"
        label={t("dj.create.submit")}
        loadingLabel={t("dj.create.loading", { name: state.identity.name.trim() })}
        loading={submissionPending}
        disabled={submissionPending || !isCreateDjWizardValid(state)}
        onPress={submit}
      />
      {submitError ? (
        <>
          <Text accessibilityRole="alert">{t("dj.create.errorTitle")}</Text>
          <Text>{t(errorMessageKey(submitError))}</Text>
        </>
      ) : null}
    </>
  ) : null;

  return (
    <CreateDjWizardLayout
      step={state.step}
      completedSteps={completedSteps(state)}
      title={t("dj.create.title")}
      description={t("dj.create.subtitle")}
      editor={editor}
      summary={state.step === "review" ? null : (
        <CreateDjReview
          readOnly
          sound={state.sound}
          identity={state.identity}
          visibility={state.visibility}
          onVisibilityChange={() => undefined}
          onEdit={requestStep}
        />
      )}
      action={action}
      onStepPress={requestEditableStep}
      onBack={() => void handleBack()}
    />
  );
}
