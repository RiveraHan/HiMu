import { useToastStore } from "@/src/stores/toast-store";
import { useMemo } from "react";

export function useToast() {
  const show = useToastStore((s) => s.show);

  return useMemo(
    () => ({
      info: (title: string, message?: string) => show("info", title, message),
      warning: (title: string, message?: string) =>
        show("warning", title, message),
      error: (title: string, message?: string) => show("error", title, message),
    }),
    [show],
  );
}
