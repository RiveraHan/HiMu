import { act, fireEvent, render } from "@testing-library/react-native";
import { StyleSheet as RNStyleSheet, Text as NativeText, View } from "react-native";

import { Button } from "@/src/components/Button";
import { ConfirmDialogHost } from "@/src/components/ConfirmDialog";
import { MiniPlayer } from "@/src/components/MiniPlayer";
import { PlaylistCard } from "@/src/components/PlaylistCard";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { ToastHost } from "@/src/components/Toast";
import { TrackCard } from "@/src/components/TrackCard";
import { Chip } from "@/src/components/preferences/Chip";
import { SettingRow } from "@/src/components/profile/SettingsRow";
import { SettingsInfoRow } from "@/src/components/settings/SettingsInfoRow";
import i18n from "@/src/i18n";
import { useConfirmStore } from "@/src/stores/confirm-store";
import { usePlayerStore } from "@/src/stores/player-store";
import { useToastStore } from "@/src/stores/toast-store";

jest.mock("@/src/audio/use-player", () => ({
  usePlayer: () => ({
    next: jest.fn(),
    prev: jest.fn(),
    toggle: jest.fn(),
  }),
}));

jest.mock("expo-router", () => ({
  router: {
    back: jest.fn(),
    canGoBack: () => true,
  },
  useRouter: () => ({ push: jest.fn() }),
  useSegments: () => ["(app)"],
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

describe("shared component translations", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("es");
    useConfirmStore.setState({ pending: null });
    useToastStore.setState({ current: null });
    usePlayerStore.getState().reset();
  });

  it("exposes Spanish accessibility labels while preserving dynamic content", async () => {
    useToastStore.getState().show("info", "Título dinámico");
    usePlayerStore.getState().setNowPlaying(
      {
        id: "track-1",
        title: "Canción dinámica",
        artist: "Artista dinámico",
        audio_url: "https://example.com/audio.mp3",
        album_art_url: null,
        duration: 180,
      },
      [],
      0,
    );
    usePlayerStore.getState().setIsPlaying(true);

    const screen = await render(
      <View>
        <ScreenHeader title="Encabezado dinámico" />
        <MiniPlayer />
        <ToastHost />
        <Chip label="Ambient" onRemove={jest.fn()} />
      </View>,
    );

    expect(screen.getByLabelText("Atrás")).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: "Abrir reproductor: Canción dinámica de Artista dinámico",
      }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Anterior" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Pausar" })).toHaveProp(
      "accessibilityState",
      { disabled: false, selected: true },
    );
    expect(screen.getByLabelText("Descartar")).toBeTruthy();
    expect(screen.getByLabelText("Eliminar Ambient")).toBeTruthy();
    expect(screen.getByText("Encabezado dinámico")).toBeTruthy();
    expect(screen.getByText("Canción dinámica")).toBeTruthy();
    expect(screen.getByText("Artista dinámico")).toBeTruthy();
    expect(screen.getByText("Título dinámico")).toBeTruthy();
  });

  it("localizes shared card metadata", async () => {
    const screen = await render(
      <View>
        <TrackCard
          title="Título dinámico"
          artist="Artista dinámico"
          isPlaying
        />
        <PlaylistCard name="Lista dinámica" trackCount={2} />
      </View>,
    );

    expect(screen.getByText("Reproduciendo")).toBeTruthy();
    expect(screen.getByText("2 pistas")).toBeTruthy();
    expect(screen.getByText("Título dinámico")).toBeTruthy();
    expect(screen.getByText("Artista dinámico")).toBeTruthy();
    expect(screen.getByText("Lista dinámica")).toBeTruthy();
  });

  it("renders highlighted track state with localized visible and spoken cues", async () => {
    const screen = await render(
      <TrackCard
        title="Mezcla nueva"
        artist="DJ Uno"
        variant="row"
        highlighted
        highlightedLabel="Nueva"
        accessibilityHint="Mezcla recién generada"
      />,
    );

    expect(screen.getByText("Nueva")).toBeTruthy();
    const row = screen.getByA11yHint("Mezcla recién generada");
    expect(row).toHaveProp("accessibilityState", { selected: true });
  });

  it("localizes default confirmation actions and preserves overrides", async () => {
    void useConfirmStore.getState().request({ title: "Título dinámico" });
    const screen = await render(<ConfirmDialogHost />);

    expect(screen.getByText("Confirmar")).toBeTruthy();
    expect(screen.getByText("Cancelar")).toBeTruthy();

    await act(async () => {
      useConfirmStore.getState().resolve(false);
      void useConfirmStore.getState().request({
        title: "Título dinámico",
        confirmLabel: "Hazlo",
        cancelLabel: "Nunca",
      });
    });
    await screen.rerender(<ConfirmDialogHost />);

    expect(screen.getByText("Hazlo")).toBeTruthy();
    expect(screen.getByText("Nunca")).toBeTruthy();
  });

  it("exposes all Button variants as named controls with disabled and busy state", async () => {
    const screen = await render(
      <View>
        <Button label="Principal" disabled />
        <Button variant="glass" label="Vidrio" loading loadingLabel="Cargando" />
        <Button variant="ghost" label="Fantasma" />
      </View>,
    );

    expect(screen.getByRole("button", { name: "Principal" })).toHaveProp(
      "accessibilityState",
      { disabled: true, busy: false },
    );
    expect(screen.getByRole("button", { name: "Cargando" })).toHaveProp(
      "accessibilityState",
      { disabled: true, busy: true },
    );
    const ghost = screen.getByRole("button", { name: "Fantasma" });
    expect(ghost).toHaveProp("accessibilityState", { disabled: false, busy: false });
    expect(RNStyleSheet.flatten(ghost.props.style)).toEqual(
      expect.objectContaining({ minHeight: 44, minWidth: 44 }),
    );
  });

  it("keeps informational settings visible without actionable semantics", async () => {
    const screen = await render(
      <View>
        <SettingRow
          icon={<View />}
          label="Suscripción de perfil"
          right={<NativeText>Premium de perfil</NativeText>}
        />
        <SettingsInfoRow
          icon={<View />}
          label="Suscripción de cuenta"
          value="Premium de cuenta"
        />
      </View>,
    );

    expect(screen.getByText("Suscripción de perfil")).toBeTruthy();
    expect(screen.getByText("Premium de perfil")).toBeTruthy();
    expect(screen.getByText("Suscripción de cuenta")).toBeTruthy();
    expect(screen.getByText("Premium de cuenta")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Suscripción de perfil" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Suscripción de cuenta" }),
    ).toBeNull();
  });

  it("keeps a disabled settings action semantic and exposes its current value", async () => {
    const onPress = jest.fn();
    const screen = await render(
      <SettingsInfoRow
        icon={<View />}
        label="Idioma"
        value="Español"
        onPress={onPress}
        disabled
        accessory={<NativeText>⌄</NativeText>}
      />,
    );
    const language = screen.getByRole("button", { name: "Idioma" });

    expect(language).toHaveProp("accessibilityValue", { text: "Español" });
    expect(language).toHaveProp("accessibilityState", { disabled: true });
    expect(screen.getByText("⌄")).toBeTruthy();
    fireEvent.press(language);
    expect(onPress).not.toHaveBeenCalled();
  });
});
