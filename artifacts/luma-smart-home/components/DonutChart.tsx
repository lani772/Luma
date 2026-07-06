import React from "react";
import { View } from "react-native";
import Svg, { Circle, G } from "react-native-svg";

interface DonutChartProps {
  data: { value: number; color: string }[];
  size?: number;
  strokeWidth?: number;
}

export default function DonutChart({ data, size = 140, strokeWidth = 18 }: DonutChartProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = data.reduce((a, d) => a + d.value, 0) || 1;

  let offsetAcc = 0;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          {data.map((d, i) => {
            const pct = d.value / total;
            const dash = pct * circumference;
            const gap = circumference - dash;
            const strokeDashoffset = -offsetAcc * circumference;
            offsetAcc += pct;
            return (
              <Circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={d.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="butt"
                fill="none"
              />
            );
          })}
        </G>
      </Svg>
    </View>
  );
}
