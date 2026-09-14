import { act, cleanup, renderHook, waitFor } from "@testing-library/react-native";
import { useState } from "react";

import { useDjIdentityController, type DjIdentityController } from "../use-dj-identity-controller";
import { useDjIdentityDrafts } from "@/src/hooks/use-creative-draft";
import type { DjIdentityDraftValue } from "@/src/components/dj/DjIdentityDraftStep";

const mockDraft = jest.fn();
let mockCurrentUserId: string | null = "listener";

jest.mock("@/src/hooks/use-creative-draft", () => ({ useDjIdentityDrafts: jest.fn() }));
jest.mock("@/src/i18n/use-locale", () => ({ useLocale: () => ({ resolvedLanguage: "en" }) }));
jest.mock("@/src/hooks/use-auth", () => ({ useCurrentUser: () => mockCurrentUserId ? ({ id: mockCurrentUserId }) : null }));

const traits = { genres: ["House"], moods: ["Dreamy"], energy: 6, isInstrumental: false, vibe: "Rain-lit rooftop" };
const candidates = [
  { name: "Static Bloom", identityConcept: "A patient selector tracing city lights through warm analog haze." },
  { name: "Velvet Index", identityConcept: "A curious archivist reshaping forgotten dance floors into intimate rituals." },
  { name: "Orbit Mercy", identityConcept: "A celestial night guide balancing kinetic rhythm with quiet gravity." },
];

function useHarness(active: boolean, energy = 6) {
  const [value, setValue] = useState<DjIdentityDraftValue>({ name: "", identityConcept: "", provenance: "custom", confirmed: false });
  return useDjIdentityController({ active, fingerprint: `sound-${energy}`, traits: { ...traits, energy }, value, onChange: setValue });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCurrentUserId = "listener";
  mockDraft.mockResolvedValue({ version: 1, kind: "dj-identity", draft: { candidates } });
  jest.mocked(useDjIdentityDrafts).mockImplementation(() => ({ mutateAsync: mockDraft }) as never);
});

afterEach(cleanup);

test("requests only once when Identity becomes active and reuses candidates on return", async () => {
  const view = await renderHook<DjIdentityController, { active: boolean }>(({ active }) => useHarness(active), { initialProps: { active: false } });
  expect(mockDraft).not.toHaveBeenCalled();

  await act(async () => { view.rerender({ active: true }); });
  await waitFor(() => expect(mockDraft).toHaveBeenCalledTimes(1));
  await act(async () => { view.rerender({ active: false }); });
  await act(async () => { view.rerender({ active: true }); });
  expect(mockDraft).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(view.result.current.status).toBe("ready"));
  await view.unmount();
});

test("marks confirmed text stale without discarding it and requests once for a new fingerprint", async () => {
  function useConfirmedHarness(active: boolean, energy: number) {
    const [value, setValue] = useState<DjIdentityDraftValue>({ name: "Static Bloom", identityConcept: candidates[0].identityConcept, provenance: "suggested", confirmed: true });
    return { controller: useDjIdentityController({ active, fingerprint: `sound-${energy}`, traits: { ...traits, energy }, value, onChange: setValue }), value };
  }
  const view = await renderHook<{ controller: DjIdentityController; value: DjIdentityDraftValue }, { active: boolean; energy: number }>(({ active, energy }) => useConfirmedHarness(active, energy), { initialProps: { active: true, energy: 6 } });
  await waitFor(() => expect(mockDraft).toHaveBeenCalledTimes(1));
  await act(async () => { view.rerender({ active: false, energy: 7 }); });
  await waitFor(() => expect(view.result.current.value).toMatchObject({ name: "Static Bloom", confirmed: false }));
  await act(async () => { view.rerender({ active: true, energy: 7 }); });
  await waitFor(() => expect(mockDraft).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(view.result.current.controller.status).toBe("ready"));
  await view.unmount();
});

test("ignores a stale response after the fingerprint changes", async () => {
  let resolveFirst!: (value: unknown) => void;
  let resolveSecond!: (value: unknown) => void;
  mockDraft.mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
    .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));
  const view = await renderHook<DjIdentityController, { active: boolean; energy: number }>(({ active, energy }) => useHarness(active, energy), { initialProps: { active: true, energy: 6 } });
  await waitFor(() => expect(mockDraft).toHaveBeenCalledTimes(1));
  await act(async () => { view.rerender({ active: false, energy: 7 }); });
  await act(async () => { view.rerender({ active: true, energy: 7 }); });
  await waitFor(() => expect(mockDraft).toHaveBeenCalledTimes(2));
  await act(async () => { resolveSecond({ version: 1, kind: "dj-identity", draft: { candidates } }); });
  await waitFor(() => expect(view.result.current.candidates[0]?.name).toBe("Static Bloom"));
  await act(async () => { resolveFirst({ version: 1, kind: "dj-identity", draft: { candidates: [{ ...candidates[0], name: "Stale" }] } }); });
  expect(view.result.current.candidates[0]?.name).toBe("Static Bloom");
  await view.unmount();
});

test("regeneration excludes current candidate names", async () => {
  const view = await renderHook<DjIdentityController, void>(() => useHarness(true));
  await waitFor(() => expect(view.result.current.status).toBe("ready"));
  await act(async () => { await view.result.current.request(); });
  expect(mockDraft).toHaveBeenLastCalledWith(expect.objectContaining({ exclude: candidates.map((candidate) => candidate.name) }));
  await view.unmount();
});

