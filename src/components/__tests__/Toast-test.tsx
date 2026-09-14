import { act, render } from "@testing-library/react-native";

import { ToastHost } from "@/src/components/Toast";
import {
  useToastStore,
  type ToastKind,
} from "@/src/stores/toast-store";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const mockNativeToastViews = new Set<object>();

jest.mock("react-native-reanimated", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } = jest.requireActual<typeof import("react-native")>(
    "react-native",
  );
  const Reanimated = jest.requireActual("react-native-reanimated/mock");

  function StalledAndroidExitView({ exiting, ...props }: { exiting?: unknown }) {
    const nativeView = React.useRef({});

    React.useEffect(() => {
      const mountedNativeView = nativeView.current;
      mockNativeToastViews.add(mountedNativeView);
      return () => {
        // Models Reanimated #9170: a stalled layout-exit callback leaves the
        // native view registered after React has removed its component.
        if (exiting === undefined) mockNativeToastViews.delete(mountedNativeView);
      };
    }, [exiting]);

    return React.createElement(View, props);
  }

  return {
    ...Reanimated,
    default: { ...Reanimated.default, View: StalledAndroidExitView },
  };
});

const AUTO_DISMISS_MS = 3500;

type ToastTestNode = {
  parent: ToastTestNode | null;
  props: { exiting?: unknown };
};

async function show(kind: ToastKind, title: string) {
  await act(async () => {
    useToastStore.getState().show(kind, title);
  });
}

function findExitingAnimation(node: ToastTestNode) {
  let current: ToastTestNode | null = node;

  while (current) {
    if (current.props.exiting !== undefined) return current.props.exiting;
    current = current.parent;
  }

  return undefined;
}

describe("ToastHost lifecycle", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockNativeToastViews.clear();
    useToastStore.setState({ current: null });
  });

  afterEach(async () => {
    await act(async () => {
      useToastStore.setState({ current: null });
    });
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it.each([
    ["info", "Mix ready"],
    ["error", "Mix failed"],
  ] as const)("auto-dismisses a %s toast at its deadline", async (kind, title) => {
    await show(kind, title);
    const screen = await render(<ToastHost />);

    await act(async () => {
      jest.advanceTimersByTime(AUTO_DISMISS_MS - 1);
    });
    expect(screen.getByText(title)).toBeTruthy();
    expect(useToastStore.getState().current?.title).toBe(title);

    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(useToastStore.getState().current).toBeNull();
    expect(screen.queryByText(title)).toBeNull();
  });

  it("gives a replacement its full lifetime and keeps only the last burst item", async () => {
    await show("info", "Preparing mix");
    const screen = await render(<ToastHost />);

    await act(async () => {
      jest.advanceTimersByTime(3000);
      useToastStore.getState().show("error", "First failure");
      useToastStore.getState().show("warning", "Retrying");
      useToastStore.getState().show("info", "Recovered");
    });

    expect(screen.queryByText("Preparing mix")).toBeNull();
    expect(screen.queryByText("First failure")).toBeNull();
    expect(screen.queryByText("Retrying")).toBeNull();
    expect(screen.getByText("Recovered")).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    expect(screen.getByText("Recovered")).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(useToastStore.getState().current).toBeNull();
    expect(screen.queryByText("Recovered")).toBeNull();
  });

  it("cleans its timer on a global unmount and restarts it when remounted", async () => {
    await show("info", "Still relevant");
    const firstMount = await render(<ToastHost />);

    await firstMount.unmount();
    await act(async () => {
      jest.advanceTimersByTime(AUTO_DISMISS_MS);
    });
    expect(useToastStore.getState().current?.title).toBe("Still relevant");

    const secondMount = await render(<ToastHost />);
    expect(secondMount.getByText("Still relevant")).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(AUTO_DISMISS_MS);
    });
    expect(useToastStore.getState().current).toBeNull();
    expect(secondMount.queryByText("Still relevant")).toBeNull();
  });

  it("does not depend on an Android layout-exit callback to remove the toast", async () => {
    await show("error", "Native removal boundary");
    const screen = await render(<ToastHost />);

    expect(mockNativeToastViews.size).toBe(1);
    expect(findExitingAnimation(screen.getByRole("alert"))).toBeUndefined();

    await act(async () => {
      jest.advanceTimersByTime(AUTO_DISMISS_MS);
    });

    expect(useToastStore.getState().current).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(mockNativeToastViews.size).toBe(0);
  });
});
