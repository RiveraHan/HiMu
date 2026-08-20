import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Linking, StyleSheet as RNStyleSheet } from "react-native";

import LoginScreen from "@/app/(auth)/login";
import i18n from "@/src/i18n";
import { darkTheme, lightTheme } from "@/src/theme/theme";

const mockToastError = jest.fn();
let mockWindowWidth = 390;

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({
    width: mockWindowWidth,
    height: 844,
    scale: 1,
    fontScale: 1,
  }),
}));


function relativeLuminance(hex: string) {
  const channels = hex.match(/\w\w/g)?.map((channel) => Number.parseInt(channel, 16) / 255);
  if (!channels || channels.length !== 3) throw new Error(`Expected hex color, received ${hex}`);
  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(foreground: string, background: string) {
  const [lighter, darker] = [
    relativeLuminance(foreground),
    relativeLuminance(background),
  ].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

jest.mock("@/src/api/auth", () => ({
  authApi: { signInWithGoogle: jest.fn() },
}));

jest.mock("@/src/audio/use-player", () => ({
  usePlayer: () => ({
    next: jest.fn(),
    prev: jest.fn(),
    toggle: jest.fn(),
  }),
}));

jest.mock("expo-audio", () => ({
  useAudioPlayer: jest.fn(),
  useAudioPlayerStatus: jest.fn(),
}));

jest.mock("@/src/hooks/use-toast", () => ({
  useToast: () => ({ error: mockToastError, info: jest.fn() }),
}));

describe("Login translations", () => {
  beforeEach(async () => {
    mockWindowWidth = 390;
    await i18n.changeLanguage("es");
    mockToastError.mockClear();
    delete process.env.EXPO_PUBLIC_TERMS_URL;
    delete process.env.EXPO_PUBLIC_PRIVACY_URL;
    jest.spyOn(Linking, "openURL").mockResolvedValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders without initializing Supabase when public configuration is absent", async () => {
    const screen = await render(<LoginScreen />);

    expect(screen.getByText("Bienvenido a HiMu")).toBeTruthy();
  });

  it("renders only the working authentication entry point in Spanish", async () => {
    const screen = await render(<LoginScreen />);

    expect(screen.getByText("Bienvenido a HiMu")).toBeTruthy();
    expect(screen.getByText("Tu música, presentada por DJs con IA.")).toBeTruthy();
    expect(screen.getByText("Continuar con Google")).toBeTruthy();
    expect(screen.queryByText("Continuar con Spotify")).toBeNull();
    expect(screen.queryByText("Iniciar sesión con correo")).toBeNull();
    expect(screen.queryByText("O")).toBeNull();
    expect(screen.queryByText(/¿No tienes una cuenta\?/)).toBeNull();
    expect(screen.queryByText("Regístrate")).toBeNull();
    expect(screen.queryByText("Próximamente")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByTestId("legal-separator")).toBeNull();
  });
  it("uses one Google action in the desktop sign-in panel without unsupported login methods", async () => {
    mockWindowWidth = 1440;
    process.env.EXPO_PUBLIC_TERMS_URL = "https://himu.app/terms";
    process.env.EXPO_PUBLIC_PRIVACY_URL = "https://himu.app/privacy";
    const screen = await render(<LoginScreen />);

    expect(screen.getByTestId("login-hero-desktop")).toBeTruthy();
    expect(screen.getByText("Haz que cada escucha sea tuya.")).toBeTruthy();
    expect(
      screen.getByText("Inicia sesión para guardar lo que escuchas y continuar donde lo dejaste."),
    ).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Continuar con Google" })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Términos" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Privacidad" })).toBeTruthy();
    expect(screen.queryByText("Iniciar sesión con correo")).toBeNull();
    expect(screen.queryByText(/Invitado|Guest/)).toBeNull();
  });


  it("renders valid legal destinations as 44 by 44 links with one separator", async () => {
    process.env.EXPO_PUBLIC_TERMS_URL = "https://himu.app/terms";
    process.env.EXPO_PUBLIC_PRIVACY_URL = "https://himu.app/privacy";
    const screen = await render(<LoginScreen />);

    const terms = screen.getByRole("link", { name: "Términos" });
    const privacy = screen.getByRole("link", { name: "Privacidad" });
    expect(RNStyleSheet.flatten(terms.props.style)).toEqual(
      expect.objectContaining({ minHeight: 44, minWidth: 44 }),
    );
    expect(RNStyleSheet.flatten(privacy.props.style)).toEqual(
      expect.objectContaining({ minHeight: 44, minWidth: 44 }),
    );
    // Legal copy is normal-sized text: use the opaque onSurface token in both themes.
    for (const theme of [darkTheme, lightTheme]) {
      expect(contrastRatio(theme.colors.onSurface, theme.colors.background))
        .toBeGreaterThanOrEqual(4.5);
    }
    const legalTextStyle = RNStyleSheet.flatten(screen.getByText("Términos").props.style);
    expect(legalTextStyle).toEqual(expect.objectContaining({
      color: darkTheme.colors.onSurface,
    }));
    expect(legalTextStyle.opacity).toBeUndefined();
    expect(screen.getAllByTestId("legal-separator")).toHaveLength(1);

    await act(async () => {
      fireEvent.press(terms);
    });
    await act(async () => {
      fireEvent.press(privacy);
    });
    await waitFor(() => {
      expect(Linking.openURL).toHaveBeenNthCalledWith(1, "https://himu.app/terms");
      expect(Linking.openURL).toHaveBeenNthCalledWith(2, "https://himu.app/privacy");
    });
  });

  it("does not render a separator for one valid legal destination", async () => {
    process.env.EXPO_PUBLIC_TERMS_URL = "http://himu.app/terms";
    process.env.EXPO_PUBLIC_PRIVACY_URL = "https://himu.app/privacy";
    const screen = await render(<LoginScreen />);

    expect(screen.queryByRole("link", { name: "Términos" })).toBeNull();
    expect(screen.getByRole("link", { name: "Privacidad" })).toBeTruthy();
    expect(screen.queryByTestId("legal-separator")).toBeNull();
  });

  it("shows the generic error toast when a legal destination cannot open", async () => {
    process.env.EXPO_PUBLIC_TERMS_URL = "https://himu.app/terms";
    jest.mocked(Linking.openURL).mockRejectedValueOnce(new Error("unavailable"));
    const screen = await render(<LoginScreen />);

    await act(async () => {
      fireEvent.press(screen.getByRole("link", { name: "Términos" }));
    });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        "Algo salió mal. Inténtalo de nuevo.",
      );
    });
  });
});
