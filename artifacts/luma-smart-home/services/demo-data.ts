/**
 * Demo mode – offline mock data that replaces all cloud API calls.
 * Credentials: demo@luma.app / demo1234
 */
import type {
  AuthResponse,
  CloudAccessRequest,
  CloudDevice,
  CloudInvitation,
  CloudSession,
  CloudSyncData,
  CloudUser,
  PullSyncResponse,
  PushSyncResponse,
} from "./cloud-api";

// ── Demo credentials ─────────────────────────────────────────────────────────

export const DEMO_EMAIL    = "demo@luma.app";
export const DEMO_PASSWORD = "demo1234";
export const DEMO_USERNAME = "demo_user";

// ── Demo user ────────────────────────────────────────────────────────────────

export const DEMO_USER: CloudUser = {
  id:               "demo-user-001",
  email:            DEMO_EMAIL,
  fullName:         "Demo User",
  username:         DEMO_USERNAME,
  role:             "owner",
  emailVerified:    true,
  subscriptionTier: "pro",
  createdAt:        "2025-01-01T00:00:00.000Z",
  lastLoginAt:      new Date().toISOString(),
  preferences:      { theme: "dark", notifications: true },
};

// ── Auth response ─────────────────────────────────────────────────────────────

export const DEMO_AUTH: AuthResponse = {
  accessToken:           "demo-access-token",
  accessTokenExpiresAt:  new Date(Date.now() + 86_400_000 * 365).toISOString(),
  refreshToken:          "demo-refresh-token",
  refreshTokenExpiresAt: new Date(Date.now() + 86_400_000 * 3650).toISOString(),
  user:                  DEMO_USER,
  sessionId:             "demo-session-001",
};

// ── Devices ───────────────────────────────────────────────────────────────────

export const DEMO_DEVICES: CloudDevice[] = [
  {
    id: "dev-001", name: "Living Room Hub", description: "Main LUMA controller",
    model: "LUMA-MC-PRO", mac: "AA:BB:CC:DD:EE:01", deviceId: "luma-mc-001",
    ownerId: "demo-user-001", status: "active",
    registeredAt: "2025-01-15T10:00:00.000Z",
    lastConnectedAt: new Date().toISOString(),
    firmwareVersion: "2.4.1",
  },
  {
    id: "dev-002", name: "Bedroom Hub", description: "Bedroom smart controller",
    model: "LUMA-MC-MINI", mac: "AA:BB:CC:DD:EE:02", deviceId: "luma-mc-002",
    ownerId: "demo-user-001", status: "active",
    registeredAt: "2025-02-10T14:00:00.000Z",
    lastConnectedAt: new Date(Date.now() - 300_000).toISOString(),
    firmwareVersion: "2.3.9",
  },
  {
    id: "dev-003", name: "Kitchen Node", description: "Kitchen area controller",
    model: "LUMA-MC-MINI", mac: "AA:BB:CC:DD:EE:03", deviceId: "luma-mc-003",
    ownerId: "demo-user-001", status: "active",
    registeredAt: "2025-03-05T09:00:00.000Z",
    lastConnectedAt: new Date(Date.now() - 3_600_000).toISOString(),
    firmwareVersion: "2.4.0",
  },
];

// ── Invitations ───────────────────────────────────────────────────────────────

export const DEMO_RECEIVED_INVITATIONS: CloudInvitation[] = [
  {
    id: "inv-recv-001", fromUserId: "user-abc", fromUserName: "Alice M.",
    toEmail: DEMO_EMAIL, deviceId: "dev-ext-001", deviceName: "Office Hub",
    permissions: ["view", "control"], expiresAt: new Date(Date.now() + 86_400_000 * 5).toISOString(),
    status: "pending", message: "Join my office LUMA network!",
    createdAt: new Date(Date.now() - 7_200_000).toISOString(),
  },
];

export const DEMO_SENT_INVITATIONS: CloudInvitation[] = [
  {
    id: "inv-sent-001", fromUserId: "demo-user-001", fromUserName: "Demo User",
    toEmail: "bob@example.com", deviceId: "dev-001", deviceName: "Living Room Hub",
    permissions: ["view"], expiresAt: new Date(Date.now() + 86_400_000 * 7).toISOString(),
    status: "pending", createdAt: new Date(Date.now() - 3_600_000).toISOString(),
  },
];

// ── Access requests ───────────────────────────────────────────────────────────

export const DEMO_ACCESS_REQUESTS: CloudAccessRequest[] = [
  {
    id: "req-001", requesterId: "user-xyz", requesterName: "Charlie P.",
    requesterEmail: "charlie@example.com", deviceId: "dev-001",
    deviceName: "Living Room Hub", permissionLevel: "member",
    message: "Can I access the living room lights?",
    status: "pending", requestedAt: new Date(Date.now() - 1_800_000).toISOString(),
  },
];

// ── Sessions ──────────────────────────────────────────────────────────────────

export const DEMO_SESSIONS: CloudSession[] = [
  {
    id: "demo-session-001", deviceName: "LUMA Mobile App",
    platform: "android", lastUsedAt: new Date().toISOString(), current: true,
  },
  {
    id: "demo-session-002", deviceName: "LUMA Web Browser",
    platform: "web", lastUsedAt: new Date(Date.now() - 86_400_000).toISOString(), current: false,
  },
];

// ── Sync data ─────────────────────────────────────────────────────────────────

export function makeDemoSyncData(): CloudSyncData {
  return {
    devices:        DEMO_DEVICES,
    invitations:    DEMO_RECEIVED_INVITATIONS,
    accessRequests: DEMO_ACCESS_REQUESTS,
    syncedAt:       new Date().toISOString(),
  };
}

export const DEMO_PUSH_SYNC: PushSyncResponse  = { conflicts: [], success: true };
export const DEMO_PULL_SYNC: PullSyncResponse  = { resources: [], currentVersion: 1 };
