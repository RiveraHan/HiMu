import { create } from "zustand";
import { Platform } from "react-native";

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  returnFocus?: () => void;
};

type PendingConfirm = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive: boolean;
  returnFocus?: () => void;
  resolve: (ok: boolean) => void;
};

type State = {
  pending: PendingConfirm | null;
  request: (opts: ConfirmOptions) => Promise<boolean>;
  resolve: (ok: boolean) => void;
};

export const useConfirmStore = create<State>((set, get) => ({
  pending: null,
  request: (opts) =>
    new Promise<boolean>((resolve) => {
      set({
        pending: {
          title: opts.title,
          message: opts.message ?? "",
          confirmLabel: opts.confirmLabel,
          cancelLabel: opts.cancelLabel,
          destructive: opts.destructive ?? false,
          returnFocus: opts.returnFocus,
          resolve,
        },
      });
    }),
  resolve: (ok) => {
    const pending = get().pending;
    pending?.resolve(ok);
    set({ pending: null });
    // The web host restores focus after its portal is removed. Native has no
    // DOM portal lifecycle, so it keeps the immediate accessibility return.
    if (Platform.OS !== "web") pending?.returnFocus?.();
  },
}));
