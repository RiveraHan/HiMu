import { render } from "@testing-library/react-native";
import { VibeAreaChart } from "../VibeAreaChart";
import i18n from "@/src/i18n";

const data = [
  { weekday: "mon", date: "2026-07-20", minutes: 0, isToday: false },
  { weekday: "tue", date: "2026-07-21", minutes: 15, isToday: true },
] as const;

test.each([
  ["en", "Weekly listening time chart. MON: 0 minutes. TUE: 15 minutes."],
  ["es", "Gráfico de tiempo de escucha semanal. LUN: 0 minutos. MAR: 15 minutos."],
] as const)("announces every displayed weekday and duration in %s", async (language, summary) => {
  await i18n.changeLanguage(language);
  const screen = await render(
    <VibeAreaChart data={[...data]} />,
  );

  expect(screen.getByRole("image", { name: summary })).toBeTruthy();
});

test("keeps localized visible chart labels", async () => {
  await i18n.changeLanguage("es");
  const screen = await render(<VibeAreaChart data={[...data]} />);

  for (const label of ["LUN", "MAR", "ALTO", "MEDIO", "BAJO"]) {
    expect(screen.getByText(label)).toBeTruthy();
  }
});
