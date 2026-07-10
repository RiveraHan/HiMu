import { ContentShelf } from "@/src/components";
import { useAudiusTrending } from "@/src/hooks/use-audius";
import type { PlayerTrack } from "@/src/stores/player-store";

type Props = {
  title: string;
  genre?: string;
  onPlay: (tracks: PlayerTrack[], track: PlayerTrack, index: number) => void;
};

// One trending shelf. Hidden until it has at least 3 playable tracks, so an
// empty or failed genre never shows a sad half-row.
export function AudiusShelf({ title, genre, onPlay }: Props) {
  const { data } = useAudiusTrending(genre);
  const tracks = data ?? [];
  if (tracks.length < 3) return null;
  return (
    <ContentShelf
      title={title}
      tracks={tracks}
      onPressTrack={(track, index) => onPlay(tracks, track, index)}
    />
  );
}
