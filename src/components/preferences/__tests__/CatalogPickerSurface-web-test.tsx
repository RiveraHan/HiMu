/** @jest-environment jsdom */
import { act } from "react";
// @ts-expect-error react-dom's optional type package is not installed in this workspace
import { createRoot } from "react-dom/client";

import { CatalogPickerSurface } from "../CatalogPickerSurface.web";
import i18n from "@/src/i18n";

describe("CatalogPickerSurface.web", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let opener: HTMLButtonElement;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    opener = document.createElement("button");
    opener.textContent = "Open picker";
    document.body.appendChild(opener);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    opener.remove();
    container.remove();
  });

  it("renders Spanish Done and Search copy for browser and reader access", async () => {
    await i18n.changeLanguage("es");
    act(() => {
      root.render(
        <CatalogPickerSurface
          visible
          title="Géneros"
          groups={[]}
          selected={[]}
          min={0}
          max={3}
          query=""
          expandedGroup={null}
          getGroupLabel={(value) => value}
          getItemLabel={(value) => value}
          onChange={jest.fn()}
          onQueryChange={jest.fn()}
          onExpandedGroupChange={jest.fn()}
          onToggle={jest.fn()}
          onDone={jest.fn()}
          onRequestClose={jest.fn()}
        />,
      );
    });

    expect(document.body.querySelector("input")?.getAttribute("aria-label")).toBe("Buscar Géneros");
    expect(Array.from(document.body.querySelectorAll("button")).some((button) => button.textContent === "Listo")).toBe(true);
  });

  it("traps focus, closes on Escape, and restores the opener", () => {
    const onRequestClose = jest.fn();
    opener.focus();
    act(() => {
      root.render(
        <CatalogPickerSurface
          visible
          title="Genres"
          groups={[{ label: "electronic", items: ["Ambient"] }]}
          selected={[]}
          min={0}
          max={3}
          query=""
          expandedGroup="electronic"
          getGroupLabel={(value) => value}
          getItemLabel={(value) => value}
          onChange={jest.fn()}
          onQueryChange={jest.fn()}
          onExpandedGroupChange={jest.fn()}
          onToggle={jest.fn()}
          onDone={jest.fn()}
          onRequestClose={onRequestClose}
        />,
      );
    });

    const dialog = document.body.querySelector<HTMLElement>("[role='dialog']");
    const search = document.body.querySelector<HTMLInputElement>("input");
    const done = Array.from(document.body.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "Done");
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    expect(document.activeElement).toBe(search);
    expect(container.hasAttribute("inert")).toBe(true);

    act(() => search?.focus());
    act(() => search?.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true })));
    expect(document.activeElement).toBe(done);
    act(() => dialog?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(onRequestClose).toHaveBeenCalledTimes(1);

    act(() => root.render(<CatalogPickerSurface visible={false} title="Genres" groups={[]} selected={[]} min={0} max={3} query="" expandedGroup={null} getGroupLabel={(value) => value} getItemLabel={(value) => value} onChange={jest.fn()} onQueryChange={jest.fn()} onExpandedGroupChange={jest.fn()} onToggle={jest.fn()} onDone={jest.fn()} onRequestClose={onRequestClose} />));
    expect(document.activeElement).toBe(opener);
  });
});
