import type { ReactNode } from "react";

export type CatalogGroup = Readonly<{
  label: string;
  items: readonly string[];
}>;

export type ProgressiveCatalogPickerProps = Readonly<{
  title: string;
  chooseLabel?: string;
  editLabel?: string;
  emptyDescription?: string;
  groups: readonly CatalogGroup[];
  selected: readonly string[];
  min: number;
  max: number;
  disabled?: boolean;
  getGroupLabel(value: string): string;
  getItemLabel(value: string): string;
  onChange(selected: string[]): void | Readonly<{
    accepted: boolean;
    reason?: "offline" | "limit";
  }>;
}>;

export type CatalogPickerSurfaceProps = ProgressiveCatalogPickerProps & Readonly<{
  visible: boolean;
  query: string;
  expandedGroup: string | null;
  onQueryChange(query: string): void;
  onExpandedGroupChange(group: string | null): void;
  onToggle(value: string): void;
  onDone(): void;
  onRequestClose(): void;
  children?: ReactNode;
}>;
