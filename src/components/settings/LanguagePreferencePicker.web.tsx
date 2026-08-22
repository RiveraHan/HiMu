import { useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";

import { isLanguagePreference } from "@/src/i18n/locale";
import type { LanguagePreference } from "@/src/i18n/types";
import { useLocale } from "@/src/i18n/use-locale";

type Labels = {
  label: string;
  loading: string;
  retry: string;
  saveError: string;
  system: string;
  en: string;
  es: string;
};

type SelectProps = {
  preference: LanguagePreference;
  isSaving: boolean;
  saveError: boolean;
  onSelect: (preference: LanguagePreference) => Promise<void>;
  onRetry: () => void;
  labels: Labels;
};

export function LanguagePreferenceSelect({
  preference,
  isSaving,
  saveError,
  onSelect,
  onRetry,
  labels,
}: SelectProps) {
  const [pending, setPending] = useState(false);
  const busy = isSaving || pending;

  const onChange = async (event: ChangeEvent<HTMLSelectElement>) => {
    const next = event.currentTarget.value;
    if (!isLanguagePreference(next)) return;
    setPending(true);
    try {
      await onSelect(next);
    } finally {
      setPending(false);
    }
  };

  return (
    <div data-himu-language-picker="" style={styles.root}>
      <label htmlFor="himu-language-preference" style={styles.label}>
        {labels.label}
      </label>
      <select
        id="himu-language-preference"
        data-testid="language-preference-select"
        aria-label={labels.label}
        aria-busy={busy}
        disabled={busy}
        value={preference}
        onChange={(event) => void onChange(event)}
        style={styles.select}
      >
        <option value="system">{labels.system}</option>
        <option value="en">{labels.en}</option>
        <option value="es">{labels.es}</option>
      </select>
      {busy ? <span role="status">{labels.loading}</span> : null}
      {saveError ? (
        <div role="alert" style={styles.error}>
          <span>{labels.saveError}</span>
          <button
            type="button"
            aria-label={labels.retry}
            onClick={onRetry}
            style={styles.retry}
          >
            {labels.retry}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function LanguagePreferencePicker() {
  const { t } = useTranslation();
  const {
    preference,
    resolvedLanguage,
    setPreference,
    isSaving,
    saveError,
    retryPreference,
  } = useLocale();

  return (
    <LanguagePreferenceSelect
      preference={preference}
      isSaving={isSaving}
      saveError={saveError ?? false}
      onSelect={setPreference}
      onRetry={retryPreference ?? (() => undefined)}
      labels={{
        label: t("settings.language.label"),
        loading: t("common.states.loading"),
        retry: t("common.actions.retry"),
        saveError: t("common.errors.savePreference"),
        system: t("settings.language.systemResolved", {
          language: t(`settings.language.${resolvedLanguage}`),
        }),
        en: t("settings.language.en"),
        es: t("settings.language.es"),
      }}
    />
  );
}

const styles = {
  root: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    minWidth: 0,
  },
  label: {
    color: "#e4e1e9",
    fontSize: 18,
    lineHeight: 1.6,
  },
  select: {
    background: "#35343a",
    border: "1px solid #908f9e",
    borderRadius: 8,
    color: "#e4e1e9",
    font: "inherit",
    minHeight: 44,
    padding: "8px 12px",
    width: "100%",
  },
  error: {
    alignItems: "center",
    color: "#ffb4ab",
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  retry: {
    background: "transparent",
    border: "1px solid #ffb4ab",
    borderRadius: 9999,
    color: "#ffb4ab",
    cursor: "pointer",
    minHeight: 44,
    padding: "8px 16px",
  },
} as const;
