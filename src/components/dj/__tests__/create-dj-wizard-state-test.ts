import {
  canEnterCreateDjStep,
  createDjTraitsFingerprint,
  createInitialCreateDjWizardState,
  reduceCreateDjWizard,
  toCreateDjInput,
  type CreateDjWizardState,
} from "../create-dj-wizard-state";

describe("create DJ wizard state", () => {
  it("starts with the sound step and first-track intent", () => {
    expect(createInitialCreateDjWizardState("first_track")).toMatchObject({
      step: "sound",
      sound: { genres: [], moods: [], intensity: "balanced", mode: "instrumental", vibe: "" },
      visibility: "private",
      returnIntent: "first_track",
      identityFreshness: "missing",
      dirty: false,
    });
  });

  it("validates steps and projects confirmed review into the API input", () => {
    const initial = createInitialCreateDjWizardState("first_track");
    const soundReady = reduceCreateDjWizard(initial, {
      type: "sound_changed",
      patch: { genres: ["Ambient"], moods: ["Focus"] },
    });
    const confirmedReviewState: CreateDjWizardState = {
      ...soundReady,
      step: "review",
      identity: {
        name: "Night Cartographer",
        identityConcept: "Maps patient rhythms into luminous shared journeys.",
        provenance: "custom",
        confirmed: true,
      },
      identityFingerprint: JSON.stringify([["Ambient"], ["Focus"], 6, "instrumental", ""]),
      identityFreshness: "fresh",
      dirty: true,
    };
    expect(canEnterCreateDjStep(soundReady, "identity")).toBe(true);
    expect(createDjTraitsFingerprint(soundReady.sound)).toBe(
      JSON.stringify([["Ambient"], ["Focus"], 6, "instrumental", ""]),
    );
    expect(toCreateDjInput(confirmedReviewState)).toEqual({
      name: "Night Cartographer",
      identityConcept: "Maps patient rhythms into luminous shared journeys.",
      genres: ["Ambient"],
      moods: ["Focus"],
      energy: 6,
      isInstrumental: true,
      vibe: undefined,
      isPublic: false,
    });
  });

  it("blocks identity with missing selections and review until identity is fresh", () => {
    const initial = createInitialCreateDjWizardState();
    expect(canEnterCreateDjStep(initial, "identity")).toBe(false);
    const fourSelections = reduceCreateDjWizard(initial, {
      type: "sound_changed",
      patch: { genres: ["Ambient", "House", "Techno", "Jazz"], moods: ["Calm"] },
    });
    expect(canEnterCreateDjStep(fourSelections, "identity")).toBe(false);
    expect(canEnterCreateDjStep(fourSelections, "review")).toBe(false);
  });

  it("rejects non-canonical and duplicate selections, and overlong vibes", () => {
    const initial = createInitialCreateDjWizardState();
    for (const patch of [
      { genres: ["Not a genre"], moods: ["Focus"] },
      { genres: ["Ambient", "Ambient"], moods: ["Focus"] },
      { genres: ["Ambient"], moods: ["Not a mood"] },
      { genres: ["Ambient"], moods: ["Focus", "Focus"] },
      { genres: ["Ambient"], moods: ["Calm"] },
    ]) {
      const invalid = reduceCreateDjWizard(initial, { type: "sound_changed", patch });
      expect(canEnterCreateDjStep(invalid, "identity")).toBe(false);
      expect(() => toCreateDjInput({
        ...invalid,
        step: "review",
        identity: {
          name: "Night Cartographer",
          identityConcept: "Maps patient rhythms into luminous shared journeys.",
          provenance: "custom",
          confirmed: true,
        },
        identityFingerprint: createDjTraitsFingerprint(invalid.sound),
        identityFreshness: "fresh",
      })).toThrow("create_dj_state_invalid");
    }
    const overlong = reduceCreateDjWizard(initial, {
      type: "sound_changed",
      patch: { genres: ["Ambient"], moods: ["Focus"], vibe: "x".repeat(141) },
    });
    expect(canEnterCreateDjStep(overlong, "identity")).toBe(false);
    expect(() => toCreateDjInput({
      ...overlong,
      step: "review",
      identity: {
        name: "Night Cartographer",
        identityConcept: "Maps patient rhythms into luminous shared journeys.",
        provenance: "custom",
        confirmed: true,
      },
      identityFingerprint: createDjTraitsFingerprint(overlong.sound),
      identityFreshness: "fresh",
    })).toThrow("create_dj_state_invalid");
  });

  it("stales confirmed identity when sound changes, without losing its text", () => {
    const sound = reduceCreateDjWizard(createInitialCreateDjWizardState(), {
      type: "sound_changed", patch: { genres: ["Ambient"], moods: ["Focus"] },
    });
    const confirmed = reduceCreateDjWizard(sound, {
      type: "identity_changed",
      value: { name: "Night Cartographer", identityConcept: "Maps patient rhythms into luminous shared journeys.", provenance: "custom", confirmed: true },
    });
    const stale = reduceCreateDjWizard(confirmed, {
      type: "sound_changed", patch: { vibe: "  luminous   night  " },
    });
    expect(stale.identity).toMatchObject({ name: "Night Cartographer", confirmed: false });
    expect(stale.identityFreshness).toBe("stale");
    expect(stale.identityFingerprint).toBe(confirmed.identityFingerprint);
  });

  it("allows visibility changes, navigates only to available steps, and discards", () => {
    const initial = createInitialCreateDjWizardState("first_track");
    const changed = reduceCreateDjWizard(initial, { type: "visibility_changed", visibility: "public" });
    expect(changed.visibility).toBe("public");
    expect(changed.identityFreshness).toBe("missing");
    expect(reduceCreateDjWizard(changed, { type: "step_requested", step: "review" }).step).toBe("sound");
    expect(reduceCreateDjWizard(changed, { type: "discard" })).toMatchObject({
      ...createInitialCreateDjWizardState("first_track"),
    });
  });

  it("consumes return intent once and rejects invalid projections", () => {
    const initial = createInitialCreateDjWizardState("first_track");
    const consumed = reduceCreateDjWizard(initial, { type: "return_intent_consumed" });
    expect(consumed.returnIntent).toBeNull();
    expect(reduceCreateDjWizard(consumed, { type: "return_intent_consumed" })).toBe(consumed);
    expect(() => toCreateDjInput(initial)).toThrow("create_dj_state_invalid");
  });

  it("requires the identity fingerprint to match current sound traits", () => {
    const sound = reduceCreateDjWizard(createInitialCreateDjWizardState(), {
      type: "sound_changed", patch: { genres: ["Ambient"], moods: ["Focus"] },
    });
    const confirmed = reduceCreateDjWizard(sound, {
      type: "identity_changed",
      value: { name: "Night Cartographer", identityConcept: "Maps patient rhythms into luminous shared journeys.", provenance: "custom", confirmed: true },
    });
    const forged: CreateDjWizardState = {
      ...confirmed,
      step: "review",
      identityFingerprint: "different",
    };
    expect(canEnterCreateDjStep(forged, "review")).toBe(false);
    expect(() => toCreateDjInput(forged)).toThrow("create_dj_state_invalid");
  });
});
