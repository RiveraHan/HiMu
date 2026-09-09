/** @jest-environment jsdom */
import { act } from "react";
// @ts-expect-error react-dom's optional type package is not installed in this workspace
import { createRoot } from "react-dom/client";

import i18n from "@/src/i18n";
import { useConfirmStore } from "@/src/stores/confirm-store";
import { ConfirmDialogHost } from "../ConfirmDialog.web";

describe("ConfirmDialogHost.web", () => {
  let container: HTMLDivElement;
  let opener: HTMLButtonElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    await i18n.changeLanguage("en");
    useConfirmStore.setState({ pending: null });
    opener = document.createElement("button");
    opener.textContent = "Make public and share";
    document.body.appendChild(opener);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<ConfirmDialogHost />));
  });

  afterEach(() => {
    act(() => {
      useConfirmStore.getState().resolve(false);
      root.unmount();
    });
    opener.remove();
    container.remove();
  });

  it("focuses its labelled dialog title and traps forward and reverse Tab", async () => {
    opener.focus();
    act(() => {
      void useConfirmStore.getState().request({ title: "Make this track public?", message: "Anyone with the link can listen." });
    });

    const dialog = document.body.querySelector<HTMLElement>("[role='dialog']");
    const title = document.body.querySelector<HTMLElement>("#confirm-dialog-title");
    const buttons = Array.from(dialog?.querySelectorAll<HTMLButtonElement>("button") ?? []);
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    expect(dialog?.getAttribute("aria-labelledby")).toBe("confirm-dialog-title");
    expect(document.activeElement).toBe(title);
    expect(container.hasAttribute("inert")).toBe(true);

    act(() => title?.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true })));
    expect(document.activeElement).toBe(buttons.at(-1));
    act(() => buttons[0]?.focus());
    act(() => buttons[0]?.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true })));
    expect(document.activeElement).toBe(buttons.at(-1));
    act(() => buttons.at(-1)?.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true })));
    expect(document.activeElement).toBe(buttons[0]);
  });

  it("cancels on Escape and restores focus to the exact opener", async () => {
    opener.focus();
    let result!: Promise<boolean>;
    act(() => {
      result = useConfirmStore.getState().request({ title: "Make this track public?" });
    });
    const dialog = document.body.querySelector<HTMLElement>("[role='dialog']");
    act(() => dialog?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    await expect(result).resolves.toBe(false);
    expect(document.body.querySelector("[role='dialog']")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});
