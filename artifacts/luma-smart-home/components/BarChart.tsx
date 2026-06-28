import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { C } from "@/constants/colors";

interface BarChartProps {
  data: { label: string; value: number }[];
  color: string;
  height?: number;
}

export default function BarChart({ data, color, height = 120 }: BarChartProps) {
  const max = Math.max(...data.map(d => d.value), 1);

  return (
    <View style={[styles.container, { height: height + 24 }]}>
      <View style={[styles.barsRow, { height }]}>
        {data.map((d, i) => {
          const barH = Math.max((d.value / max) * height, 4);
          return (
            <View key={i} style={styles.barCol}>
              <View style={[styles.barFill, { height: barH, backgroundColor: color }]} />
            </View>
          );
        })}
      </View>
      <View style={styles.labelsRow}>
        {data.map((d, i) => (
          <Text key={i} style={styles.label}>{d.label}</Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  barsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
  },
  barCol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  barFill: {
    width: "70%",
    borderRadius: 4,
    opacity: 0.9,
  },
  labelsRow: {
    flexDirection: "row",
    marginTop: 6,
  },
  label: {
    flex: 1,
    textAlign: "center",
    fontSize: 9,
    color: C.mute,
    fontFamily: "Inter_400Regular",
  },
});
