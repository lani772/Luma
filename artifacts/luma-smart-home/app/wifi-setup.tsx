import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "@/constants/colors";
import { useConnectivity } from "@/context/ConnectivityContext";

// ─── Steps ────────────────────────────────────────────────────────────────────

interface WizardStep {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  detail: string;
  docRef: string;
}

const STEPS: WizardStep[] = [
  {
    id: "power_on",
    icon: "power",
    title: "Power On ESP32",
    subtitle: "Start your LUMA device",
    detail: "Press and hold the power button on your ESP32 device for 3 seconds until the LED blinks blue. The device will enter pairing mode automatically.",
    docRef: "§1.5 Step 1",
  },
  {
    id: "bt_pairing",
    icon: "bluetooth",
    title: "Bluetooth Pairing",
    subtitle: "Secure device identification",
    detail: "The engine pairs your phone with the ESP32 over Bluetooth. This is a one-time setup — credentials will be transferred securely without exposing your Wi-Fi password.",
    docRef: "§1.5 Step 2",
  },
  {
    id: "credential_transfer",
    icon: "shield",
    title: "Credential Transfer",
    subtitle: "Sending hotspot credentials",
    detail: "Your hotspot SSID and password are being transferred securely to the ESP32. These credentials are stored on-device and will never be transmitted in plain text.",
    docRef: "§1.5 Step 3",
  },
  {
    id: "esp32_connecting",
    icon: "wifi",
    title: "ESP32 Connecting",
    subtitle: "Device joining the network",
    detail: "The ESP32 is using the stored credentials to connect to your hotspot or Wi-Fi network. It will retry automatically with exponential backoff if the first attempt fails.",
    docRef: "§1.5 Step 4–5",
  },
  {
    id: "discovering",
    icon: "search",
    title: "Device Discovery",
    subtitle: "Locating ESP32 on network",
    detail: "The engine is scanning for your ESP32 using mDNS, UDP broadcast, and device heartbeat signals. The current IP address will be recorded automatically.",
    docRef: "§1.5 Step 6",
  },
  {
    id: "complete",
    icon: "check-circle",
    title: "Setup Complete",
    subtitle: "Device registered and ready",
    detail: "Your ESP32 is now registered in the device registry. The engine will automatically rediscover it and restore communication whenever it comes online — no manual reconnect needed.",
    docRef: "§1.5 Step 7",
  },
];

const STEP_COLORS = [C.sec, C.purple, C.gold, C.teal, C.indigo, C.on];

// ─── Pulsing animation ────────────────────────────────────────────────────────

function Spinner({ color }: { color: string }) {
  const rotate = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.timing(rotate, { toValue: 1, duration: 1200, useNativeDriver: true })).start();
  }, [rotate]);
  return (
    <Animated.View style={{ transform: [{ rotate: rotate.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] }}>
      <Feather name="loader" size={22} color={color} />
    </Animated.View>
  );
}

