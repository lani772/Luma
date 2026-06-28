import React from "react";
import { StyleSheet, TouchableOpacity, View, ViewStyle } from "react-native";
import { C } from "@/constants/colors";

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  borderColor?: string;
  noPad?: boolean;
}

export default function GlassCard({ children, style, onPress, borderColor, noPad }: GlassCardProps) {
  const s = [
    styles.card,
    borderColor ? { borderColor } : {},
    noPad ? { padding: 0 } : {},
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={s}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={s}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.b0,
    padding: 16,
    overflow: "hidden",
  },
});
