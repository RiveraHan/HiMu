import { PrefSection } from "@/src/components/preferences/PrefSection";
import { Segmented } from "@/src/components/preferences/Segmented";
import type { Visibility } from "@/src/types/content-visibility";
import { useTranslation } from "react-i18next";

export { DEFAULT_VISIBILITY } from "@/src/types/content-visibility";

export type VisibilityFieldProps = {
  value: Visibility;
  onChange(value: Visibility): void;
  disabled?: boolean;
  resource?: "dj" | "track";
};

export function VisibilityField({
  value,
  onChange,
  disabled = false,
  resource = "dj",
}: VisibilityFieldProps) {
  const { t } = useTranslation();
  const description = resource === "track"
    ? value === "public"
      ? t("dj.visibility.publicTrackDescription")
      : t("dj.visibility.privateTrackDescription")
    : value === "public"
      ? t("dj.visibility.publicDescription")
      : t("dj.visibility.privateDescription");

  return (
    <PrefSection title={t("dj.visibility.title")} subtitle={description}>
      <Segmented<Visibility>
        options={[
          { label: t("dj.visibility.private"), value: "private" },
          { label: t("dj.visibility.public"), value: "public" },
        ]}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
    </PrefSection>
  );
}
