import Svg, { Defs, FeDropShadow, Filter, Path } from "react-native-svg";

interface Props {
  size?: number;
  color?: string;
}

export function Logo({ size = 96, color = "#818CF8" }: Props) {
  const PADDING = 30;
  const VB = 200 + PADDING * 2;
  const renderSize = (size * VB) / 200;

  return (
    <Svg
      width={renderSize}
      height={renderSize}
      viewBox={`-${PADDING} -${PADDING} ${VB} ${VB}`}
      fill="none"
    >
      <Defs>
        <Filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <FeDropShadow
            dx="0"
            dy="0"
            stdDeviation="8"
            floodColor={color}
            floodOpacity="0.5"
          />
        </Filter>
      </Defs>
      <Path
        filter="url(#glow)"
        d="M55 50V150M145 50V150M55 100H145M85 150V100C85 83.4315 98.4315 70 115 70C131.569 70 145 83.4315 145 100V150"
        stroke={color}
        strokeWidth={12}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
