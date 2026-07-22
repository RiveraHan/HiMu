import { render } from "@testing-library/react-native";
import { VibeAreaChart } from "../VibeAreaChart";
import i18n from "@/src/i18n";

test("localizes weekday and chart accessibility labels", async () => {
  await i18n.changeLanguage("es");
  const screen = await render(
    <VibeAreaChart
      data={[
        { weekday: "mon", date: "2026-07-20", minutes: 0, isToday: false },
        { weekday: "tue", date: "2026-07-21", minutes: 15, isToday: true },
      ]}
    />,
  );

  expect(screen.getByText("LUN")).toBeTruthy();
  expect(screen.getByText("MAR")).toBeTruthy();
  expect(screen.getByLabelText("Gráfico de tiempo de escucha semanal")).toBeTruthy();
  expect(screen.getByText("ALTO")).toBeTruthy();
  expect(screen.getByText("MEDIO")).toBeTruthy();
  expect(screen.getByText("BAJO")).toBeTruthy();
});
