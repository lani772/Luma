import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "@/constants/colors";
import { useLuma } from "@/context/LumaContext";
import { User, roleColor } from "@/data/luma-data";

const ROLES = ["Admin", "Manager", "Operator", "Viewer"] as const;
type Role = typeof ROLES[number];

const ROLE_COLORS: Record<Role, string> = { Admin: C.accent, Manager: C.on, Operator: C.purple, Viewer: C.gold };

export default function UsersScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { users, toggleUser, removeUser, addUser } = useLuma();
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<Role>("Operator");

  function handleAdd() {
    if (!newName.trim() || !newEmail.trim()) return;
    const inits = newName.trim().split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
    const colors = [C.teal, C.rose, "#22D3EE", "#A78BFA"];
    const col = colors[Math.floor(Math.random() * colors.length)];
    addUser({ name: newName.trim(), email: newEmail.trim(), role: newRole, status: "active", init: inits, color: col, lastLogin: "Just now" });
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNewName(""); setNewEmail(""); setNewRole("Operator"); setAddOpen(false);
  }

  function handleRemove(u: User) {
    if (u.role === "Admin") return;
    if (Platform.OS === "web") {
      removeUser(u.id);
      return;
    }
    Alert.alert("Remove User", `Remove ${u.name}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => removeUser(u.id) },
    ]);
  }

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Users</Text>
          <Text style={styles.sub}>{users.length} member{users.length !== 1 ? "s" : ""}</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setAddOpen(true)}>
          <Feather name="user-plus" size={16} color={C.accentL} />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {users.map(u => {
          const rc = ROLE_COLORS[u.role as Role] ?? C.sec;
          return (
            <View key={u.id} style={styles.userCard}>
              <View style={styles.userTop}>
                <View style={[styles.avatar, { backgroundColor: u.color + "25", borderColor: u.color + "50" }]}>
                  <Text style={[styles.avatarText, { color: u.color }]}>{u.init}</Text>
                </View>
                <View style={styles.userInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name}>{u.name}</Text>
                    <View style={[styles.rolePill, { backgroundColor: rc + "18", borderColor: rc + "40" }]}>
                      <Text style={[styles.roleText, { color: rc }]}>{u.role}</Text>
                    </View>
                  </View>
                  <Text style={styles.email}>{u.email}</Text>
                  <Text style={styles.lastLogin}>Last login: {u.lastLogin}</Text>
                </View>
              </View>
              <View style={styles.userActions}>
                <View style={[styles.statusPill, { backgroundColor: u.status === "active" ? C.on + "12" : C.mute + "12", borderColor: u.status === "active" ? C.on + "30" : C.b0 }]}>
                  <View style={[styles.statusDot, { backgroundColor: u.status === "active" ? C.on : C.mute }]} />
                  <Text style={[styles.statusText, { color: u.status === "active" ? C.on : C.mute }]}>{u.status}</Text>
                </View>
                <View style={styles.actionBtns}>
                  <TouchableOpacity style={styles.iconBtn} onPress={() => toggleUser(u.id)}>
                    <Feather name={u.status === "active" ? "user-check" : "user-x"} size={15} color={u.status === "active" ? C.on : C.mute} />
                  </TouchableOpacity>
                  {u.role !== "Admin" && (
                    <TouchableOpacity style={[styles.iconBtn, { borderColor: C.off + "30", backgroundColor: C.off + "10" }]} onPress={() => handleRemove(u)}>
                      <Feather name="trash-2" size={15} color={C.off} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Add User Modal */}
      <Modal visible={addOpen} transparent animationType="slide" onRequestClose={() => setAddOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setAddOpen(false)}>
          <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Add User</Text>

            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput style={styles.input} placeholder="e.g. Jane Smith" placeholderTextColor={C.mute} value={newName} onChangeText={setNewName} />

            <Text style={styles.inputLabel}>Email</Text>
            <TextInput style={styles.input} placeholder="jane@example.com" placeholderTextColor={C.mute} value={newEmail} onChangeText={setNewEmail} keyboardType="email-address" autoCapitalize="none" />

            <Text style={styles.inputLabel}>Role</Text>
            <View style={styles.roleRow}>
              {ROLES.map(r => (
                <TouchableOpacity
                  key={r}
                  onPress={() => setNewRole(r)}
                  style={[styles.roleBtn, newRole === r && { borderColor: ROLE_COLORS[r] + "60", backgroundColor: ROLE_COLORS[r] + "14" }]}
                >
                  <Text style={[styles.roleBtnText, newRole === r && { color: ROLE_COLORS[r] }]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={handleAdd}>
              <Text style={styles.submitText}>Add User</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setAddOpen(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 18, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.b0 },
  title: { fontSize: 24, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 11, color: C.mute, marginTop: 2, fontFamily: "Inter_400Regular" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: C.accent + "18", borderRadius: 12, borderWidth: 1, borderColor: C.accentL + "30" },
  addBtnText: { fontSize: 13, fontWeight: "700" as const, color: C.accentL, fontFamily: "Inter_700Bold" },
  scroll: { flex: 1 },
  content: { padding: 18, paddingBottom: 110 },
  userCard: { backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.b0, padding: 14, marginBottom: 10 },
  userTop: { flexDirection: "row", gap: 12, marginBottom: 10 },
  avatar: { width: 48, height: 48, borderRadius: 99, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 16, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  userInfo: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  name: { fontSize: 15, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  rolePill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, borderWidth: 1 },
  roleText: { fontSize: 10, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  email: { fontSize: 11, color: C.accentL, fontFamily: "Inter_400Regular", marginBottom: 2 },
  lastLogin: { fontSize: 10, color: C.mute, fontFamily: "Inter_400Regular" },
  userActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, borderWidth: 1 },
  statusDot: { width: 5, height: 5, borderRadius: 99 },
  statusText: { fontSize: 10, fontWeight: "700" as const, fontFamily: "Inter_700Bold", textTransform: "capitalize" },
  actionBtns: { flexDirection: "row", gap: 8 },
  iconBtn: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", justifyContent: "flex-end" },
  sheet: { backgroundColor: C.elevated, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: C.b0, padding: 20, paddingBottom: 40 },
  handle: { width: 40, height: 4, borderRadius: 99, backgroundColor: C.b0, alignSelf: "center", marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold", marginBottom: 18 },
  inputLabel: { fontSize: 10, color: C.mute, fontWeight: "700" as const, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, fontFamily: "Inter_600SemiBold" },
  input: { backgroundColor: C.bg, borderWidth: 1, borderColor: C.b0, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, color: C.txt, fontSize: 14, fontFamily: "Inter_400Regular", marginBottom: 14 },
  roleRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  roleBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: C.b0, alignItems: "center" },
  roleBtnText: { fontSize: 11, fontWeight: "700" as const, color: C.mute, fontFamily: "Inter_700Bold" },
  submitBtn: { backgroundColor: C.accent, borderRadius: 14, paddingVertical: 14, alignItems: "center", marginBottom: 10 },
  submitText: { color: "#fff", fontSize: 14, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  cancelBtn: { paddingVertical: 12, borderRadius: 14, backgroundColor: C.b1, borderWidth: 1, borderColor: C.b0, alignItems: "center" },
  cancelText: { color: C.mute, fontSize: 14, fontWeight: "700" as const, fontFamily: "Inter_600SemiBold" },
});
