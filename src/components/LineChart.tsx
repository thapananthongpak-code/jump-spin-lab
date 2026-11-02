import { useState } from 'react';
import { LayoutChangeEvent, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { colors } from '@/theme/theme';

interface Props {
  values: number[];
  height?: number;
  color?: string;
  /** fixed y-range (e.g. 0..2 g); defaults to the data range */
  min?: number;
  max?: number;
  guides?: { y: number; color: string }[];
}

export function LineChart({ values, height = 140, color = colors.accent, min, max, guides = [] }: Props) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const pad = 8;

  const lo = min ?? Math.min(...values, 0);
  const hi = max ?? Math.max(...values, lo + 1);
  const span = hi - lo || 1;
  const x = (i: number) =>
    values.length <= 1 ? width / 2 : pad + (i * (width - 2 * pad)) / (values.length - 1);
  const y = (v: number) => height - pad - ((v - lo) / span) * (height - 2 * pad);

  return (
    <View onLayout={onLayout} style={{ height }}>
      {width > 0 && values.length > 0 ? (
        <Svg width={width} height={height}>
          {guides.map((g, i) => (
            <Line
              key={i}
              x1={0}
              x2={width}
              y1={y(g.y)}
              y2={y(g.y)}
              stroke={g.color}
              strokeWidth={1}
              strokeDasharray="4 4"
            />
          ))}
          <Polyline
            points={values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
            fill="none"
            stroke={color}
            strokeWidth={2}
          />
          {values.length <= 40 &&
            values.map((v, i) => <Circle key={i} cx={x(i)} cy={y(v)} r={3} fill={color} />)}
        </Svg>
      ) : null}
    </View>
  );
}
