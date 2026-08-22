import type { CSSProperties, ReactNode } from "react";

import { breakpoints } from "@/src/theme/breakpoints";

type GridProps = {
  children: ReactNode;
  testID?: string;
};

type ItemProps = GridProps & {
  size?: "standard" | "wide";
};

const GRID_GAP_PX = 32;
const GRID_MAX_WIDTH_PX = 1120;

/**
 * React Native Web does not resolve the Unistyles breakpoint maps in this
 * component's Metro bundle, so the web boundary owns one explicit CSS media
 * query. The DOM stays in compact reading order; only its presentation changes.
 */
export const settingsDesktopGridWebCss = `
[data-himu-settings-grid] {
  align-items: stretch;
  display: flex;
  flex-direction: column;
  flex-wrap: nowrap;
  gap: ${GRID_GAP_PX}px;
  margin-left: auto;
  margin-right: auto;
  max-width: ${GRID_MAX_WIDTH_PX}px;
  min-width: 0;
  width: 100%;
}

[data-himu-settings-grid-item] {
  min-width: 0;
  width: 100%;
}

@media (min-width: ${breakpoints.xl}px) {
  [data-himu-settings-grid] {
    align-items: flex-start;
    flex-direction: row;
    flex-wrap: wrap;
  }

  [data-himu-settings-grid-item="standard"] {
    width: calc((100% - ${GRID_GAP_PX}px) / 2);
  }
}
`;

const gridStyle: CSSProperties = { minWidth: 0 };
const itemStyle: CSSProperties = { minWidth: 0 };

export function SettingsDesktopGrid({ children, testID }: GridProps) {
  return (
    <>
      <style>{settingsDesktopGridWebCss}</style>
      <div data-himu-settings-grid="" data-testid={testID} style={gridStyle}>
        {children}
      </div>
    </>
  );
}

export function SettingsDesktopGridItem({
  children,
  testID,
  size = "standard",
}: ItemProps) {
  return (
    <div
      data-himu-settings-grid-item={size}
      data-testid={testID}
      style={itemStyle}
    >
      {children}
    </div>
  );
}
