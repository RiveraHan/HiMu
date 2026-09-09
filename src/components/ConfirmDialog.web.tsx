import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
// react-dom is shipped by Expo; its optional type package is not installed here.
// @ts-expect-error react-dom's optional type package is not installed in this workspace
import { createPortal } from "react-dom";

import { useConfirmStore } from "@/src/stores/confirm-store";

export function ConfirmDialogHost() {
  const { t } = useTranslation();
  const pending = useConfirmStore((state) => state.pending);
  const resolve = useConfirmStore((state) => state.resolve);
  const openerRef = useRef<HTMLElement | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!pending) return;
    openerRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    titleRef.current?.focus();
    const background = Array.from(document.body.children).filter(
      (element) => element !== rootRef.current,
    );
    background.forEach((element) => element.setAttribute("inert", ""));

    return () => {
      background.forEach((element) => element.removeAttribute("inert"));
      openerRef.current?.focus();
    };
  }, [pending]);

  if (!pending) return null;

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      resolve(false);
      return;
    }
    if (event.key !== "Tab") return;
    const focusables = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )).filter((element) => element !== titleRef.current);
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
    <div ref={rootRef} data-confirm-dialog-root="">
      <div aria-hidden="true" onClick={() => resolve(false)} style={styles.backdrop} />
      <div
        aria-labelledby="confirm-dialog-title"
        aria-modal="true"
        onKeyDown={onKeyDown}
        role="dialog"
        style={styles.dialog}
      >
        <h2 id="confirm-dialog-title" ref={titleRef} tabIndex={-1} style={styles.title}>
          {pending.title}
        </h2>
        {pending.message ? <p style={styles.message}>{pending.message}</p> : null}
        <div style={styles.actions}>
          <button type="button" onClick={() => resolve(false)} style={styles.button}>
            {pending.cancelLabel ?? t("common.actions.cancel")}
          </button>
          <button
            type="button"
            onClick={() => resolve(true)}
            style={{ ...styles.button, ...(pending.destructive ? styles.destructive : styles.primary) }}
          >
            {pending.confirmLabel ?? t("common.actions.confirm")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const styles = {
  backdrop: {
    background: "rgba(0, 0, 0, 0.62)",
    inset: 0,
    position: "fixed" as const,
    zIndex: 200,
  },
  dialog: {
    background: "#1f1f24",
    border: "1px solid rgba(255, 255, 255, 0.12)",
    borderRadius: 20,
    boxShadow: "0 24px 72px rgba(0, 0, 0, 0.5)",
    boxSizing: "border-box" as const,
    color: "#e4e1e9",
    display: "flex",
    flexDirection: "column" as const,
    gap: 16,
    left: "50%",
    maxHeight: "calc(100vh - 40px)",
    maxWidth: 420,
    overflow: "auto",
    padding: 24,
    position: "fixed" as const,
    top: "50%",
    transform: "translate(-50%, -50%)",
    width: "calc(100% - 40px)",
    zIndex: 201,
  },
  title: { fontSize: 24, lineHeight: 1.2, margin: 0, outline: "none" },
  message: { color: "#bdb8c5", fontSize: 16, lineHeight: 1.5, margin: 0 },
  actions: { display: "flex", flexWrap: "wrap" as const, gap: 12, justifyContent: "flex-end" },
  button: { border: 0, borderRadius: 12, cursor: "pointer", fontWeight: 700, minHeight: 44, minWidth: 96, padding: "10px 16px" },
  primary: { background: "#d0bcff", color: "#241a39" },
  destructive: { background: "#f2b8b5", color: "#601410" },
};
