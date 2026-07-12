import AsyncStorage from "@react-native-async-storage/async-storage";

const CLOUD_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/cloud`
  : "http://localhost:8090/cloud";

const KEY_ACCESS  = "@luma/cloud_access_token";
const KEY_REFRESH = "@luma/cloud_refresh_token";
const KEY_USER    = "@luma/cloud_user";
const KEY_PHONE   = "@luma/cloud_phone_id";

export interface CloudUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  emailVerified: boolean;
  subscriptionTier: string;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  user: CloudUser;
  sessionId: string;
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

interface Envelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

async function apiFetch<T>(
  path: string,
  opts: RequestInit & { skipAuth?: boolean } = {},
): Promise<T> {
  const { skipAuth, headers: headersInit, ...init } = opts;
  const hdrs = new Headers(headersInit as Record<string, string> | undefined);
  hdrs.set("Content-Type", "application/json");
  hdrs.set("Accept", "application/json");

  if (!skipAuth) {
    const token = await AsyncStorage.getItem(KEY_ACCESS);
    if (token) hdrs.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${CLOUD_BASE}${path}`, { ...init, headers: hdrs });

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

export const CloudAPI = {
  login(email: string, password: string): Promise<AuthResponse> {
    return apiFetch<AuthResponse>("/auth/login", {
      method: "POST",
      skipAuth: true,
      body: JSON.stringify({ email, password, deviceName: "LUMA App", platform: "web" }),
    });
  },

  register(email: string, password: string, fullName: string): Promise<AuthResponse> {
    return apiFetch<AuthResponse>("/auth/register", {
      method: "POST",
      skipAuth: true,
      body: JSON.stringify({ email, password, fullName, deviceName: "LUMA App", platform: "web" }),
    });
  },

  refresh(refreshToken: string): Promise<AuthResponse> {
    return apiFetch<AuthResponse>("/auth/refresh", {
      method: "POST",
      skipAuth: true,
      body: JSON.stringify({ refreshToken }),
    });
  },

  async logout(refreshToken: string): Promise<void> {
    await apiFetch<unknown>("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }).catch(() => undefined);
  },

  syncPush(
    phoneId: string,
    resources: Array<Omit<SyncResource, "updatedAt" | "deleted">>,
  ): Promise<PushSyncResponse> {
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
    return apiFetch<PullSyncResponse>("/sync/pull", {
      method: "POST",
      body: JSON.stringify({ phoneId, resourceType, lastVersion }),
    });
  },

  async storeAuth(auth: AuthResponse): Promise<void> {
    await Promise.all([
      AsyncStorage.setItem(KEY_ACCESS, auth.accessToken),
      AsyncStorage.setItem(KEY_REFRESH, auth.refreshToken),
      AsyncStorage.setItem(KEY_USER, JSON.stringify(auth.user)),
    ]);
  },

  async clearAuth(): Promise<void> {
    await Promise.all([
      AsyncStorage.removeItem(KEY_ACCESS),
      AsyncStorage.removeItem(KEY_REFRESH),
      AsyncStorage.removeItem(KEY_USER),
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
