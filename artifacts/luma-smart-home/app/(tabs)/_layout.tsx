import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { C } from "@/constants/colors";
import { useLuma } from "@/context/LumaContext";

function TabBarBackground() {
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: C.elevated, borderTopWidth: 1, borderTopColor: C.b0 }]} />;
}

function NotifBadge() {
  const { notifications } = useLuma();
  const unread = notifications.filter(n => !n.read && !n.archived).length;
  if (unread === 0) return null;
  return (
    <View style={styles.badge}>
      {/* empty red dot */}
    </View>
  );
}

export default function TabLayout() {
  const tabH = Platform.OS === "web" ? 84 : 65;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.accentL,
        tabBarInactiveTintColor: C.mute,
        tabBarStyle: {
          backgroundColor: C.elevated,
          borderTopWidth: 1,
          borderTopColor: C.b0,
          height: tabH,
          paddingBottom: Platform.OS === "web" ? 34 : 8,
          paddingTop: 8,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarBackground: () => <TabBarBackground />,
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: "Inter_600SemiBold",
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <Feather name="home" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="devices"
        options={{
          title: "Devices",
          tabBarIcon: ({ color }) => <Feather name="zap" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="energy"
        options={{
          title: "Energy",
          tabBarIcon: ({ color }) => <Feather name="bar-chart-2" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          title: "Users",
          tabBarIcon: ({ color }) => <Feather name="users" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: ({ color }) => <Feather name="grid" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    top: -1,
    right: -1,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.off,
    borderWidth: 1.5,
    borderColor: C.elevated,
  },
});
