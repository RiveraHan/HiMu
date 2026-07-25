import { fireEvent, render } from "@testing-library/react-native";

import LoginScreen from "@/app/(auth)/login";
import i18n from "@/src/i18n";

const mockToastInfo = jest.fn();

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
  useToast: () => ({ error: jest.fn(), info: mockToastInfo }),
}));

describe("Login translations", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("es");
    mockToastInfo.mockClear();
  });

  it("renders the authentication entry points in Spanish", async () => {
    const screen = await render(<LoginScreen />);

    expect(screen.getByText("Bienvenido a HiMu")).toBeTruthy();
    expect(screen.getByText("Tu música, presentada por DJs con IA.")).toBeTruthy();
    expect(screen.getByText("Continuar con Spotify")).toBeTruthy();
    expect(screen.getByText("Continuar con Google")).toBeTruthy();
    expect(screen.getByText("Iniciar sesión con correo")).toBeTruthy();
    expect(screen.getByText("O")).toBeTruthy();
    expect(screen.getByText(/¿No tienes una cuenta\?/)).toBeTruthy();
    expect(screen.getByText("Regístrate")).toBeTruthy();
    expect(screen.getByText("Términos")).toBeTruthy();
    expect(screen.getByText("Privacidad")).toBeTruthy();

    fireEvent.press(screen.getByText("Continuar con Spotify"));
    expect(mockToastInfo).toHaveBeenCalledWith(
      "Próximamente",
      "Esta función estará disponible pronto.",
    );
  });
});
