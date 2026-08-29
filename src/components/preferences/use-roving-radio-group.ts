import { useRef } from "react";
import { Platform, type View } from "react-native";

type Focusable = Readonly<{ focus(): void }>;

type RadioKeyboardEvent = Readonly<{
  key?: string;
  nativeEvent?: Readonly<{ key?: string }>;
  preventDefault?(): void;
}>;

type RovingRadioProps = Readonly<{
  ref?: (node: View | null) => void;
  tabIndex?: 0 | -1;
  "aria-checked"?: boolean;
  onKeyDown?: (event: RadioKeyboardEvent) => void;
}>;

export function useRovingRadioGroup<T extends string>(
  options: readonly T[],
  value: T | null,
  disabled: boolean,
  onChange: (value: T) => void,
): (index: number) => RovingRadioProps {
  const optionRefs = useRef<(Focusable | null)[]>([]);
  const selectedIndex = options.findIndex((option) => option === value);
  const tabbableIndex = selectedIndex >= 0 ? selectedIndex : 0;

  return (index: number) => {
    if (Platform.OS !== "web") return {};

    const selectRelative = (delta: -1 | 1) => {
      if (disabled || options.length === 0) return;
      const nextIndex = (index + delta + options.length) % options.length;
      const nextValue = options[nextIndex];
      if (nextValue === undefined) return;
      onChange(nextValue);
      optionRefs.current[nextIndex]?.focus();
    };

    return {
      ref: (node) => {
        optionRefs.current[index] = node as unknown as Focusable | null;
      },
      tabIndex: !disabled && index === tabbableIndex ? 0 : -1,
      "aria-checked": options[index] === value,
      onKeyDown: (event) => {
        const key = event.key ?? event.nativeEvent?.key;
        if (key === "ArrowLeft" || key === "ArrowUp") {
          event.preventDefault?.();
          selectRelative(-1);
        } else if (key === "ArrowRight" || key === "ArrowDown") {
          event.preventDefault?.();
          selectRelative(1);
        }
      },
    };
  };
}
