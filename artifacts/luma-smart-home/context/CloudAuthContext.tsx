import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { CloudAPI, type CloudUser } from "@/services/cloud-api";

interface CloudAuthContextType {
  user: CloudUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => Promise<void>;
}

const CloudAuthContext = createContext<CloudAuthContextType | null>(null);

export function CloudAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<CloudUser | null>(null);
  const [isLoading, setLoading] = useState(true);

  useEffect(() => {
    CloudAPI.getStoredUser()
      .then(u => setUser(u))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const auth = await CloudAPI.login(email, password);
    await CloudAPI.storeAuth(auth);
    setUser(auth.user);
  }, []);

  const register = useCallback(async (email: string, password: string, fullName: string) => {
    const auth = await CloudAPI.register(email, password, fullName);
    await CloudAPI.storeAuth(auth);
    setUser(auth.user);
  }, []);

  const logout = useCallback(async () => {
    const { refreshToken } = await CloudAPI.getStoredTokens();
    if (refreshToken) await CloudAPI.logout(refreshToken);
    await CloudAPI.clearAuth();
    setUser(null);
  }, []);

  return (
    <CloudAuthContext.Provider
      value={{ user, isAuthenticated: !!user, isLoading, login, register, logout }}
    >
      {children}
    </CloudAuthContext.Provider>
  );
}

export function useCloudAuth(): CloudAuthContextType {
  const ctx = useContext(CloudAuthContext);
  if (!ctx) throw new Error("useCloudAuth must be used within CloudAuthProvider");
  return ctx;
}