function RippleRing({ color, delay }: { color: string; delay: number }) {
  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0.8)).current;
  useEffect(() => {
    setTimeout(() => {
      Animated.loop(
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.6, duration: 1600, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 1600, useNativeDriver: true }),
        ])
      ).start();
    }, delay);
  }, [delay, opacity, scale]);
  return (
    <Animated.View style={{
      position: "absolute",
      width: 80, height: 80, borderRadius: 40,
      borderWidth: 2, borderColor: color,
      transform: [{ scale }], opacity,
    }} />
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function WiFiSetupScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { provisionDevice, provisioning, cancelProvisioning, hotspot, toggleHotspot, registeredDevices } = useConnectivity();

  const [currentStep, setCurrentStep] = useState(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [autoAdvanced, setAutoAdvanced] = useState(false);

  const progressAnim = useRef(new Animated.Value(0)).current;

  // Auto-advance from provisioning state
  useEffect(() => {
    const provStepMap: Record<string, number> = {
      bt_pairing: 1,
      credential_transfer: 2,
      esp32_connecting: 3,
      discovering: 4,
      complete: 5,
      failed: currentStep,
    };
    const mapped = provStepMap[provisioning.step];
    if (mapped !== undefined && mapped !== currentStep) {
      setCurrentStep(mapped);
      if (provisioning.step === "complete") {
        setDone(true);
        setRunning(false);
      }
    }
  }, [provisioning.step, currentStep]);

  // Animate progress bar
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: (currentStep / (STEPS.length - 1)) * 100,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [currentStep, progressAnim]);

  function startSetup() {
    if (running) return;
    setRunning(true);
    setDone(false);
    setCurrentStep(1);
    setAutoAdvanced(false);
    provisionDevice();
  }

  function nextStep() {
    if (currentStep < STEPS.length - 1) setCurrentStep(s => s + 1);
    else setDone(true);
  }

  function resetWizard() {
    cancelProvisioning();
    setCurrentStep(0);
    setRunning(false);
    setDone(false);
    setAutoAdvanced(false);
  }

  const step = STEPS[currentStep];
  const stepColor = STEP_COLORS[currentStep];
  const isAutoStep = running && currentStep > 0 && currentStep < 5;

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={22} color={C.sec} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Device Setup</Text>
          <Text style={styles.subtitle}>First-time WiFi provisioning wizard</Text>
        </View>
        {running && (
          <TouchableOpacity onPress={resetWizard} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, {
            width: progressAnim.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }),
            backgroundColor: stepColor,
          }]} />
        </View>
        <Text style={styles.progressLabel}>{currentStep + 1} / {STEPS.length}</Text>
      </View>

      {/* Step dots */}
      <View style={styles.dotsRow}>
        {STEPS.map((s, i) => (
          <View key={s.id} style={[
            styles.dot,
            i < currentStep && styles.dotDone,
            i === currentStep && { backgroundColor: stepColor, width: 20 },
            i > currentStep && styles.dotPending,
          ]} />
        ))}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Main step card */}
        <View style={[styles.stepCard, { borderColor: stepColor + "30" }]}>
          {/* Icon area */}
          <View style={styles.iconArea}>
            <RippleRing color={stepColor} delay={0} />
            <RippleRing color={stepColor} delay={500} />
            <View style={[styles.iconCircle, { backgroundColor: stepColor + "20", borderColor: stepColor + "50" }]}>
              {isAutoStep ? (
                <Spinner color={stepColor} />
              ) : done ? (
                <Feather name="check-circle" size={32} color={C.on} />
              ) : (
                <Feather name={step.icon as any} size={32} color={stepColor} />
              )}
            </View>
          </View>

          {/* Title */}
          <Text style={styles.stepTitle}>{done ? "All Done!" : step.title}</Text>
          <Text style={[styles.stepSubtitle, { color: stepColor }]}>{done ? "Your ESP32 is ready" : step.subtitle}</Text>
          <View style={[styles.docRefPill, { backgroundColor: stepColor + "15", borderColor: stepColor + "30" }]}>
            <Text style={[styles.docRefText, { color: stepColor }]}>{step.docRef}</Text>
          </View>

          {/* Detail text */}
          <Text style={styles.stepDetail}>
            {done
              ? "Device setup is complete. The LUMA engine will automatically reconnect to this device whenever it's online — no manual reconnect needed."
              : step.detail}
          </Text>

          {/* Auto-step status */}
          {isAutoStep && (
            <View style={[styles.autoStatusRow, { backgroundColor: stepColor + "12", borderColor: stepColor + "25" }]}>
              <Spinner color={stepColor} />
              <Text style={[styles.autoStatusText, { color: stepColor }]}>Automatic — please wait…</Text>
            </View>
          )}

          {/* Current provisioning progress */}
          {running && provisioning.step !== "idle" && provisioning.step !== "complete" && provisioning.step !== "failed" && (
            <View style={styles.provProgress}>
              <View style={styles.provProgressTrack}>
                <Animated.View style={[styles.provProgressFill, {
                  width: `${provisioning.progress}%` as any,
                  backgroundColor: stepColor,
                }]} />
              </View>
              <Text style={[styles.provProgressPct, { color: stepColor }]}>{provisioning.progress}%</Text>
            </View>
          )}
        </View>

        {/* Hotspot status reminder */}
        {currentStep <= 1 && (
          <View style={[styles.infoCard, { borderColor: C.purple + "25" }]}>
            <Feather name="radio" size={16} color={C.purple} />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoCardTitle}>Mobile Hotspot</Text>
              <Text style={styles.infoCardBody}>
                {hotspot.active
                  ? `Active · SSID: ${hotspot.ssid}`
                  : "Enable your hotspot so the ESP32 can connect automatically after provisioning."}
              </Text>
            </View>
            {!hotspot.active && (
              <TouchableOpacity
                style={[styles.infoBtn, { backgroundColor: C.purple + "20", borderColor: C.purple + "40" }]}
                onPress={toggleHotspot}
              >
                <Text style={[styles.infoBtnText, { color: C.purple }]}>Enable</Text>
              </TouchableOpacity>
            )}
            {hotspot.active && <Feather name="check-circle" size={16} color={C.on} />}
          </View>
        )}

        {/* Device found */}
        {registeredDevices.length > 0 && currentStep >= 4 && (
          <View style={styles.foundCard}>
            <View style={styles.foundHeader}>
              <Feather name="cpu" size={16} color={C.on} />
              <Text style={styles.foundTitle}>Devices Found</Text>
            </View>
            {registeredDevices.map(dev => (
              <View key={dev.id} style={styles.foundItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.foundDevId}>{dev.id}</Text>
                  <Text style={styles.foundDevHost}>{dev.hostname}</Text>
                </View>
                <View style={styles.foundDevRight}>
                  <Text style={styles.foundDevIp}>{dev.ip}</Text>
                  <View style={[styles.discoveryBadge, { backgroundColor: C.teal + "18", borderColor: C.teal + "35" }]}>
                    <Text style={[styles.discoveryBadgeText, { color: C.teal }]}>{dev.discoveryMethod}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Workflow reference */}
        <View style={styles.workflowCard}>
          <Text style={styles.workflowTitle}>Provisioning Workflow (§1.5)</Text>
          {STEPS.map((s, i) => (
            <View key={s.id} style={styles.workflowStep}>
              <View style={[styles.workflowDot, {
                backgroundColor: i < currentStep ? C.on : i === currentStep ? stepColor : C.elevated,
                borderColor: i === currentStep ? stepColor : "transparent",
              }]}>
                {i < currentStep && <Feather name="check" size={9} color="#fff" />}
                {i === currentStep && <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: "#fff" }} />}
              </View>
              {i < STEPS.length - 1 && (
                <View style={[styles.workflowLine, { backgroundColor: i < currentStep ? C.on + "40" : C.elevated }]} />
              )}
              <Text style={[styles.workflowStepText, {
                color: i < currentStep ? C.on : i === currentStep ? C.txt : C.mute,
                fontFamily: i === currentStep ? "Inter_700Bold" : "Inter_400Regular",
              }]}>{s.title}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        {currentStep === 0 && !running && (
          <TouchableOpacity style={[styles.ctaBtn, { backgroundColor: C.purple }]} onPress={startSetup}>
            <Feather name="bluetooth" size={18} color="#fff" />
            <Text style={styles.ctaBtnText}>Start Setup</Text>
          </TouchableOpacity>
        )}
        {running && !isAutoStep && provisioning.step !== "complete" && (
          <TouchableOpacity style={[styles.ctaBtn, { backgroundColor: stepColor }]} onPress={nextStep}>
            <Text style={styles.ctaBtnText}>Next Step</Text>
            <Feather name="arrow-right" size={18} color="#fff" />
          </TouchableOpacity>
        )}
        {(done || provisioning.step === "complete") && (
          <View style={styles.doneRow}>
            <TouchableOpacity style={[styles.ctaBtn, { backgroundColor: C.on, flex: 1 }]} onPress={() => router.replace("/connectivity")}>
              <Feather name="home" size={18} color="#fff" />
              <Text style={styles.ctaBtnText}>Go to Connectivity</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={resetWizard}>
              <Text style={styles.secondaryBtnText}>Setup Another</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: C.b0 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 11, color: C.mute, fontFamily: "Inter_400Regular", marginTop: 1 },
  cancelBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: C.off + "18", borderWidth: 1, borderColor: C.off + "35" },
  cancelText: { fontSize: 12, color: C.off, fontFamily: "Inter_600SemiBold" },
  progressContainer: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  progressTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: C.elevated, overflow: "hidden" },
  progressFill: { height: 4, borderRadius: 2 },
  progressLabel: { fontSize: 11, color: C.mute, fontFamily: "Inter_600SemiBold", minWidth: 32 },
  dotsRow: { flexDirection: "row", gap: 6, paddingHorizontal: 16, paddingBottom: 14, alignItems: "center" },
  dot: { height: 6, borderRadius: 3, width: 6 },
  dotDone: { backgroundColor: C.on },
  dotPending: { backgroundColor: C.elevated },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 30, gap: 14 },
  stepCard: { backgroundColor: C.surface, borderRadius: 24, borderWidth: 1, padding: 24, alignItems: "center" },
  iconArea: { width: 100, height: 100, alignItems: "center", justifyContent: "center", marginBottom: 24 },
  iconCircle: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  stepTitle: { fontSize: 22, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold", textAlign: "center", marginBottom: 4 },
  stepSubtitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", textAlign: "center", marginBottom: 10 },
  docRefPill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 99, borderWidth: 1, marginBottom: 16 },
  docRefText: { fontSize: 11, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  stepDetail: { fontSize: 14, color: C.sec, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
  autoStatusRow: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, marginTop: 18 },
  autoStatusText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  provProgress: { flexDirection: "row", alignItems: "center", gap: 10, width: "100%", marginTop: 14 },
  provProgressTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: C.elevated, overflow: "hidden" },
  provProgressFill: { height: 6, borderRadius: 3 },
  provProgressPct: { fontSize: 12, fontWeight: "700" as const, fontFamily: "Inter_700Bold", minWidth: 36 },
  infoCard: { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  infoCardTitle: { fontSize: 13, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  infoCardBody: { fontSize: 11, color: C.sec, fontFamily: "Inter_400Regular", marginTop: 2 },
  infoBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  infoBtnText: { fontSize: 11, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  foundCard: { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.on + "30", overflow: "hidden" },
  foundHeader: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderBottomWidth: 1, borderBottomColor: C.on + "20", backgroundColor: C.on + "08" },
  foundTitle: { fontSize: 13, fontWeight: "700" as const, color: C.on, fontFamily: "Inter_700Bold" },
  foundItem: { flexDirection: "row", alignItems: "center", padding: 12, borderBottomWidth: 1, borderBottomColor: C.b0, gap: 12 },
  foundDevId: { fontSize: 12, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  foundDevHost: { fontSize: 10, color: C.mute, fontFamily: "Inter_400Regular", marginTop: 1 },
  foundDevRight: { alignItems: "flex-end", gap: 4 },
  foundDevIp: { fontSize: 11, color: C.teal, fontFamily: "Inter_600SemiBold" },
  discoveryBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  discoveryBadgeText: { fontSize: 9, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  workflowCard: { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.b0, padding: 16 },
  workflowTitle: { fontSize: 12, fontWeight: "700" as const, color: C.mute, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 16, fontFamily: "Inter_600SemiBold" },
  workflowStep: { flexDirection: "row", alignItems: "flex-start", gap: 10, position: "relative" },
  workflowDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: "center", justifyContent: "center", zIndex: 1, marginTop: 2 },
  workflowLine: { position: "absolute", left: 8.5, top: 18, bottom: -20, width: 1, height: 24 },
  workflowStepText: { fontSize: 13, lineHeight: 26, flex: 1 },
  bottomBar: { backgroundColor: C.elevated, borderTopWidth: 1, borderTopColor: C.b0, paddingTop: 14, paddingHorizontal: 16 },
  ctaBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 24 },
  ctaBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  doneRow: { gap: 10 },
  secondaryBtn: { alignItems: "center", paddingVertical: 10 },
  secondaryBtnText: { fontSize: 13, color: C.mute, fontFamily: "Inter_400Regular" },
});
