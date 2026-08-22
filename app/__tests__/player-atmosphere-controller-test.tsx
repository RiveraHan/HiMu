import { act, render } from "@testing-library/react-native";
import { Text } from "react-native";

import { ArtworkAtmosphereController } from "@/app/player";

jest.mock("@/src/api/supabase", () => ({ supabase: {} }));
jest.mock("@/src/audio/use-player", () => ({ usePlayer: () => ({}) }));
jest.mock("@/src/components", () => ({}));
jest.mock("@/src/hooks/use-favorites", () => ({}));
jest.mock("@/src/hooks/use-home", () => ({}));
jest.mock("@/src/hooks/use-track-private-details", () => ({}));
jest.mock("@/src/hooks/use-toast", () => ({}));

type ControllerCallbacks = {
  onDisplay: () => void;
  onStatusChange: (status: "idle" | "loading" | "loaded" | "error") => void;
};

test("an unmounted first-A callback emits nothing after a committed A-to-B-to-A lifecycle", async () => {
  const callbacks = new Map<string, ControllerCallbacks>();
  const onActivate = jest.fn();
  const onDeactivate = jest.fn();
  const onAtmosphereChange = jest.fn();
  const renderController = (identity: string) => (
    <ArtworkAtmosphereController
      key={identity}
      identity={identity}
      onActivate={onActivate}
      onDeactivate={onDeactivate}
      onAtmosphereChange={onAtmosphereChange}
    >
      {(nextCallbacks) => {
        callbacks.set(identity, nextCallbacks);
        return <Text>{identity}</Text>;
      }}
    </ArtworkAtmosphereController>
  );

  const screen = await render(renderController('["A"]'));
  await act(async () => undefined);
  const oldA = callbacks.get('["A"]')!;
  const firstAToken = onActivate.mock.calls[0][0] as symbol;

  await screen.rerender(renderController('["B"]'));
  await act(async () => undefined);
  const bToken = onActivate.mock.calls[1][0] as symbol;

  await screen.rerender(renderController('["A"]'));
  await act(async () => undefined);
  const currentA = callbacks.get('["A"]')!;
  const secondAToken = onActivate.mock.calls[2][0] as symbol;

  expect(onActivate.mock.calls.map(([, identity]) => identity)).toEqual([
    '["A"]', '["B"]', '["A"]',
  ]);
  expect(onDeactivate.mock.calls.map(([token]) => token)).toEqual([
    firstAToken, bToken,
  ]);
  expect(firstAToken).not.toBe(bToken);
  expect(bToken).not.toBe(secondAToken);
  expect(firstAToken).not.toBe(secondAToken);

  onAtmosphereChange.mockClear();
  await act(async () => oldA.onDisplay());
  expect(onAtmosphereChange).not.toHaveBeenCalled();

  await act(async () => currentA.onDisplay());
  expect(onAtmosphereChange).toHaveBeenCalledTimes(1);
  expect(onAtmosphereChange).toHaveBeenCalledWith({
    token: secondAToken,
    identity: '["A"]',
    displayed: true,
  });
});
