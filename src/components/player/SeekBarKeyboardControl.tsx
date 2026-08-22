type Props = {
  label: string;
  valueText: string;
  positionSec: number;
  durationSec: number;
  onSeek: (seconds: number) => void;
};

/** Native accessibility remains on the parent adjustable View. */
export function SeekBarKeyboardControl(_props: Props) {
  return null;
}
