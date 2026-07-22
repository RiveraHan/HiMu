import { act, render } from "@testing-library/react-native";
import { View } from "react-native";

import { ConfirmDialogHost } from "@/src/components/ConfirmDialog";
import { MiniPlayer } from "@/src/components/MiniPlayer";
import { PlaylistCard } from "@/src/components/PlaylistCard";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { ToastHost } from "@/src/components/Toast";
import { TrackCard } from "@/src/components/TrackCard";
import { Chip } from "@/src/components/preferences/Chip";
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
    expect(screen.getByLabelText("Abrir reproductor")).toBeTruthy();
    expect(screen.getByLabelText("Pausar")).toBeTruthy();
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
});
