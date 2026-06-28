import React from "react";
import { StyleSheet, View } from "react-native";
import { C } from "@/constants/colors";

interface ProgressBarProps {
  value: number;
  max?: number;
  color: string;
  height?: number;
}

export default function ProgressBar({ value, max = 100, color, height = 4 }: ProgressBarProps) {
  const pct = Math.min(Math.max((value / max) * 100, 0), 100);
  return (
    <View style={[styles.track, { height }]}>
      <View style={[styles.fill, { width: `${pct}%` as any, backgroundColor: color, height }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: C.elevated,
    borderRadius: 99,
    overflow: "hidden",
  },
  fill: {
    borderRadius: 99,
  },
});
