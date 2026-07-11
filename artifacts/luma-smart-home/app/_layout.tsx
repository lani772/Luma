import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { Platform, StatusBar, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { InstallBanner } from "@/components/InstallBanner";
import { LumaProvider } from "@/context/LumaContext";
import { C } from "@/constants/colors";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function registerSW() {
  if (Platform.OS !== "web") return;
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

function injectPWAMeta() {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  const head = document.head;

  // Manifest link
  if (!document.querySelector('link[rel="manifest"]')) {
    const ml = document.createElement("link");
    ml.rel = "manifest";
    ml.href = "/manifest.json";
    head.appendChild(ml);
  }

  // Apple mobile web app meta tags
  const setMeta = (name: string, content: string) => {
    if (document.querySelector(`meta[name="${name}"]`)) return;
    const m = document.createElement("meta");
    m.name = name;
    m.content = content;
    head.appendChild(m);
  };
  setMeta("mobile-web-app-capable", "yes");
  setMeta("apple-mobile-web-app-capable", "yes");
  setMeta("apple-mobile-web-app-status-bar-style", "black-translucent");
  setMeta("apple-mobile-web-app-title", "LUMA");
  setMeta("theme-color", "#2563EB");
  setMeta("application-name", "LUMA Smart Home");
  setMeta("msapplication-TileColor", "#0A0E1A");

  // Apple touch icon
  if (!document.querySelector('link[rel="apple-touch-icon"]')) {
    const ai = document.createElement("link");
    ai.rel = "apple-touch-icon";
    ai.href = "/assets/images/icon.png";
    head.appendChild(ai);
  }
}

function RootLayoutNav() {
  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="device/[id]" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen name="mqtt" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen name="health" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen name="scenes" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen name="rooms" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen name="notifications" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen name="activity" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen name="access" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen name="roles" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen name="settings" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen name="microcontrollers" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen name="microcontroller-register" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen name="microcontroller-workspace" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen name="mc-device-register" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen name="mc-device" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen name="lamps-manager" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen name="lamp-add" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen name="device-register" options={{ headerShown: false, animation: "slide_from_right" }} />
      </Stack>
      <InstallBanner />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    injectPWAMeta();
    registerSW();
  }, []);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <LumaProvider>
                <RootLayoutNav />
              </LumaProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
