import { DesktopRail } from "@/src/components/navigation/DesktopRail";
import { useCurrentUser } from "@/src/hooks/use-auth";
import { useDJs } from "@/src/hooks/use-home";

export function ConnectedDesktopRail() {
  const user = useCurrentUser();
  const djs = useDJs().data;
  const ownedDjId = djs === undefined
    ? undefined
    : djs.find((dj) => dj.owner_id === user?.id)?.id ?? null;

  return <DesktopRail ownedDjId={ownedDjId} />;
}
