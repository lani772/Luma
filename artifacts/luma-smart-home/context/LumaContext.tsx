import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  ActivityLog,
  AutomationRule,
  INITIAL_LAMPS,
  INITIAL_NOTIFICATIONS,
  INITIAL_SCENES,
  INITIAL_USERS,
  INITIAL_INVITES,
  Invite,
  LAMP_AUTOMATIONS,
  Lamp,
  LumaNotification,
  LumaRole,
  LumaUser,
  LUMA_INITIAL_USERS,
  PENDING_REQUESTS,
  PERMS_DEF,
  PendingRequest,
  SCENE_CONFIGS,
  Scene,
  Schedule,
  User,
  LAMP_ACTIVITY,
} from "@/data/luma-data";

interface LumaContextType {
  lamps: Lamp[];
  scenes: Scene[];
  users: User[];
  notifications: LumaNotification[];
  pendingRequests: PendingRequest[];
  approvedRequests: PendingRequest[];
  lampAutomations: Record<string, AutomationRule[]>;
  lampActivity: Record<string, ActivityLog[]>;
  updateLamp: (id: string, patch: Partial<Lamp>) => void;
  activateScene: (id: string) => void;
  toggleUser: (id: number) => void;
  removeUser: (id: number) => void;
  addUser: (user: Omit<User, "id">) => void;
  markAllNotifRead: () => void;
  archiveNotif: (id: number) => void;
  markNotifRead: (id: number) => void;
  approveRequest: (id: number) => void;
  rejectRequest: (id: number) => void;
  addLampSchedule: (lampId: string, schedule: Schedule) => void;
  deleteLampSchedule: (lampId: string, scheduleId: string) => void;
  toggleLampSchedule: (lampId: string, scheduleId: string) => void;
  toggleAutomationRule: (lampId: string, ruleId: string) => void;
  deleteAutomationRule: (lampId: string, ruleId: string) => void;
  addAutomationRule: (lampId: string, rule: AutomationRule) => void;
  lumaUsers: LumaUser[];
  invites: Invite[];
  removeLumaUser: (id: number) => void;
  togglePermCell: (userId: number, permKey: string) => void;
  toggleLampCell: (userId: number, lampId: string) => void;
  sendInvite: (email: string, role: LumaRole) => void;
  cancelInvite: (id: string) => void;
  resendInvite: (id: string) => void;
}

const LumaContext = createContext<LumaContextType | null>(null);

