/**
 * Standalone check for the pure Audius transforms (no test framework in this repo).
 *   npx tsx scripts/check/audius.ts
 * Prints ✓ on success; exits non-zero on the first failure.
 */
import {
  isPlayable,
  mapAudiusTrack,
  type AudiusTrack,
} from "../../src/api/audius";

function check(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`✗ ${msg}`);
    process.exit(1);
  }
}

// Fixture captured from the live Audius API on 2026-07-09.
const playable: AudiusTrack = {
  id: "VPEA2ka",
  title: "GIRLS",
  user: { name: "Luci", handle: "luci.official" },
  artwork: { "150x150": "a", "480x480": "b", "1000x1000": "c" },
  genre: "Dubstep",
  mood: "Energizing",
  duration: 105,
  permalink: "/luci.official/girls",
  is_streamable: true,
  is_stream_gated: false,
  is_delete: false,
};

check(isPlayable(playable) === true, "streamable track is playable");
check(isPlayable({ ...playable, is_stream_gated: true }) === false, "gated track filtered");
check(isPlayable({ ...playable, is_delete: true }) === false, "deleted track filtered");
check(isPlayable({ ...playable, is_streamable: false }) === false, "non-streamable filtered");

const m = mapAudiusTrack(playable);
check(m.id === "audius:VPEA2ka", "id is namespaced");
check(m.artist === "Luci", "artist is the user name");
check(m.album_art_url === "b", "prefers 480x480 artwork");
check(m.duration === 105, "duration copied");
check(m.genre === "Dubstep", "genre copied");
check(
  m.audio_url === "https://api.audius.co/v1/tracks/VPEA2ka/stream?app_name=HiMu",
  "audio_url is the stable /stream endpoint",
);
check(
  mapAudiusTrack({ ...playable, artwork: { "1000x1000": "big" } }).album_art_url === "big",
  "falls back to 1000x1000",
);
check(mapAudiusTrack({ ...playable, artwork: null }).album_art_url === null, "null artwork -> null");

console.log("✓ audius transforms OK");
