import { DesktopRail } from "@/src/components/navigation/DesktopRail";

/**
 * Native keeps the rail dependency-free. Track creation remains available
 * from Home and the owned DJ detail on large native screens.
 */
export function ConnectedDesktopRail() {
  return <DesktopRail ownedDjId={null} />;
}
