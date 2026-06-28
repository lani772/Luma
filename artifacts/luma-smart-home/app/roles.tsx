import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "@/constants/colors";
import { ALL_PERMS, ROLES_DATA } from "@/data/luma-data";

export default function RolesScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={22} color={C.sec} />
        </TouchableOpacity>
        <Text style={styles.title}>Role Manager</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>Permission Matrix</Text>

        {/* Matrix table */}
        <View style={styles.matrixCard}>
          {/* Header */}
          <View style={styles.matrixHeader}>
            <Text style={styles.matrixHeaderPerm}>Permission</Text>
            {ROLES_DATA.map(r => (
              <Text key={r.id} style={[styles.matrixHeaderRole, { color: r.color }]}>{r.name}</Text>
            ))}
          </View>
          {/* Rows */}
          {ALL_PERMS.map((p, i) => (
            <View key={p} style={[styles.matrixRow, i % 2 === 0 && { backgroundColor: C.bg + "88" }]}>
              <Text style={styles.matrixPerm}>{p}</Text>
              {ROLES_DATA.map(r => (
                <View key={r.id} style={styles.matrixCell}>
                  {r.perms.includes(p)
                    ? <Feather name="check" size={14} color={C.on} />
                    : <Text style={styles.matrixDash}>—</Text>
                  }
                </View>
              ))}
            </View>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Role Summary</Text>

        {ROLES_DATA.map(r => (
          <View key={r.id} style={[styles.roleCard, { borderColor: r.color + "25" }]}>
            <View style={styles.roleHeader}>
              <View style={[styles.roleIcon, { backgroundColor: r.color + "18", borderColor: r.color + "30" }]}>
                <Feather name="shield" size={18} color={r.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.roleName, { color: r.color }]}>{r.name}</Text>
                <Text style={styles.roleCount}>{r.count} user{r.count !== 1 ? "s" : ""} · {r.perms.length} permissions</Text>
              </View>
            </View>
            <View style={styles.permTags}>
              {r.perms.map(p => (
                <View key={p} style={[styles.permTag, { backgroundColor: r.color + "14" }]}>
                  <Text style={[styles.permTagText, { color: r.color }]}>{p}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  topBar: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.b0 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 50 },
  sectionLabel: { fontSize: 11, fontWeight: "700" as const, color: C.sec, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10, fontFamily: "Inter_600SemiBold" },
  matrixCard: { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.b0, marginBottom: 20, overflow: "hidden" },
  matrixHeader: { flexDirection: "row", padding: 10, borderBottomWidth: 1, borderBottomColor: C.b0 },
  matrixHeaderPerm: { flex: 2, fontSize: 9, color: C.mute, fontWeight: "700" as const, letterSpacing: 1, textTransform: "uppercase", fontFamily: "Inter_600SemiBold" },
  matrixHeaderRole: { flex: 1, fontSize: 10, fontWeight: "700" as const, textAlign: "center", fontFamily: "Inter_700Bold" },
  matrixRow: { flexDirection: "row", paddingVertical: 8, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: C.b0 },
  matrixPerm: { flex: 2, fontSize: 11, color: C.sec, fontFamily: "Inter_400Regular" },
  matrixCell: { flex: 1, alignItems: "center", justifyContent: "center" },
  matrixDash: { fontSize: 13, color: C.mute },
  roleCard: { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 10, gap: 12 },
  roleHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  roleIcon: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  roleName: { fontSize: 16, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  roleCount: { fontSize: 11, color: C.mute, fontFamily: "Inter_400Regular" },
  permTags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  permTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  permTagText: { fontSize: 10, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
});
