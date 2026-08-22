/** @jest-environment jsdom */
import { act } from "react";
// The app ships react-dom through Expo; this test uses its runtime without package churn.
// @ts-expect-error react-dom's optional type package is not installed in this workspace
import { createRoot } from "react-dom/client";

import { LanguagePreferenceSelect } from "../LanguagePreferencePicker.web";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

const labels = {
  label: "Language",
  loading: "Loading",
  retry: "Retry",
  saveError: "We couldn't sync your preference.",
  system: "Device language (English)",
  en: "English",
  es: "Spanish",
};

describe("LanguagePreferenceSelect", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("persists a keyboard/change selection and exposes the pending state", async () => {
    const save = deferred<void>();
    const onSelect = jest.fn(() => save.promise);
    act(() => {
      root.render(
        <LanguagePreferenceSelect
          preference="system"
          isSaving={false}
          saveError={false}
          onSelect={onSelect}
          onRetry={jest.fn()}
          labels={labels}
        />,
      );
    });

    const select = container.querySelector<HTMLSelectElement>("select");
    const label = container.querySelector<HTMLLabelElement>("label");
    expect(select?.getAttribute("aria-label")).toBe("Language");
    expect(label?.style.fontFamily).toContain("Manrope-Regular");
    expect(select?.style.fontFamily).toContain("Manrope-Regular");
    expect(Array.from(select!.options).map((option) => option.value)).toEqual([
      "system",
      "en",
      "es",
    ]);

    await act(async () => {
      select!.value = "en";
      select!.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
    });

    expect(onSelect).toHaveBeenCalledWith("en");
    expect(select?.disabled).toBe(true);
    expect(select?.getAttribute("aria-busy")).toBe("true");
    expect(container.querySelector("[role='status']")?.textContent).toBe("Loading");

    await act(async () => {
      save.resolve();
      await save.promise;
    });
    expect(select?.disabled).toBe(false);
  });

  it("announces persistence failure and exposes an explicit retry action", () => {
    const onRetry = jest.fn();
    act(() => {
      root.render(
        <LanguagePreferenceSelect
          preference="es"
          isSaving={false}
          saveError
          onSelect={jest.fn(async () => undefined)}
          onRetry={onRetry}
          labels={labels}
        />,
      );
    });

    expect(container.querySelector("[role='alert']")?.textContent).toContain(
      labels.saveError,
    );
    const retry = container.querySelector<HTMLButtonElement>("button");
    expect(retry?.textContent).toBe("Retry");
    act(() => retry?.click());
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
