import { getListeningIdentity } from "../listening-identity";

describe("getListeningIdentity", () => {
  it.each([
    ["ambient", "etherealArchitect"],
    ["electronica", "pulseDriver"],
    ["neo-classical", "modernRomantic"],
    ["lo-fi", "etherealArchitect"],
    ["techno", "pulseDriver"],
    ["meditation", "stillMind"],
  ] as const)("maps %s to the %s semantic identity", (genre, id) => {
    expect(getListeningIdentity(genre)).toEqual({ id });
  });

  it.each([null, "unknown genre"])(
    "uses the sound explorer fallback for %s",
    (genre) => {
      expect(getListeningIdentity(genre)).toEqual({ id: "soundExplorer" });
    },
  );

  it("matches genres case-insensitively", () => {
    expect(getListeningIdentity("Ambient")).toEqual({
      id: "etherealArchitect",
    });
  });
});
