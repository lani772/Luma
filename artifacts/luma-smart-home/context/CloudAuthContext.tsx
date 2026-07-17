import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { CloudAPI, type CloudSyncData, type CloudUser } from "@/services/cloud-api";

// ── Context shape ───────────────────────────────────────────────────────────────

interface CloudAuthContextType {
  user: CloudUser | null;
  /** Username stored locally (backend may not echo it back). */
  username: string | null;
  isAuthenticated: boolean;
  /** True while the initial session-restore is in progress. */
  isLoading: boolean;
  /** True while a full data sync is running. */
  isSyncing: boolean;
  /** Last successful sync payload — devices, invitations, access requests. */
  syncData: CloudSyncData | null;
  /**
   * Monotonically increasing counter bumped after every successful sync.
   * Other contexts (LumaContext) watch this to know when to re-read cloud data.
   */
  syncKey: number;

  login: (identifier: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    fullName: string,
    username: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: (password?: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  /** Manually trigger a full cloud sync (e.g. pull-to-refresh). */
  triggerSync: () => Promise<void>;
}

const CloudAuthContext = createContext<CloudAuthContextType | null>(null);

// ── Provider ────────────────────────────────────────────────────────────────────

export function CloudAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]         = useState<CloudUser | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncData, setSyncData]   = useState<CloudSyncData | null>(null);
  const [syncKey, setSyncKey]     = useState(0);

  // ── Restore persisted session on first mount ──────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [storedUser, storedUsername, cached] = await Promise.all([
          CloudAPI.getStoredUser(),
          CloudAPI.getStoredUsername(),
          CloudAPI.getCachedSyncData(),
        ]);
        if (storedUser) {
          setUser(storedUser);
          setUsername(storedUsername);
          if (cached) setSyncData(cached);
        }
      } catch {
        // Storage failure — treat as unauthenticated
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────────

  /** Persist user object and bump the sync key. */
  const _applyUser = useCallback(async (u: CloudUser) => {
    await AsyncStorage.setItem("@luma/cloud_user", JSON.stringify(u));
    setUser(u);
  }, []);

  /** Run a full cloud sync and update local cache. */
  const _runSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      const [freshProfile, data] = await Promise.allSettled([
        CloudAPI.getProfile(),
        CloudAPI.syncAllData(),
      ]);
      if (freshProfile.status === "fulfilled") {
        await _applyUser(freshProfile.value);
      }
      if (data.status === "fulfilled") {
        setSyncData(data.value);
        setSyncKey(k => k + 1);
      }
    } catch {
      // Non-fatal: keep showing cached data
    } finally {
      setIsSyncing(false);
    }
  }, [_applyUser]);

  // ── Public actions ──────────────────────────────────────────────────────────

  const login = useCallback(async (identifier: string, password: string) => {
    const auth = await CloudAPI.login(identifier, password);
    await CloudAPI.storeAuth(auth);

    // Merge stored username (from a previous register on this device)
    const storedUsername = await CloudAPI.getStoredUsername();
    const mergedUser = { ...auth.user, username: auth.user.username ?? storedUsername ?? undefined };
    await _applyUser(mergedUser);
    setUsername(storedUsername);

    // Background sync — don't block navigation
    CloudAPI.syncAllData()
      .then(data => {
        setSyncData(data);
        setSyncKey(k => k + 1);
      })
      .catch(() => {});
  }, [_applyUser]);

  const register = useCallback(async (
    email: string,
    password: string,
    fullName: string,
    username: string,
  ) => {
    const auth = await CloudAPI.register(email, password, fullName, username);
    // Persist username locally (backend may not echo it back yet)
    await Promise.all([
      CloudAPI.storeAuth(auth),
      CloudAPI.storeUsername(username),
    ]);
    const userWithUsername = { ...auth.user, username };
    await _applyUser(userWithUsername);
    setUsername(username);
    // New user — sync immediately so we know they have no devices
    await CloudAPI.syncAllData()
      .then(data => {
        setSyncData(data);
        setSyncKey(k => k + 1);
      })
      .catch(() => {});
  }, [_applyUser]);

  const logout = useCallback(async () => {
    const { refreshToken } = await CloudAPI.getStoredTokens();
    if (refreshToken) await CloudAPI.logout(refreshToken);
    await CloudAPI.clearAuth();
    setUser(null);
    setUsername(null);
    setSyncData(null);
    setSyncKey(0);
  }, []);

  const deleteAccount = useCallback(async (password?: string) => {
    await CloudAPI.deleteAccount(password);
    await CloudAPI.clearAuth();
    setUser(null);
    setUsername(null);
    setSyncData(null);
    setSyncKey(0);
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const fresh = await CloudAPI.getProfile();
      await _applyUser(fresh);
    } catch {
      // Non-fatal
    }
  }, [_applyUser]);

  const triggerSync = _runSync;

  return (
    <CloudAuthContext.Provider
      value={{
        user,
        username,
        isAuthenticated: !!user,
        isLoading,
        isSyncing,
        syncData,
        syncKey,
        login,
        register,
        logout,
        deleteAccount,
        refreshProfile,
        triggerSync,
      }}
    >
      {children}
    </CloudAuthContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────────────

export function useCloudAuth(): CloudAuthContextType {
  const ctx = useContext(CloudAuthContext);
  if (!ctx) throw new Error("useCloudAuth must be used within CloudAuthProvider");
  return ctx;
}
