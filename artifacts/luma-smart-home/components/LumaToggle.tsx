import * as Haptics from "expo-haptics";
import React, { useEffect, useRef } from "react";
import { Animated, Platform, Pressable, StyleSheet } from "react-native";
import { C } from "@/constants/colors";

interface LumaToggleProps {
  value: boolean;
  onToggle: (next: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md";
}

export default function LumaToggle({ value, onToggle, disabled, size = "md" }: LumaToggleProps) {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: value ? 1 : 0,
      useNativeDriver: false,
      speed: 20,
      bounciness: 8,
    }).start();
  }, [value, anim]);

  const w = size === "sm" ? 40 : 52;
  const h = size === "sm" ? 22 : 28;
  const r = size === "sm" ? 16 : 20;
  const pad = 3;

  const bgColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [C.elevated, C.accent],
  });

  const thumbLeft = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [pad, w - r - pad],
  });

  function handlePress() {
    if (disabled) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onToggle(!value);
  }

  return (
    <Pressable onPress={handlePress} disabled={disabled}>
      <Animated.View style={[styles.track, { width: w, height: h, backgroundColor: bgColor, opacity: disabled ? 0.4 : 1 }]}>
        <Animated.View style={[styles.thumb, { width: r, height: r, left: thumbLeft, top: pad }]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    borderRadius: 99,
    position: "relative",
  },
  thumb: {
    position: "absolute",
    borderRadius: 99,
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
});
