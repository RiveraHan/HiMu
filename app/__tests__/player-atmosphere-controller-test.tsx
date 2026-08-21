import { act, render } from "@testing-library/react-native";
import { useCallback, useState } from "react";
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

function Harness({ identity, callbacks }: { identity: string; callbacks: Map<string, ControllerCallbacks> }) {
  const [current, setCurrent] = useState({ token: null as symbol | null, identity: "", displayed: false });
  const activate = useCallback((token: symbol, nextIdentity: string) => {
    setCurrent({ token, identity: nextIdentity, displayed: false });
  }, []);
  const change = useCallback((update: { token: symbol; identity: string; displayed: boolean }) => {
    setCurrent((previous) => previous.token === update.token
      ? { ...previous, identity: update.identity, displayed: update.displayed }
      : previous);
  }, []);
  const deactivate = useCallback((token: symbol) => {
    setCurrent((previous) => previous.token === token
      ? { token: null, identity: "", displayed: false }
      : previous);
  }, []);

  return (
    <ArtworkAtmosphereController
      key={identity}
      identity={identity}
      onActivate={activate}
      onAtmosphereChange={change}
      onDeactivate={deactivate}
    >
      {(nextCallbacks) => {
        callbacks.set(identity, nextCallbacks);
        return <Text testID="atmosphere-state">{`${current.identity}:${current.displayed}`}</Text>;
      }}
    </ArtworkAtmosphereController>
  );
}

test("an unmounted first-A callback cannot activate the later A controller", async () => {
  const callbacks = new Map<string, ControllerCallbacks>();
  const screen = await render(<Harness identity='["A"]' callbacks={callbacks} />);
  const oldA = callbacks.get('["A"]')!;

  await act(async () => {
    await screen.rerender(<Harness identity='["B"]' callbacks={callbacks} />);
    await screen.rerender(<Harness identity='["A-2"]' callbacks={callbacks} />);
  });
  const currentA = callbacks.get('["A-2"]')!;

  await act(async () => oldA.onDisplay());
  expect(screen.getByTestId("atmosphere-state").props.children).toBe('["A-2"]:false');

  await act(async () => currentA.onDisplay());
  expect(screen.getByTestId("atmosphere-state").props.children).toBe('["A-2"]:true');
});
