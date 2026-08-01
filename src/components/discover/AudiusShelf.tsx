import {
  ContentShelf,
  ContentShelfSkeleton,
  StateNotice,
  Text,
} from "@/src/components";
import { useAudiusTrending } from "@/src/hooks/use-audius";
import { useOnlineStatus } from "@/src/hooks/use-online-status";
import type { PlayerTrack } from "@/src/stores/player-store";
import { isInitialQueryLoading } from "@/src/utils/query-state";
import { View } from "react-native";
import { useTranslation } from "react-i18next";

type Props = {
  title: string;
  genre?: string;
  onPlay: (tracks: PlayerTrack[], track: PlayerTrack, index: number) => void;
};

// One trending shelf. Hidden until it has at least 3 playable tracks, so an
// empty or failed genre never shows a sad half-row.
export function AudiusShelf({ title, genre, onPlay }: Props) {
  const { t } = useTranslation();
  const query = useAudiusTrending(genre);
  const online = useOnlineStatus();
  const tracks = query.data ?? [];
  const usable = tracks.length >= 3;
  const offlineWithoutData =
    !online && query.fetchStatus === "paused" && !usable;

  const titledNotice = (notice: React.ReactNode) => (
    <View style={{ gap: 12 }}>
      <Text variant="h2">{title}</Text>
      {notice}
    </View>
  );

  if (offlineWithoutData) {
    return titledNotice(
      <StateNotice
        compact
        kind="offline"
        title={t("common.errors.offline")}
        message={t("common.errors.reconnect")}
        actionLabel={t("common.actions.retry")}
        onAction={() => void query.refetch()}
      />,
    );
  }

  if (isInitialQueryLoading(query)) {
    return titledNotice(<ContentShelfSkeleton />);
  }

  if (query.isError && !usable) {
    return titledNotice(
      <StateNotice
        compact
        kind={online ? "error" : "offline"}
        title={t("discover.recommendationsUnavailable")}
        actionLabel={t("common.actions.retry")}
        onAction={() => void query.refetch()}
      />,
    );
  }

  if (!usable) {
    return titledNotice(
      <StateNotice compact kind="empty" title={t("discover.shelfEmpty")} />,
    );
  }

  return (
    <View style={{ gap: 12 }}>
      <ContentShelf
        title={title}
        tracks={tracks}
        getTrackAccessibilityLabel={(track) =>
          t("discover.playTrack", { title: track.title, artist: track.artist })
        }
        onPressTrack={(track, index) => onPlay(tracks, track, index)}
      />
      {query.isError || !online ? (
        <StateNotice
          compact
          kind={online ? "error" : "offline"}
          title={
            online
              ? t("discover.recommendationsUnavailable")
              : t("common.errors.offline")
          }
          actionLabel={t("common.actions.retry")}
          onAction={() => void query.refetch()}
        />
      ) : null}
    </View>
  );
}
