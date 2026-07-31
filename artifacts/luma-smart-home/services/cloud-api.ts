import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import {
  DEMO_AUTH,
  DEMO_ACCESS_REQUESTS,
  DEMO_DEVICES,
  DEMO_EMAIL,
  DEMO_PASSWORD,
  DEMO_PULL_SYNC,
  DEMO_PUSH_SYNC,
  DEMO_RECEIVED_INVITATIONS,
  DEMO_SENT_INVITATIONS,
  DEMO_SESSIONS,
  DEMO_USER,
  makeDemoSyncData,
} from "./demo-data";

const CLOUD_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/cloud`
  : "http://localhost:8090/cloud";

// ── Storage keys ────────────────────────────────────────────────────────────────
const KEY_ACCESS    = "@luma/cloud_access_token";
const KEY_REFRESH   = "@luma/cloud_refresh_token";
const KEY_USER      = "@luma/cloud_user";
const KEY_PHONE     = "@luma/cloud_phone_id";
const KEY_USERNAME  = "@luma/cloud_username";
const KEY_SYNC_DATA = "@luma/cloud_sync_cache";
const KEY_DEMO_MODE = "@luma/demo_mode";

// ── Demo mode ────────────────────────────────────────────────────────────────────

/** In-memory flag; restored from AsyncStorage during app init. */
let _demoMode = false;

export async function initDemoMode(): Promise<void> {
  try {
    const val = await AsyncStorage.getItem(KEY_DEMO_MODE);
    _demoMode = val === "1";
  } catch { /* ignore */ }
}

export function isDemoMode(): boolean { return _demoMode; }

async function enableDemoMode(): Promise<void> {
  _demoMode = true;
  await AsyncStorage.setItem(KEY_DEMO_MODE, "1");
}

async function disableDemoMode(): Promise<void> {
  _demoMode = false;
  await AsyncStorage.removeItem(KEY_DEMO_MODE);
}

// ── Domain types ────────────────────────────────────────────────────────────────

export interface CloudUser {
  id: string;
  email: string;
  fullName: string;
  username?: string;
  role: string;
  emailVerified: boolean;
  subscriptionTier: string;
  createdAt: string;
  lastLoginAt?: string;
  avatarUrl?: string;
  preferences?: Record<string, unknown>;
}

export interface AuthResponse {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  user: CloudUser;
  sessionId: string;
}

export interface CloudDevice {
  id: string;
  name: string;
  description?: string;
  model: string;
  mac: string;
  deviceId: string;
  ownerId: string;
  status: "active" | "suspended" | "pending";
  registeredAt: string;
  lastConnectedAt?: string;
  firmwareVersion?: string;
}

export interface CloudInvitation {
  id: string;
  fromUserId: string;
  fromUserName: string;
  toEmail?: string;
  toUsername?: string;
  deviceId: string;
  deviceName: string;
  permissions: string[];
  expiresAt: string;
  status: "pending" | "accepted" | "declined" | "expired";
  message?: string;
  createdAt: string;
}

export interface CloudAccessRequest {
  id: string;
  requesterId: string;
  requesterName: string;
  requesterEmail: string;
  deviceId?: string;
  deviceName?: string;
  roomId?: string;
  mcDeviceId?: string;
  lampId?: string;
  permissionLevel: string;
  message?: string;
  status: "pending" | "approved" | "rejected" | "blocked";
  requestedAt: string;
  respondedAt?: string;
}

export interface CloudSession {
  id: string;
  deviceName: string;
  platform: string;
  lastUsedAt: string;
  current: boolean;
}

export interface SyncResource {
  resourceId: string;
  resourceType: string;
  data: Record<string, unknown>;
  version: number;
  updatedAt: string;
  deleted: boolean;
}

export interface PushSyncResponse {
  conflicts: SyncResource[];
  success: boolean;
}

export interface PullSyncResponse {
  resources: SyncResource[];
  currentVersion: number;
}

export interface CloudSyncData {
  devices: CloudDevice[];
  invitations: CloudInvitation[];
  accessRequests: CloudAccessRequest[];
  syncedAt: string;
}

interface Envelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

// ── Token refresh state (module-level singleton) ────────────────────────────────
let _isRefreshing = false;
let _refreshWaiters: Array<(token: string | null) => void> = [];

// ── Core fetch ──────────────────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  opts: RequestInit & { skipAuth?: boolean; _isRetry?: boolean } = {},
): Promise<T> {
  if (_demoMode) {
    throw Object.assign(new Error("Demo mode active"), { code: "DEMO_MODE", status: 0 });
  }

  const { skipAuth, _isRetry, headers: headersInit, ...init } = opts;
  const hdrs = new Headers(headersInit as Record<string, string> | undefined);
  hdrs.set("Content-Type", "application/json");
  hdrs.set("Accept", "application/json");

  if (!skipAuth) {
    const token = await AsyncStorage.getItem(KEY_ACCESS);
    if (token) hdrs.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${CLOUD_BASE}${path}`, { ...init, headers: hdrs });

  // Attempt one silent refresh on 401
  if (res.status === 401 && !skipAuth && !_isRetry) {
    const newToken = await CloudAPI._tryRefresh();
    if (newToken) {
      return apiFetch<T>(path, { ...opts, _isRetry: true });
    }
  }

  let envelope: Envelope<T>;
  try {
    envelope = await res.json();
  } catch {
    envelope = { success: false, error: { code: "PARSE_ERROR", message: "Invalid JSON" } };
  }

  if (!res.ok || !envelope.success) {
    const msg = envelope.error?.message ?? `HTTP ${res.status}`;
    const err = Object.assign(new Error(msg), {
      status: res.status,
      code: envelope.error?.code ?? "UNKNOWN",
    });
    throw err;
  }
  return envelope.data as T;
}

