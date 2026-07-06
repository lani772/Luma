import React, { createContext, useCallback, useContext, useState } from "react";
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
    setLumaUsers(prev => prev.filter(u => u.id !== id || u.role === "owner"));
  }, []);

  const togglePermCell = useCallback((userId: number, permKey: string) => {
    setLumaUsers(prev => prev.map(u => {
      if (u.id !== userId || u.role === "owner") return u;
      return { ...u, perms: { ...u.perms, [permKey]: !u.perms[permKey] } };
    }));
  }, []);

  const toggleLampCell = useCallback((userId: number, lampId: string) => {
    setLumaUsers(prev => prev.map(u => {
      if (u.id !== userId || u.role === "owner") return u;
      const has = u.lampIds.includes(lampId);
      return { ...u, lampIds: has ? u.lampIds.filter(l => l !== lampId) : [...u.lampIds, lampId] };
    }));
  }, []);

  const sendInvite = useCallback((email: string, role: LumaRole) => {
    setInvites(prev => [...prev, { id: `i${Date.now()}`, email, role, sent: "Just now", exp: "In 7 days" }]);
  }, []);

  const cancelInvite = useCallback((id: string) => {
    setInvites(prev => prev.filter(i => i.id !== id));
  }, []);

  const resendInvite = useCallback((id: string) => {
    setInvites(prev => prev.map(i => i.id === id ? { ...i, sent: "Just now" } : i));
  }, []);

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
