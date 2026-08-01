import { publicHttpsUrl } from "@/src/utils/public-url";

describe("publicHttpsUrl", () => {
  it("keeps a valid public HTTPS destination", () => {
    expect(publicHttpsUrl("https://himu.app/privacy")).toBe(
      "https://himu.app/privacy",
    );
  });

  it.each([
    ["an HTTP URL", "http://himu.app/privacy"],
    ["a script URL", "javascript:alert(1)"],
    ["an absent value", undefined],
  ])("rejects %s", (_case, value) => {
    expect(publicHttpsUrl(value)).toBeNull();
  });
});
