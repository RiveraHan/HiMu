import { create } from "zustand";

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type PendingConfirm = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive: boolean;
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
          confirmLabel: opts.confirmLabel ?? "Confirm",
          cancelLabel: opts.cancelLabel ?? "Cancel",
          destructive: opts.destructive ?? false,
          resolve,
        },
      });
    }),
  resolve: (ok) => {
    get().pending?.resolve(ok);
    set({ pending: null });
  },
}));
