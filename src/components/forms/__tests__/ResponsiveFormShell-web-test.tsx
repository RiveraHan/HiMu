/** @jest-environment jsdom */
/* eslint-disable @typescript-eslint/no-require-imports, import/first */

import { act, type ReactNode } from "react";

const { createRoot } = require("react-dom/client") as {
  createRoot: (container: Element) => {
    render: (children: ReactNode) => void;
    unmount: () => void;
  };
};
const { Pressable, ScrollView, Text, View } = require("react-native-web") as typeof import("react-native");

import { formScrollViewProps } from "../form-layout";

function setMetric(
  element: HTMLElement,
  metric: "clientHeight" | "scrollHeight" | "offsetTop" | "offsetHeight",
  value: number,
) {
  Object.defineProperty(element, metric, {
    configurable: true,
    get: () => value,
  });
}

describe("ResponsiveFormShell web reachability", () => {
  it("scrolls the final action into the effective 200 percent zoom viewport", async () => {
    const viewport = { width: 720, height: 422 };
    const rootElement = document.createElement("div");
    document.body.append(rootElement);
    const root = createRoot(rootElement);

    await act(async () => {
      root.render(
        <ScrollView
          {...formScrollViewProps}
          testID="form-scroll-contract"
          style={[formScrollViewProps.style, viewport]}
        >
          <View style={{ height: 844 }} />
          <Pressable testID="final-form-action" accessibilityRole="button">
            <Text>Create DJ</Text>
          </Pressable>
        </ScrollView>,
      );
    });

    const scrollView = rootElement.querySelector<HTMLElement>("[data-testid='form-scroll-contract']");
    const finalAction = rootElement.querySelector<HTMLElement>("[data-testid='final-form-action']");

    expect(scrollView).not.toBeNull();
    expect(finalAction).not.toBeNull();
    if (!scrollView || !finalAction) return;

    setMetric(scrollView, "clientHeight", viewport.height);
    setMetric(scrollView, "scrollHeight", 900);
    setMetric(finalAction, "offsetTop", 844);
    setMetric(finalAction, "offsetHeight", 44);
    Object.defineProperty(scrollView, "scrollTop", {
      configurable: true,
      value: 0,
      writable: true,
    });
    Object.defineProperty(finalAction, "scrollIntoView", {
      configurable: true,
      value: () => {
        scrollView.scrollTop = 478;
      },
    });

    expect(scrollView.style.overflowY).toBe("scroll");
    expect(scrollView.style.width).toBe(`${viewport.width}px`);
    expect(scrollView.style.height).toBe(`${viewport.height}px`);
    expect(scrollView.scrollTop + scrollView.clientHeight).toBeLessThan(finalAction.offsetTop);

    await act(async () => {
      finalAction.focus();
      finalAction.scrollIntoView();
    });

    expect(document.activeElement).toBe(finalAction);
    expect(scrollView.scrollTop + scrollView.clientHeight).toBeGreaterThanOrEqual(
      finalAction.offsetTop + finalAction.offsetHeight,
    );

    await act(async () => {
      root.unmount();
    });
    rootElement.remove();
  });
});