test("clears candidates while an explicit regeneration is loading", async () => {
  let resolveRegeneration!: (value: unknown) => void;
  mockDraft.mockResolvedValueOnce({ version: 1, kind: "dj-identity", draft: { candidates } })
    .mockImplementationOnce(() => new Promise((resolve) => { resolveRegeneration = resolve; }));
  const view = await renderHook<DjIdentityController, void>(() => useHarness(true));
  await waitFor(() => expect(view.result.current.status).toBe("ready"));
  let request!: Promise<void>;
  await act(async () => { request = view.result.current.request(); });
  expect(view.result.current).toMatchObject({ status: "loading", candidates: [] });
  await act(async () => {
    resolveRegeneration({ version: 1, kind: "dj-identity", draft: { candidates } });
    await request;
  });
  await view.unmount();
});

test("exposes failure without inserting a generic candidate and permits custom entry", async () => {
  mockDraft.mockRejectedValueOnce(new Error("unavailable"));
  const view = await renderHook<DjIdentityController, void>(() => useHarness(true));
  await waitFor(() => expect(view.result.current.status).toBe("error"));
  expect(view.result.current.candidates).toEqual([]);
  await act(async () => { view.result.current.startCustom(); });
  await act(async () => { view.result.current.edit("name", "Night Cartographer"); });
  expect(view.result.current.selectedName).toBeNull();
  await view.unmount();
});

test("does not request again when traits change while Identity remains active", async () => {
  const view = await renderHook<DjIdentityController, { energy: number }>(
    ({ energy }) => useHarness(true, energy),
    { initialProps: { energy: 6 } },
  );
  await waitFor(() => expect(view.result.current.status).toBe("ready"));
  await act(async () => { view.rerender({ energy: 7 }); });
  expect(mockDraft).toHaveBeenCalledTimes(1);
  expect(view.result.current.candidates).toEqual([]);
  await view.unmount();
});

test("clears candidates and ignores a late request after the auth scope changes", async () => {
  let resolveDraft!: (value: unknown) => void;
  mockDraft.mockImplementationOnce(() => new Promise((resolve) => { resolveDraft = resolve; }));
  const view = await renderHook<DjIdentityController, { userId: string }>(
    ({ userId }) => {
      mockCurrentUserId = userId;
      return useHarness(true);
    },
    { initialProps: { userId: "listener" } },
  );
  await waitFor(() => expect(mockDraft).toHaveBeenCalledTimes(1));
  await act(async () => { view.rerender({ userId: "another-listener" }); });
  expect(view.result.current.candidates).toEqual([]);
  await act(async () => { resolveDraft({ version: 1, kind: "dj-identity", draft: { candidates } }); });
  expect(view.result.current.candidates).toEqual([]);
  await view.unmount();
});

test("does not apply an in-flight request after unmount", async () => {
  let resolveDraft!: (value: unknown) => void;
  mockDraft.mockImplementationOnce(() => new Promise((resolve) => { resolveDraft = resolve; }));
  const view = await renderHook<DjIdentityController, void>(() => useHarness(true));
  await waitFor(() => expect(mockDraft).toHaveBeenCalledTimes(1));
  await view.unmount();
  await act(async () => { resolveDraft({ version: 1, kind: "dj-identity", draft: { candidates } }); });
  expect(mockDraft).toHaveBeenCalledTimes(1);
});

test("retries the same fingerprint after leaving Identity while loading", async () => {
  let resolveFirst!: (value: unknown) => void;
  mockDraft.mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
    .mockResolvedValueOnce({ version: 1, kind: "dj-identity", draft: { candidates } });
  const view = await renderHook<DjIdentityController, { active: boolean }>(
    ({ active }) => useHarness(active),
    { initialProps: { active: true } },
  );
  await waitFor(() => expect(view.result.current.status).toBe("loading"));
  await act(async () => { view.rerender({ active: false }); });
  expect(view.result.current.status).toBe("idle");
  await act(async () => { view.rerender({ active: true }); });
  await waitFor(() => expect(view.result.current.status).toBe("ready"));
  expect(mockDraft).toHaveBeenCalledTimes(2);
  await act(async () => { resolveFirst({ version: 1, kind: "dj-identity", draft: { candidates: [{ ...candidates[0], name: "Late" }] } }); });
  expect(view.result.current.candidates[0]?.name).toBe("Static Bloom");
  await view.unmount();
});

test("resets a disabled in-flight request so a later Identity entry can recover", async () => {
  let resolveFirst!: (value: unknown) => void;
  mockDraft.mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
    .mockResolvedValueOnce({ version: 1, kind: "dj-identity", draft: { candidates } });
  const view = await renderHook<DjIdentityController, { active: boolean; disabled: boolean }>(
    ({ active, disabled }) => {
      const [value, setValue] = useState<DjIdentityDraftValue>({ name: "", identityConcept: "", provenance: "custom", confirmed: false });
      return useDjIdentityController({ active, disabled, fingerprint: "sound-a", traits, value, onChange: setValue });
    },
    { initialProps: { active: true, disabled: false } },
  );
  await waitFor(() => expect(view.result.current.status).toBe("loading"));
  await act(async () => { view.rerender({ active: true, disabled: true }); });
  expect(view.result.current.status).toBe("idle");
  await act(async () => { view.rerender({ active: false, disabled: false }); });
  await act(async () => { view.rerender({ active: true, disabled: false }); });
  await waitFor(() => expect(view.result.current.status).toBe("ready"));
  expect(mockDraft).toHaveBeenCalledTimes(2);
  await act(async () => { resolveFirst({ version: 1, kind: "dj-identity", draft: { candidates: [{ ...candidates[0], name: "Late" }] } }); });
  expect(view.result.current.candidates[0]?.name).toBe("Static Bloom");
  await view.unmount();
});