export function LumaProvider({ children }: { children: React.ReactNode }) {
  const [lamps, setLamps] = useState<Lamp[]>(INITIAL_LAMPS);
  const [scenes, setScenes] = useState<Scene[]>(INITIAL_SCENES);
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [notifications, setNotifications] = useState<LumaNotification[]>(INITIAL_NOTIFICATIONS);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>(PENDING_REQUESTS);
  const [approvedRequests, setApprovedRequests] = useState<PendingRequest[]>([]);
  const [lampAutomations, setLampAutomations] = useState<Record<string, AutomationRule[]>>(LAMP_AUTOMATIONS);
  const [lampActivity] = useState<Record<string, ActivityLog[]>>(LAMP_ACTIVITY);
  const [lumaUsers, setLumaUsers] = useState<LumaUser[]>(LUMA_INITIAL_USERS);
  const [invites, setInvites] = useState<Invite[]>(INITIAL_INVITES);

  // Always-current refs so callbacks never have stale closures
  const lumaUsersRef = useRef(lumaUsers);
  useEffect(() => { lumaUsersRef.current = lumaUsers; }, [lumaUsers]);
  const lampsRef = useRef(lamps);
  useEffect(() => { lampsRef.current = lamps; }, [lamps]);
  const notifIdRef = useRef(INITIAL_NOTIFICATIONS.length + 1);

  const pushNotif = useCallback((notif: Omit<LumaNotification, "id" | "read" | "archived">) => {
    const id = notifIdRef.current++;
    setNotifications(prev => [{ ...notif, id, read: false, archived: false }, ...prev]);
  }, []);

  const updateLamp = useCallback((id: string, patch: Partial<Lamp>) => {
    setLamps(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
  }, []);

  const activateScene = useCallback((id: string) => {
    setScenes(prev => prev.map(s => ({ ...s, active: s.id === id })));
    const cfg = SCENE_CONFIGS[id] || {};
    setLamps(prev => prev.map(l => {
      if (cfg[l.id]) {
        return { ...l, ...cfg[l.id], lastCommand: `Scene: ${id}`, lastUpdate: Date.now() };
      }
      return l;
    }));
  }, []);

  const toggleUser = useCallback((id: number) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, status: u.status === "active" ? "inactive" : "active" } : u));
  }, []);

  const removeUser = useCallback((id: number) => {
    setUsers(prev => prev.filter(u => u.id !== id));
  }, []);

  const addUser = useCallback((user: Omit<User, "id">) => {
    setUsers(prev => [...prev, { ...user, id: Date.now() }]);
  }, []);

  const markAllNotifRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const archiveNotif = useCallback((id: number) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, archived: true } : n));
  }, []);

  const markNotifRead = useCallback((id: number) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const approveRequest = useCallback((id: number) => {
    const req = pendingRequests.find(r => r.id === id);
    if (req) setApprovedRequests(prev => [...prev, req]);
    setPendingRequests(prev => prev.filter(r => r.id !== id));
  }, [pendingRequests]);

  const rejectRequest = useCallback((id: number) => {
    setPendingRequests(prev => prev.filter(r => r.id !== id));
  }, []);

  const addLampSchedule = useCallback((lampId: string, schedule: Schedule) => {
    setLamps(prev => prev.map(l => l.id === lampId ? { ...l, schedules: [...l.schedules, schedule] } : l));
  }, []);

  const deleteLampSchedule = useCallback((lampId: string, scheduleId: string) => {
    setLamps(prev => prev.map(l => l.id === lampId ? { ...l, schedules: l.schedules.filter(s => s.id !== scheduleId) } : l));
  }, []);

  const toggleLampSchedule = useCallback((lampId: string, scheduleId: string) => {
    setLamps(prev => prev.map(l => l.id === lampId ? {
      ...l, schedules: l.schedules.map(s => s.id === scheduleId ? { ...s, enabled: !s.enabled } : s)
    } : l));
  }, []);

  const toggleAutomationRule = useCallback((lampId: string, ruleId: string) => {
    setLampAutomations(prev => ({
      ...prev,
      [lampId]: (prev[lampId] || []).map(r => r.id === ruleId ? { ...r, enabled: !r.enabled } : r),
    }));
  }, []);

  const deleteAutomationRule = useCallback((lampId: string, ruleId: string) => {
    setLampAutomations(prev => ({
      ...prev,
      [lampId]: (prev[lampId] || []).filter(r => r.id !== ruleId),
    }));
  }, []);

  const addAutomationRule = useCallback((lampId: string, rule: AutomationRule) => {
    setLampAutomations(prev => ({
      ...prev,
      [lampId]: [...(prev[lampId] || []), rule],
    }));
  }, []);

  const removeLumaUser = useCallback((id: number) => {
    const user = lumaUsersRef.current.find(u => u.id === id);
    setLumaUsers(prev => prev.filter(u => u.id !== id || u.role === "owner"));
    if (user && user.role !== "owner") {
      pushNotif({ cat: "users", icon: "user-minus", title: `${user.name} removed from home`, time: "Just now" });
    }
  }, [pushNotif]);

  const togglePermCell = useCallback((userId: number, permKey: string) => {
    const user = lumaUsersRef.current.find(u => u.id === userId);
    const permLabel = PERMS_DEF.find(p => p.key === permKey)?.label ?? permKey;
    let newVal = false;
    setLumaUsers(prev => prev.map(u => {
      if (u.id !== userId || u.role === "owner") return u;
      newVal = !u.perms[permKey];
      return { ...u, perms: { ...u.perms, [permKey]: newVal } };
    }));
    if (user && user.role !== "owner") {
      pushNotif({
        cat: "users",
        icon: newVal ? "unlock" : "lock",
        title: `${user.name}: ${permLabel} access ${newVal ? "granted" : "revoked"}`,
        time: "Just now",
      });
    }
  }, [pushNotif]);

  const toggleLampCell = useCallback((userId: number, lampId: string) => {
    const user = lumaUsersRef.current.find(u => u.id === userId);
    const lampName = lampsRef.current.find(l => l.id === lampId)?.name ?? lampId;
    let granted = false;
    setLumaUsers(prev => prev.map(u => {
      if (u.id !== userId || u.role === "owner") return u;
      const has = u.lampIds.includes(lampId);
      granted = !has;
      return { ...u, lampIds: has ? u.lampIds.filter(l => l !== lampId) : [...u.lampIds, lampId] };
    }));
    if (user && user.role !== "owner") {
      pushNotif({
        cat: "users",
        icon: granted ? "sun" : "moon",
        title: `${user.name}: "${lampName}" ${granted ? "unlocked" : "removed"}`,
        time: "Just now",
      });
    }
  }, [pushNotif]);

  const sendInvite = useCallback((email: string, role: LumaRole) => {
    setInvites(prev => [...prev, { id: `i${Date.now()}`, email, role, sent: "Just now", exp: "In 7 days" }]);
    pushNotif({ cat: "users", icon: "mail", title: `Invite sent to ${email} (${role})`, time: "Just now" });
  }, [pushNotif]);

  const cancelInvite = useCallback((id: string) => {
    const invite = invites.find(i => i.id === id);
    setInvites(prev => prev.filter(i => i.id !== id));
    if (invite) {
      pushNotif({ cat: "users", icon: "x-circle", title: `Invite to ${invite.email} cancelled`, time: "Just now" });
    }
  }, [invites, pushNotif]);

  const resendInvite = useCallback((id: string) => {
    const invite = invites.find(i => i.id === id);
    setInvites(prev => prev.map(i => i.id === id ? { ...i, sent: "Just now" } : i));
    if (invite) {
      pushNotif({ cat: "users", icon: "send", title: `Invite resent to ${invite.email}`, time: "Just now" });
    }
  }, [invites, pushNotif]);

  return (
    <LumaContext.Provider value={{
      lamps, scenes, users, notifications, pendingRequests, approvedRequests,
      lampAutomations, lampActivity,
      updateLamp, activateScene,
      toggleUser, removeUser, addUser,
      markAllNotifRead, archiveNotif, markNotifRead,
      approveRequest, rejectRequest,
      addLampSchedule, deleteLampSchedule, toggleLampSchedule,
      toggleAutomationRule, deleteAutomationRule, addAutomationRule,
      lumaUsers, invites,
      removeLumaUser, togglePermCell, toggleLampCell,
      sendInvite, cancelInvite, resendInvite,
    }}>
      {children}
    </LumaContext.Provider>
  );
}

export function useLuma(): LumaContextType {
  const ctx = useContext(LumaContext);
  if (!ctx) throw new Error("useLuma must be used within LumaProvider");
  return ctx;
}
