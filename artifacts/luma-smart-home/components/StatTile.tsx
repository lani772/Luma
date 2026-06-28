import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { C } from "@/constants/colors";

interface StatTileProps {
  label: string;
  value: string;
  sub?: string;
  color: string;
}

export default function StatTile({ label, value, sub, color }: StatTileProps) {
  return (
    <View style={styles.card}>
      <Text style={[styles.label]}>{label.toUpperCase()}</Text>
      <Text style={[styles.value, { color }]}>{value}</Text>
      {sub && <Text style={styles.sub}>{sub}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.b0,
    padding: 14,
  },
  label: {
    fontSize: 9,
    fontWeight: "700" as const,
    color: C.mute,
    letterSpacing: 1,
    marginBottom: 6,
    fontFamily: "Inter_600SemiBold",
  },
  value: {
    fontSize: 22,
    fontWeight: "700" as const,
    letterSpacing: -0.5,
    fontFamily: "Inter_700Bold",
  },
  sub: {
    fontSize: 11,
    color: C.mute,
    marginTop: 3,
    fontFamily: "Inter_400Regular",
  },
});
