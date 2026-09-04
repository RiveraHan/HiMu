import {
  shareTrackMoment,
  type ShareTrackMomentDependencies,
} from "@/src/moment/share-track";

const content = {
  url: "https://himu.app/track/00000000-0000-4000-8000-000000000001",
  title: "HiMu Moment",
  message: "Listen to my HiMu Moment",
} as const;

describe("shareTrackMoment", () => {
  it("uses the native Android share capability", async () => {
    const nativeShare = jest.fn().mockResolvedValue("shared");

    await expect(
      shareTrackMoment(content, { platform: "android", nativeShare }),
    ).resolves.toEqual({ outcome: "shared" });
    expect(nativeShare).toHaveBeenCalledWith(content);
  });

  it("reports a dismissed native share without treating it as an error", async () => {
    const nativeShare = jest.fn().mockResolvedValue("cancelled");

    await expect(
      shareTrackMoment(content, { platform: "android", nativeShare }),
    ).resolves.toEqual({ outcome: "cancelled" });
  });

  it("returns unavailable when the native capability is absent or fails", async () => {
    await expect(
      shareTrackMoment(content, { platform: "android" }),
    ).resolves.toEqual({ outcome: "unavailable" });

    await expect(
      shareTrackMoment(content, {
        platform: "android",
        nativeShare: jest.fn().mockRejectedValue(new Error("native failure")),
      }),
    ).resolves.toEqual({ outcome: "unavailable" });
  });

  it("uses browser share only in a secure supported context", async () => {
    const webShare = jest.fn().mockResolvedValue(undefined);
    const copy = jest.fn().mockResolvedValue(undefined);

    await expect(
      shareTrackMoment(content, {
        platform: "web",
        isSecureContext: true,
        webShare,
        copy,
      }),
    ).resolves.toEqual({ outcome: "shared" });
    expect(webShare).toHaveBeenCalledWith(content);
    expect(copy).not.toHaveBeenCalled();
  });

  it.each([false, undefined])(
    "copies the URL when secure browser share eligibility is %s",
    async (isSecureContext) => {
      const webShare = jest.fn().mockResolvedValue(undefined);
      const copy = jest.fn().mockResolvedValue(undefined);

      await expect(
        shareTrackMoment(content, {
          platform: "web",
          isSecureContext,
          webShare,
          copy,
        }),
      ).resolves.toEqual({ outcome: "copied" });
      expect(webShare).not.toHaveBeenCalled();
      expect(copy).toHaveBeenCalledWith(content.url);
    },
  );

  it("distinguishes browser cancellation and never falls back to copying", async () => {
    const copy = jest.fn().mockResolvedValue(undefined);

    await expect(
      shareTrackMoment(content, {
        platform: "web",
        isSecureContext: true,
        webShare: jest.fn().mockRejectedValue({ name: "AbortError" }),
        copy,
      }),
    ).resolves.toEqual({ outcome: "cancelled" });
    expect(copy).not.toHaveBeenCalled();
  });

  it("falls back to copying after a non-cancellation browser share failure", async () => {
    const copy = jest.fn().mockResolvedValue(undefined);

    await expect(
      shareTrackMoment(content, {
        platform: "web",
        isSecureContext: true,
        webShare: jest.fn().mockRejectedValue(new Error("share failure")),
        copy,
      }),
    ).resolves.toEqual({ outcome: "copied" });
    expect(copy).toHaveBeenCalledWith(content.url);
  });

  it("returns copy_unavailable when copying is absent or denied", async () => {
    const dependencies: ShareTrackMomentDependencies[] = [
      { platform: "web", isSecureContext: false },
      {
        platform: "web",
        isSecureContext: false,
        copy: jest.fn().mockRejectedValue(new Error("clipboard denied")),
      },
    ];

    for (const deps of dependencies) {
      await expect(shareTrackMoment(content, deps)).resolves.toEqual({
        outcome: "copy_unavailable",
      });
    }
  });

  it("returns unavailable for unsupported platforms without invoking capabilities", async () => {
    const nativeShare = jest.fn().mockResolvedValue("shared");
    const webShare = jest.fn().mockResolvedValue(undefined);
    const copy = jest.fn().mockResolvedValue(undefined);

    await expect(
      shareTrackMoment(content, {
        platform: "unsupported",
        nativeShare,
        webShare,
        copy,
        isSecureContext: true,
      }),
    ).resolves.toEqual({ outcome: "unavailable" });
    expect(nativeShare).not.toHaveBeenCalled();
    expect(webShare).not.toHaveBeenCalled();
    expect(copy).not.toHaveBeenCalled();
  });
});
