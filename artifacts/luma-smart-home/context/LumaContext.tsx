import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  ActivityLog,
  AdminDelegatedPermission,
  AutomationRule,
  DeviceFeature,
  DeviceFeatureAccess,
  GuestConfig,
  INITIAL_ACCESS_REQUESTS,
  INITIAL_LAMPS,
  INITIAL_MC_USERS,
  INITIAL_NOTIFICATIONS,
  INITIAL_SCENES,
  INITIAL_USERS,
  INITIAL_INVITES,
  INITIAL_MICROCONTROLLERS,
  INITIAL_MC_DEVICES,
  Invite,
  LAMP_AUTOMATIONS,
  Lamp,
  LumaNotification,
  LumaRole,
  LumaUser,
  LUMA_INITIAL_USERS,
  MCAccessRequest,
  MCDevice,
  MCUserEntry,
  MCUserRole,
  Microcontroller,
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
  addLamp: (lamp: Omit<Lamp, "id">) => void;
  deleteLamp: (id: string) => void;
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
  // Microcontrollers
  microcontrollers: Microcontroller[];
  mcDevices: MCDevice[];
  addMicrocontroller: (mc: Omit<Microcontroller, "id">) => void;
  updateMicrocontroller: (id: string, patch: Partial<Microcontroller>) => void;
  deleteMicrocontroller: (id: string) => void;
  addMCDevice: (device: Omit<MCDevice, "id">) => void;
  updateMCDevice: (id: string, patch: Partial<MCDevice>) => void;
  deleteMCDevice: (id: string) => void;
  toggleMCDevice: (id: string) => void;
  // ── MCU Permission Model ──────────────────────────────────────────────────
  mcUsers: MCUserEntry[];
  accessRequests: MCAccessRequest[];
  promoteToAdmin: (userId: number, delegation: AdminDelegatedPermission[]) => void;
  revokeAdmin: (userId: number) => void;
  updateAdminDelegation: (userId: number, delegation: AdminDelegatedPermission[]) => void;
  toggleAdminPerm: (userId: number, perm: AdminDelegatedPermission) => void;
  grantDeviceAccess: (userId: number, access: DeviceFeatureAccess) => void;
  revokeDeviceAccess: (userId: number, deviceId: string) => void;
  updateDeviceFeatures: (userId: number, deviceId: string, features: DeviceFeature[]) => void;
  toggleDeviceFeature: (userId: number, deviceId: string, feature: DeviceFeature) => void;
  removeMCUser: (userId: number) => void;
  createGuest: (name: string, email: string, config: GuestConfig, deviceAccess: DeviceFeatureAccess[]) => void;
  revokeGuest: (userId: number) => void;
  changeMCUserRole: (userId: number, role: MCUserRole) => void;
  submitAccessRequest: (req: Omit<MCAccessRequest, "id" | "status" | "requestedAt">) => void;
  approveAccessRequest: (id: number, deviceAccess: DeviceFeatureAccess[], role: MCUserRole) => void;
  rejectAccessRequest: (id: number) => void;
  blockRequester: (id: number) => void;
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
  const [microcontrollers, setMicrocontrollers] = useState<Microcontroller[]>(INITIAL_MICROCONTROLLERS);
  const [mcDevices, setMCDevices] = useState<MCDevice[]>(INITIAL_MC_DEVICES);
  const [mcUsers, setMCUsers] = useState<MCUserEntry[]>(INITIAL_MC_USERS);
  const [accessRequests, setAccessRequests] = useState<MCAccessRequest[]>(INITIAL_ACCESS_REQUESTS);

  // Always-current refs so callbacks never have stale closures
  const lumaUsersRef = useRef(lumaUsers);
  useEffect(() => { lumaUsersRef.current = lumaUsers; }, [lumaUsers]);
  const lampsRef = useRef(lamps);
  useEffect(() => { lampsRef.current = lamps; }, [lamps]);
  const mcDevicesRef = useRef(mcDevices);
  useEffect(() => { mcDevicesRef.current = mcDevices; }, [mcDevices]);
  const microcontrollersRef = useRef(microcontrollers);
  useEffect(() => { microcontrollersRef.current = microcontrollers; }, [microcontrollers]);
  const notifIdRef = useRef(INITIAL_NOTIFICATIONS.length + 1);

  const pushNotif = useCallback((notif: Omit<LumaNotification, "id" | "read" | "archived">) => {
    const id = notifIdRef.current++;
    setNotifications(prev => [{ ...notif, id, read: false, archived: false }, ...prev]);
  }, []);

  const updateLamp = useCallback((id: string, patch: Partial<Lamp>) => {
    setLamps(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
  }, []);

  const addLamp = useCallback((lamp: Omit<Lamp, "id">) => {
    const id = `L${Date.now()}`;
    setLamps(prev => [...prev, { ...lamp, id }]);
  }, []);

  const deleteLamp = useCallback((id: string) => {
    setLamps(prev => prev.filter(l => l.id !== id));
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

  // ── Microcontroller actions ─────────────────────────────────────────────
  const addMicrocontroller = useCallback((mc: Omit<Microcontroller, "id">) => {
    const now = Date.now();
    setMicrocontrollers(prev => [...prev, {
      ...mc,
      id: `MC${now}`,
      hardwareVersion: mc.hardwareVersion ?? "rev1.0",
      configVersion: mc.configVersion ?? 0,
      lastConfigUpdate: mc.lastConfigUpdate ?? now,
      lastSync: mc.lastSync ?? 0,
    }]);
  }, []);

  const updateMicrocontroller = useCallback((id: string, patch: Partial<Microcontroller>) => {
    const now = Date.now();
    setMicrocontrollers(prev => prev.map(mc =>
      mc.id === id
        ? { ...mc, ...patch, configVersion: (mc.configVersion ?? 0) + 1, lastConfigUpdate: now }
        : mc
    ));
    // Keep mcName denormalised in all child devices when MC is renamed
    if (patch.name !== undefined) {
      setMCDevices(prev => prev.map(d => d.mcId === id ? { ...d, mcName: patch.name! } : d));
    }
  }, []);

  const deleteMicrocontroller = useCallback((id: string) => {
    setMicrocontrollers(prev => prev.filter(mc => mc.id !== id));
    setMCDevices(prev => prev.filter(d => d.mcId !== id));
  }, []);

  const addMCDevice = useCallback((device: Omit<MCDevice, "id">) => {
    const now = Date.now();
    const mc = microcontrollersRef.current.find(m => m.id === device.mcId);
    setMCDevices(prev => [...prev, {
      ...device,
      id: `MCD${now}`,
      mcName: device.mcName ?? mc?.name ?? device.mcId,
      registrationDate: device.registrationDate ?? now,
      lastUpdated: now,
    }]);
    // Bump parent MC config version so OTA profile stays current
    setMicrocontrollers(prev => prev.map(m =>
      m.id === device.mcId
        ? { ...m, configVersion: (m.configVersion ?? 0) + 1, lastConfigUpdate: now }
        : m
    ));
  }, []);

  const updateMCDevice = useCallback((id: string, patch: Partial<MCDevice>) => {
    const now = Date.now();
    const device = mcDevicesRef.current.find(d => d.id === id);
    setMCDevices(prev => prev.map(d => d.id === id ? { ...d, ...patch, lastUpdated: now } : d));
    if (device) {
      setMicrocontrollers(prev => prev.map(m =>
        m.id === device.mcId
          ? { ...m, configVersion: (m.configVersion ?? 0) + 1, lastConfigUpdate: now }
          : m
      ));
    }
  }, []);

  const deleteMCDevice = useCallback((id: string) => {
    const device = mcDevicesRef.current.find(d => d.id === id);
    setMCDevices(prev => prev.filter(d => d.id !== id));
    if (device) {
      const now = Date.now();
      setMicrocontrollers(prev => prev.map(m =>
        m.id === device.mcId
          ? { ...m, configVersion: (m.configVersion ?? 0) + 1, lastConfigUpdate: now }
          : m
      ));
    }
  }, []);

  const toggleMCDevice = useCallback((id: string) => {
    const now = Date.now();
    setMCDevices(prev => prev.map(d => d.id === id ? { ...d, on: !d.on, lastUpdated: now } : d));
  }, []);

  // ── MCU Permission Model callbacks ─────────────────────────────────────────

  const promoteToAdmin = useCallback((userId: number, delegation: AdminDelegatedPermission[]) => {
    setMCUsers(prev => prev.map(u =>
      u.id === userId && u.role !== "owner"
        ? { ...u, role: "device_admin", adminDelegation: delegation }
        : u
    ));
    pushNotif({ cat: "users", icon: "shield", title: `User promoted to Device Admin`, time: "Just now" });
  }, [pushNotif]);

  const revokeAdmin = useCallback((userId: number) => {
    setMCUsers(prev => prev.map(u =>
      u.id === userId && u.role === "device_admin"
        ? { ...u, role: "full_access", adminDelegation: [] }
        : u
    ));
    pushNotif({ cat: "users", icon: "user-minus", title: `Device Admin role revoked`, time: "Just now" });
  }, [pushNotif]);

  const updateAdminDelegation = useCallback((userId: number, delegation: AdminDelegatedPermission[]) => {
    setMCUsers(prev => prev.map(u =>
      u.id === userId ? { ...u, adminDelegation: delegation } : u
    ));
  }, []);

  const toggleAdminPerm = useCallback((userId: number, perm: AdminDelegatedPermission) => {
    setMCUsers(prev => prev.map(u => {
      if (u.id !== userId) return u;
      const has = u.adminDelegation.includes(perm);
      return { ...u, adminDelegation: has ? u.adminDelegation.filter(p => p !== perm) : [...u.adminDelegation, perm] };
    }));
  }, []);

  const grantDeviceAccess = useCallback((userId: number, access: DeviceFeatureAccess) => {
    setMCUsers(prev => prev.map(u => {
      if (u.id !== userId) return u;
      const existing = u.deviceAccess.find(d => d.deviceId === access.deviceId);
      if (existing) {
        return { ...u, deviceAccess: u.deviceAccess.map(d => d.deviceId === access.deviceId ? access : d) };
      }
      return { ...u, deviceAccess: [...u.deviceAccess, access] };
    }));
  }, []);

  const revokeDeviceAccess = useCallback((userId: number, deviceId: string) => {
    setMCUsers(prev => prev.map(u =>
      u.id === userId
        ? { ...u, deviceAccess: u.deviceAccess.filter(d => d.deviceId !== deviceId) }
        : u
    ));
  }, []);

  const updateDeviceFeatures = useCallback((userId: number, deviceId: string, features: DeviceFeature[]) => {
    setMCUsers(prev => prev.map(u =>
      u.id === userId
        ? { ...u, deviceAccess: u.deviceAccess.map(d => d.deviceId === deviceId ? { ...d, features } : d) }
        : u
    ));
  }, []);

  const toggleDeviceFeature = useCallback((userId: number, deviceId: string, feature: DeviceFeature) => {
    setMCUsers(prev => prev.map(u => {
      if (u.id !== userId) return u;
      return {
        ...u,
        deviceAccess: u.deviceAccess.map(d => {
          if (d.deviceId !== deviceId) return d;
          const has = d.features.includes(feature);
          return { ...d, features: has ? d.features.filter(f => f !== feature) : [...d.features, feature] };
        }),
      };
    }));
  }, []);

  const removeMCUser = useCallback((userId: number) => {
    setMCUsers(prev => prev.filter(u => u.id !== userId || u.role === "owner"));
    pushNotif({ cat: "users", icon: "user-minus", title: `User removed from MCU`, time: "Just now" });
  }, [pushNotif]);

  const changeMCUserRole = useCallback((userId: number, role: MCUserRole) => {
    setMCUsers(prev => prev.map(u =>
      u.id !== userId || u.role === "owner" ? u : { ...u, role, adminDelegation: role === "device_admin" ? u.adminDelegation : [] }
    ));
  }, []);

  const createGuest = useCallback((name: string, email: string, config: GuestConfig, deviceAccess: DeviceFeatureAccess[]) => {
    const id = Date.now();
    const init = name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
    setMCUsers(prev => [...prev, {
      id,
      name, email, avatarInit: init, avatarIdx: id % 5,
      mcId: "MC001", role: "guest",
      deviceAccess,
      adminDelegation: [],
      guestConfig: config,
      online: false, lastSeen: "Just now", joined: new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" }),
    }]);
    pushNotif({ cat: "users", icon: "link", title: `Guest access created for ${name}`, time: "Just now" });
  }, [pushNotif]);

  const revokeGuest = useCallback((userId: number) => {
    setMCUsers(prev => prev.filter(u => u.id !== userId));
    pushNotif({ cat: "users", icon: "x-circle", title: `Guest access revoked`, time: "Just now" });
  }, [pushNotif]);

  const submitAccessRequest = useCallback((req: Omit<MCAccessRequest, "id" | "status" | "requestedAt">) => {
    setAccessRequests(prev => [...prev, { ...req, id: Date.now(), status: "pending", requestedAt: Date.now() }]);
    pushNotif({ cat: "security", icon: "shield", title: `New access request from ${req.requesterName}`, time: "Just now" });
  }, [pushNotif]);

  const approveAccessRequest = useCallback((id: number, deviceAccess: DeviceFeatureAccess[], role: MCUserRole) => {
    const req = accessRequests.find(r => r.id === id);
    setAccessRequests(prev => prev.map(r => r.id === id ? { ...r, status: "approved", respondedAt: Date.now() } : r));
    if (req) {
      const init = req.requesterName.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
      setMCUsers(prev => [...prev, {
        id: Date.now(),
        name: req.requesterName, email: "", avatarInit: init, avatarIdx: Date.now() % 5,
        mcId: req.mcId, role,
        deviceAccess,
        adminDelegation: [],
        online: false, lastSeen: "Just now", joined: new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      }]);
      pushNotif({ cat: "users", icon: "check-circle", title: `Access approved for ${req.requesterName}`, time: "Just now" });
    }
  }, [accessRequests, pushNotif]);

  const rejectAccessRequest = useCallback((id: number) => {
    setAccessRequests(prev => prev.map(r => r.id === id ? { ...r, status: "rejected", respondedAt: Date.now() } : r));
  }, []);

  const blockRequester = useCallback((id: number) => {
    const req = accessRequests.find(r => r.id === id);
    setAccessRequests(prev => prev.map(r => r.id === id ? { ...r, status: "blocked", respondedAt: Date.now() } : r));
    if (req) {
      pushNotif({ cat: "security", icon: "slash", title: `${req.requesterName} blocked from requesting access`, time: "Just now" });
    }
  }, [accessRequests, pushNotif]);

  return (
    <LumaContext.Provider value={{
      lamps, scenes, users, notifications, pendingRequests, approvedRequests,
      lampAutomations, lampActivity,
      updateLamp, addLamp, deleteLamp, activateScene,
      toggleUser, removeUser, addUser,
      markAllNotifRead, archiveNotif, markNotifRead,
      approveRequest, rejectRequest,
      addLampSchedule, deleteLampSchedule, toggleLampSchedule,
      toggleAutomationRule, deleteAutomationRule, addAutomationRule,
      lumaUsers, invites,
      removeLumaUser, togglePermCell, toggleLampCell,
      sendInvite, cancelInvite, resendInvite,
      microcontrollers, mcDevices,
      addMicrocontroller, updateMicrocontroller, deleteMicrocontroller,
      addMCDevice, updateMCDevice, deleteMCDevice, toggleMCDevice,
      mcUsers, accessRequests,
      promoteToAdmin, revokeAdmin, updateAdminDelegation, toggleAdminPerm,
      grantDeviceAccess, revokeDeviceAccess, updateDeviceFeatures, toggleDeviceFeature,
      removeMCUser, createGuest, revokeGuest, changeMCUserRole,
      submitAccessRequest, approveAccessRequest, rejectAccessRequest, blockRequester,
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
