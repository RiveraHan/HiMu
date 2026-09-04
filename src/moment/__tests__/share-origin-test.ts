import { publicTrackMomentUrl } from "@/src/moment/share-origin";

const TRACK_ID = "00000000-0000-4000-8000-000000000001";

describe("publicTrackMomentUrl", () => {
  it.each([
    ["https://himu.app", `https://himu.app/track/${TRACK_ID}`],
    ["https://himu.app/", `https://himu.app/track/${TRACK_ID}`],
    ["HTTPS://HIMU.APP:443", `https://himu.app/track/${TRACK_ID}`],
  ])("builds a canonical track URL from the root HTTPS origin %s", (origin, expected) => {
    expect(publicTrackMomentUrl(origin, TRACK_ID)).toBe(expected);
  });

  it.each([
    ["an HTTP origin", "http://himu.app"],
    ["an origin with credentials", "https://user:secret@himu.app"],
    ["an origin with a path", "https://himu.app/beta"],
    ["an origin with a query", "https://himu.app?source=app"],
    ["an origin with a fragment", "https://himu.app#share"],
    ["a protocol-relative origin", "//himu.app"],
    ["an origin with embedded whitespace", "https://himu.app\n.evil"],
    ["an invalid origin", "not a URL"],
    ["an absent origin", undefined],
  ])("rejects %s", (_case, origin) => {
    expect(publicTrackMomentUrl(origin, TRACK_ID)).toBeNull();
  });

  it.each([
    "not-a-uuid",
    "../private",
    "00000000-0000-4000-8000-000000000001/extra",
    "",
  ])("rejects an invalid track id %s", (trackId) => {
    expect(publicTrackMomentUrl("https://himu.app", trackId)).toBeNull();
  });

  it("canonicalizes a valid uppercase UUID instead of preserving client path text", () => {
    expect(
      publicTrackMomentUrl(
        "https://himu.app",
        "AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE",
      ),
    ).toBe("https://himu.app/track/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
  });
});
