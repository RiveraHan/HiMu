import { useConfirmStore } from "@/src/stores/confirm-store";

export function useConfirm() {
  return useConfirmStore((s) => s.request);
}
