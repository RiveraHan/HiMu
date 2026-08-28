import { useEffect, useRef } from "react";
// react-dom is shipped by Expo; its optional type package is not installed here.
// @ts-expect-error react-dom's optional type package is not installed in this workspace
import { createPortal } from "react-dom";

import type { CatalogPickerSurfaceProps } from "./progressive-catalog-types";

export function CatalogPickerSurface({
  visible,
  title,
  query,
  onQueryChange,
  onDone,
  onRequestClose,
  children,
}: CatalogPickerSurfaceProps) {
  const openerRef = useRef<HTMLElement | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const dialogRootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (visible) {
      openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      searchRef.current?.focus();
      const background = Array.from(document.body.children).filter(
        (element) => element !== dialogRootRef.current,
      );
      background.forEach((element) => element.setAttribute("inert", ""));
      return () => background.forEach((element) => element.removeAttribute("inert"));
    }
    openerRef.current?.focus();
  }, [visible]);

  if (!visible) return null;

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onRequestClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusables = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ));
    const first = focusables[0];
    const last = focusables.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div ref={dialogRootRef} data-catalog-picker-background="">
      <div aria-hidden="true" style={styles.backdrop} />
      <div
        aria-labelledby="catalog-picker-title"
        aria-modal="true"
        data-testid="catalog-picker-dialog"
        onKeyDown={onKeyDown}
        role="dialog"
        style={styles.dialog}
      >
        <div style={styles.heading}>
          <h2 id="catalog-picker-title" tabIndex={-1} style={styles.title}>{title}</h2>
          <button type="button" onClick={onDone} style={styles.button}>Done</button>
        </div>
        <input
          ref={searchRef}
          aria-label={`Search ${title}`}
          placeholder={`Search ${title}`}
          value={query}
          onChange={(event) => onQueryChange(event.currentTarget.value)}
          style={styles.search}
        />
        {children}
      </div>
    </div>,
    document.body,
  );
}

const styles = {
  backdrop: { background: "rgba(0, 0, 0, 0.72)", inset: 0, position: "fixed" as const },
  dialog: {
    background: "#1f1f24",
    bottom: 0,
    boxSizing: "border-box" as const,
    color: "#e4e1e9",
    display: "flex",
    flexDirection: "column" as const,
    gap: 16,
    left: 0,
    margin: "0 auto",
    maxHeight: "85vh",
    maxWidth: 640,
    overflow: "auto",
    padding: 20,
    position: "fixed" as const,
    right: 0,
  },
  heading: { alignItems: "center", display: "flex", justifyContent: "space-between", minHeight: 44 },
  title: { margin: 0 },
  button: { minHeight: 44, minWidth: 44 },
  search: { minHeight: 44 },
};
