import { create } from "zustand";

export type ToastKind = "info" | "warning" | "error";

type ToastState = {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
};

type State = {
  current: ToastState | null;
  show: (kind: ToastKind, title: string, message?: string) => void;
  dismiss: () => void;
};

let nextId = 0;

export const useToastStore = create<State>((set) => ({
  current: null,
  show: (kind, title, message) =>
    set({ current: { id: ++nextId, kind, title, message } }),
  dismiss: () => set({ current: null }),
}));
