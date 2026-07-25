import { fireEvent, render } from "@testing-library/react-native";
import { SeekBar } from "../SeekBar";
import i18n from "@/src/i18n";

const renderSeekBar = async (positionSec: number, durationSec: number) => {
  const onSeek = jest.fn();
  const screen = await render(
    <SeekBar
      positionSec={positionSec}
      durationSec={durationSec}
      onSeek={onSeek}
    />,
  );
  return { control: screen.getByRole("adjustable"), onSeek };
};

const adjust = (
  control: ReturnType<Awaited<ReturnType<typeof render>>["getByRole"]>,
  actionName: "increment" | "decrement",
) => fireEvent(control, "accessibilityAction", { nativeEvent: { actionName } });

test("increments playback by ten seconds", async () => {
  const { control, onSeek } = await renderSeekBar(30, 100);

  adjust(control, "increment");

  expect(onSeek).toHaveBeenCalledWith(40);
});

test("decrements playback by ten seconds", async () => {
  const { control, onSeek } = await renderSeekBar(30, 100);

  adjust(control, "decrement");

  expect(onSeek).toHaveBeenCalledWith(20);
});

test("clamps accessibility decrement to the start", async () => {
  const { control, onSeek } = await renderSeekBar(4, 100);

  adjust(control, "decrement");

  expect(onSeek).toHaveBeenCalledWith(0);
});

test("clamps accessibility increment to the duration", async () => {
  const { control, onSeek } = await renderSeekBar(96, 100);

  adjust(control, "increment");

  expect(onSeek).toHaveBeenCalledWith(100);
});

test("localizes the numeric playback value without changing timestamp format", async () => {
  await i18n.changeLanguage("es");
  const { control } = await renderSeekBar(30, 100);

  expect(control.props.accessibilityValue).toEqual(
    expect.objectContaining({ text: "0:30 de 1:40" }),
  );
});

test("advertises localized ten-second adjustment actions", async () => {
  await i18n.changeLanguage("es");
  const { control } = await renderSeekBar(30, 100);

  expect(control.props.accessibilityActions).toEqual([
    { name: "increment", label: "Avanzar 10 segundos" },
    { name: "decrement", label: "Retroceder 10 segundos" },
  ]);
});