/** Like apiFetch but returns a fallback instead of throwing on 404 / 501 / 405. */
async function apiFetchOptional<T>(
  path: string,
  opts: RequestInit & { skipAuth?: boolean } = {},
  fallback: T,
): Promise<T> {
  try {
    return await apiFetch<T>(path, opts);
  } catch (err) {
    const e = err as { status?: number; code?: string };
    if (e.code === "DEMO_MODE") return fallback;
    if (e.status === 404 || e.status === 501 || e.status === 405) {
      return fallback;
    }
    return fallback; // also swallow network errors for optional endpoints
  }
}

// ── CloudAPI ────────────────────────────────────────────────────────────────────

export const CloudAPI = {

  // ── Authentication ──────────────────────────────────────────────────────────

  async login(identifier: string, password: string): Promise<AuthResponse> {
    // Demo credentials — work fully offline
    if (
      (identifier.toLowerCase() === DEMO_EMAIL || identifier.toLowerCase() === "demo") &&
      password === DEMO_PASSWORD
    ) {
      await enableDemoMode();
      return { ...DEMO_AUTH, user: { ...DEMO_USER, lastLoginAt: new Date().toISOString() } };
    }
    return apiFetch<AuthResponse>("/auth/login", {
      method: "POST",
      skipAuth: true,
      body: JSON.stringify({
        ...(identifier.includes("@") ? { email: identifier } : { username: identifier }),
        password,
        deviceName: "LUMA Mobile App",
        platform: Platform.OS === "ios" || Platform.OS === "android" || Platform.OS === "web" ? Platform.OS : "other",
      }),
    });
  },

  register(
    email: string,
    password: string,
    fullName: string,
    username: string,
  ): Promise<AuthResponse> {
    return apiFetch<AuthResponse>("/auth/register", {
      method: "POST",
      skipAuth: true,
      body: JSON.stringify({
        email,
        password,
        fullName,
        username,
        deviceName: "LUMA Mobile App",
        platform: Platform.OS === "ios" || Platform.OS === "android" || Platform.OS === "web" ? Platform.OS : "other",
      }),
    });
  },

  refresh(refreshToken: string): Promise<AuthResponse> {
    if (_demoMode) return Promise.resolve({ ...DEMO_AUTH });
    return apiFetch<AuthResponse>("/auth/refresh", {
      method: "POST",
      skipAuth: true,
      body: JSON.stringify({ refreshToken }),
    });
  },

  async logout(refreshToken: string): Promise<void> {
    if (_demoMode) { await disableDemoMode(); return; }
    await apiFetch<unknown>("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }).catch(() => undefined);
  },

  requestPasswordReset(email: string): Promise<{ message?: string }> {
    if (_demoMode) return Promise.resolve({ message: "Demo mode: password reset not available" });
    return apiFetch<{ message?: string }>("/auth/request-password-reset", {
      method: "POST",
      skipAuth: true,
      body: JSON.stringify({ email }),
    });
  },

  resetPassword(token: string, newPassword: string): Promise<void> {
    if (_demoMode) return Promise.resolve();
    return apiFetch<void>("/auth/reset-password", {
      method: "POST",
      skipAuth: true,
      body: JSON.stringify({ token, newPassword }),
    });
  },

  resendVerificationEmail(): Promise<void> {
    if (_demoMode) return Promise.resolve();
    return apiFetch<void>("/auth/resend-verification", {
      method: "POST",
      body: JSON.stringify({}),
    });
  },

  // ── Internal: serialised token refresh ─────────────────────────────────────

  async _tryRefresh(): Promise<string | null> {
    if (_demoMode) return DEMO_AUTH.accessToken;
    if (_isRefreshing) {
      return new Promise<string | null>(resolve => {
        _refreshWaiters.push(resolve);
      });
    }
    _isRefreshing = true;
    try {
      const storedRefresh = await AsyncStorage.getItem(KEY_REFRESH);
      if (!storedRefresh) throw new Error("no refresh token");
      const auth = await CloudAPI.refresh(storedRefresh);
      await CloudAPI.storeAuth(auth);
      const tok = auth.accessToken;
      _refreshWaiters.forEach(fn => fn(tok));
      _refreshWaiters = [];
      return tok;
    } catch {
      await CloudAPI.clearAuth();
      _refreshWaiters.forEach(fn => fn(null));
      _refreshWaiters = [];
      return null;
    } finally {
      _isRefreshing = false;
    }
  },

  // ── User profile ────────────────────────────────────────────────────────────

  getProfile(): Promise<CloudUser> {
    if (_demoMode) return Promise.resolve({ ...DEMO_USER });
    return apiFetch<CloudUser>("/api/engines/users/me");
  },

  updateProfile(
    patch: Partial<Pick<CloudUser, "fullName" | "username" | "preferences">>,
  ): Promise<CloudUser> {
    if (_demoMode) return Promise.resolve({ ...DEMO_USER, ...patch });
    return apiFetch<CloudUser>("/api/engines/users/me", {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  deleteAccount(password?: string): Promise<void> {
    if (_demoMode) return Promise.resolve();
    return apiFetch<void>("/api/engines/users/me", {
      method: "DELETE",
      body: JSON.stringify({ password }),
    });
  },

  changePassword(currentPassword: string, newPassword: string): Promise<void> {
    if (_demoMode) return Promise.resolve();
    return apiFetch<void>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  // ── Sessions ────────────────────────────────────────────────────────────────

  getSessions(): Promise<CloudSession[]> {
    if (_demoMode) return Promise.resolve([...DEMO_SESSIONS]);
    return apiFetchOptional<CloudSession[]>("/auth/sessions", {}, []);
  },

  revokeSession(sessionId: string): Promise<void> {
    if (_demoMode) return Promise.resolve();
    return apiFetch<void>(`/auth/sessions/${sessionId}`, { method: "DELETE" });
  },

  revokeAllOtherSessions(): Promise<void> {
    if (_demoMode) return Promise.resolve();
    return apiFetch<void>("/auth/sessions/revoke-others", { method: "POST", body: "{}" });
  },

  // ── Devices (microcontrollers) ──────────────────────────────────────────────

  getDevices(): Promise<CloudDevice[]> {
    if (_demoMode) return Promise.resolve([...DEMO_DEVICES]);
    return apiFetchOptional<CloudDevice[]>("/api/engines/devices", {}, []);
  },

  registerDevice(data: {
    name: string;
    description?: string;
    model: string;
    mac: string;
    deviceId: string;
    registrationKey: string;
  }): Promise<CloudDevice> {
    if (_demoMode) {
      const dev: CloudDevice = {
        id: `dev-${Date.now()}`, ...data, ownerId: "demo-user-001",
        status: "active", registeredAt: new Date().toISOString(),
      };
      return Promise.resolve(dev);
    }
    return apiFetch<CloudDevice>("/api/engines/devices", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  updateDevice(
    id: string,
    patch: Partial<{ name: string; description: string }>,
  ): Promise<CloudDevice> {
    if (_demoMode) {
      const found = DEMO_DEVICES.find(d => d.id === id) ?? DEMO_DEVICES[0];
      return Promise.resolve({ ...found, ...patch });
    }
    return apiFetch<CloudDevice>(`/api/engines/devices/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  deleteDevice(id: string): Promise<void> {
    if (_demoMode) return Promise.resolve();
    return apiFetch<void>(`/api/engines/devices/${id}`, { method: "DELETE" });
  },

  transferOwnership(
    deviceId: string,
    toEmail: string,
    previousOwnerBecomesAdmin = false,
  ): Promise<void> {
    if (_demoMode) return Promise.resolve();
    return apiFetch<void>(`/api/engines/devices/${deviceId}/transfer-ownership`, {
      method: "POST",
      body: JSON.stringify({ toEmail, previousOwnerBecomesAdmin }),
    });
  },

  // ── Invitations ─────────────────────────────────────────────────────────────

  getReceivedInvitations(): Promise<CloudInvitation[]> {
    if (_demoMode) return Promise.resolve([...DEMO_RECEIVED_INVITATIONS]);
    return apiFetchOptional<CloudInvitation[]>("/api/engines/invitations/received", {}, []);
  },

  getSentInvitations(): Promise<CloudInvitation[]> {
    if (_demoMode) return Promise.resolve([...DEMO_SENT_INVITATIONS]);
    return apiFetchOptional<CloudInvitation[]>("/api/engines/invitations/sent", {}, []);
  },

  sendInvitation(data: {
    deviceId: string;
    toEmail?: string;
    toUsername?: string;
    permissions: string[];
    expiresInDays?: number;
    message?: string;
  }): Promise<CloudInvitation> {
    if (_demoMode) {
      const inv: CloudInvitation = {
        id: `inv-${Date.now()}`, fromUserId: "demo-user-001", fromUserName: "Demo User",
        ...data, deviceName: "Demo Device",
        expiresAt: new Date(Date.now() + 86_400_000 * (data.expiresInDays ?? 7)).toISOString(),
        status: "pending", createdAt: new Date().toISOString(),
      };
      return Promise.resolve(inv);
    }
    return apiFetch<CloudInvitation>("/api/engines/invitations", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  acceptInvitation(id: string): Promise<void> {
    if (_demoMode) return Promise.resolve();
    return apiFetch<void>(`/api/engines/invitations/${id}/accept`, {
      method: "POST",
      body: "{}",
    });
  },

  declineInvitation(id: string): Promise<void> {
    if (_demoMode) return Promise.resolve();
    return apiFetch<void>(`/api/engines/invitations/${id}/decline`, {
      method: "POST",
      body: "{}",
    });
  },

  cancelInvitation(id: string): Promise<void> {
    if (_demoMode) return Promise.resolve();
    return apiFetch<void>(`/api/engines/invitations/${id}`, { method: "DELETE" });
  },

  // ── Access requests ─────────────────────────────────────────────────────────

  getAccessRequests(): Promise<CloudAccessRequest[]> {
    if (_demoMode) return Promise.resolve([...DEMO_ACCESS_REQUESTS]);
    return apiFetchOptional<CloudAccessRequest[]>("/api/engines/access-requests", {}, []);
  },

  submitAccessRequest(data: {
    targetEmail?: string;
    targetUsername?: string;
    deviceId?: string;
    roomId?: string;
    mcDeviceId?: string;
    lampId?: string;
    permissionLevel: string;
    message?: string;
  }): Promise<CloudAccessRequest> {
    if (_demoMode) {
      const req: CloudAccessRequest = {
        id: `req-${Date.now()}`, requesterId: "demo-user-001",
        requesterName: "Demo User", requesterEmail: DEMO_EMAIL,
        ...data, status: "pending", requestedAt: new Date().toISOString(),
      };
      return Promise.resolve(req);
    }
    return apiFetch<CloudAccessRequest>("/api/engines/access-requests", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  approveAccessRequest(id: string, permissions: string[]): Promise<void> {
    if (_demoMode) return Promise.resolve();
    return apiFetch<void>(`/api/engines/access-requests/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ permissions }),
    });
  },

  rejectAccessRequest(id: string): Promise<void> {
    if (_demoMode) return Promise.resolve();
    return apiFetch<void>(`/api/engines/access-requests/${id}/reject`, {
      method: "POST",
      body: "{}",
    });
  },

  // ── Sync ────────────────────────────────────────────────────────────────────

  syncPush(
    phoneId: string,
    resources: Array<Omit<SyncResource, "updatedAt" | "deleted">>,
  ): Promise<PushSyncResponse> {
    if (_demoMode) return Promise.resolve({ ...DEMO_PUSH_SYNC });
    const payload = resources.map(r => ({
      ...r,
      updatedAt: new Date().toISOString(),
      deleted: false,
    }));
    return apiFetch<PushSyncResponse>("/sync/push", {
      method: "POST",
      body: JSON.stringify({ phoneId, resources: payload }),
    });
  },

  syncPull(phoneId: string, resourceType: string, lastVersion = 0): Promise<PullSyncResponse> {
    if (_demoMode) return Promise.resolve({ ...DEMO_PULL_SYNC });
    return apiFetch<PullSyncResponse>("/sync/pull", {
      method: "POST",
      body: JSON.stringify({ phoneId, resourceType, lastVersion }),
    });
  },

  /** Full post-login sync — fetches all cloud resources and caches locally. */
  async syncAllData(): Promise<CloudSyncData> {
    if (_demoMode) {
      const data = makeDemoSyncData();
      await AsyncStorage.setItem(KEY_SYNC_DATA, JSON.stringify(data));
      return data;
    }

    const [devR, invR, reqR] = await Promise.allSettled([
      CloudAPI.getDevices(),
      CloudAPI.getReceivedInvitations(),
      CloudAPI.getAccessRequests(),
    ]);

    const data: CloudSyncData = {
      devices:        devR.status === "fulfilled" ? devR.value : [],
      invitations:    invR.status === "fulfilled" ? invR.value : [],
      accessRequests: reqR.status === "fulfilled" ? reqR.value : [],
      syncedAt: new Date().toISOString(),
    };

    await AsyncStorage.setItem(KEY_SYNC_DATA, JSON.stringify(data));
    return data;
  },

  async getCachedSyncData(): Promise<CloudSyncData | null> {
    const raw = await AsyncStorage.getItem(KEY_SYNC_DATA);
    if (!raw) return null;
    try { return JSON.parse(raw) as CloudSyncData; }
    catch { return null; }
  },

  // ── Local storage ────────────────────────────────────────────────────────────

  async storeAuth(auth: AuthResponse): Promise<void> {
    await Promise.all([
      AsyncStorage.setItem(KEY_ACCESS,  auth.accessToken),
      AsyncStorage.setItem(KEY_REFRESH, auth.refreshToken),
      AsyncStorage.setItem(KEY_USER,    JSON.stringify(auth.user)),
    ]);
  },

  async storeUsername(username: string): Promise<void> {
    await AsyncStorage.setItem(KEY_USERNAME, username);
  },

  async getStoredUsername(): Promise<string | null> {
    return AsyncStorage.getItem(KEY_USERNAME);
  },

  async clearAuth(): Promise<void> {
    await disableDemoMode();
    await AsyncStorage.multiRemove([
      KEY_ACCESS, KEY_REFRESH, KEY_USER, KEY_USERNAME, KEY_SYNC_DATA,
    ]);
  },

  async getStoredUser(): Promise<CloudUser | null> {
    const raw = await AsyncStorage.getItem(KEY_USER);
    if (!raw) return null;
    try { return JSON.parse(raw) as CloudUser; }
    catch { return null; }
  },

  async getStoredTokens(): Promise<{ accessToken: string | null; refreshToken: string | null }> {
    const [accessToken, refreshToken] = await Promise.all([
      AsyncStorage.getItem(KEY_ACCESS),
      AsyncStorage.getItem(KEY_REFRESH),
    ]);
    return { accessToken, refreshToken };
  },

  async getOrCreatePhoneId(): Promise<string> {
    let id = await AsyncStorage.getItem(KEY_PHONE);
    if (!id) {
      id = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      });
      await AsyncStorage.setItem(KEY_PHONE, id);
    }
    return id;
  },
};
