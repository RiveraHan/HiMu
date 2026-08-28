import { useCallback, useEffect, useReducer, useRef } from "react";
import { BackHandler, Platform } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";

import { Button } from "@/src/components/Button";
import { CreateDjIdentityStep } from "@/src/components/dj/CreateDjIdentityStep";
import { CreateDjReview } from "@/src/components/dj/CreateDjReview";
import { CreateDjWizardLayout } from "@/src/components/dj/CreateDjWizardLayout";
import { DjSoundFields } from "@/src/components/dj/DjSoundFields";
import {
  canEnterCreateDjStep,
  createDjTraitsFingerprint,
  createInitialCreateDjWizardState,
  intensityToEnergy,
  reduceCreateDjWizard,
  type CreateDjStep,
  type CreateDjWizardState,
} from "@/src/components/dj/create-dj-wizard-state";
import { useConfirm } from "@/src/hooks/use-confirm";
import { useDjIdentityController } from "@/src/hooks/use-dj-identity-controller";

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
  const params = useLocalSearchParams<{
    step?: string | string[];
    returnIntent?: string | string[];
  }>();
  const confirm = useConfirm();
  const initialReturnIntent = single(params.returnIntent) === "first_track" ? "first_track" : null;
  const [state, dispatch] = useReducer(
    reduceCreateDjWizard,
    initialReturnIntent,
    createInitialCreateDjWizardState,
  );
  const stateRef = useRef(state);
  const backInFlight = useRef(false);
  stateRef.current = state;

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

  const setWebStep = useCallback((step: CreateDjStep) => {
    if (Platform.OS === "web") router.setParams({ step });
  }, []);

  const requestStep = useCallback((step: CreateDjStep) => {
    dispatch({ type: "step_requested", step });
    setWebStep(step);
  }, [setWebStep]);

  useEffect(() => {
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
      sound={state.sound}
      identity={state.identity}
      visibility={state.visibility}
      onVisibilityChange={(visibility) => dispatch({ type: "visibility_changed", visibility })}
      onEdit={requestStep}
    />
  );

  const action = state.step === "sound" ? (
    <Button
      label={t("dj.create.continue")}
      disabled={!canEnterCreateDjStep(state, "identity")}
      onPress={() => requestStep("identity")}
    />
  ) : state.step === "review" ? (
    <Button
      testID="create-dj-submit"
      label={t("dj.create.submit")}
      disabled
    />
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
      onStepPress={requestStep}
      onBack={() => void handleBack()}
    />
  );
}
