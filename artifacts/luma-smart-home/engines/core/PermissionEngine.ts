// Permission Engine — role-based access control for all device commands and app actions
// Spec: docs/mobile-core-engine/PermissionEngine.md
// Unifies MQTTPermissions.ts + LumaContext's user/role model.

import type { CoreEngineId, CoreMessage, EngineHealthInfo, IEngine } from "./types";
import type { DatabaseEngine } from "./DatabaseEngine";
import type { EventEngine } from "./EventEngine";

export type AppRole = "owner" | "device_admin" | "full_access" | "partial_access" | "guest";
export type DeviceCommand =
  | "TURN_ON" | "TURN_OFF" | "TOGGLE" | "SET_BRIGHTNESS" | "SET_COLOR" | "SET_COLOR_TEMP"
  | "REBOOT" | "SCHEDULE_CREATE" | "SCHEDULE_EDIT" | "SCHEDULE_DELETE"
  | "FIRMWARE_UPDATE" | "FACTORY_RESET" | "PERMISSION_WRITE" | "ADMIN_PROMOTE"
  | "TIMER_START" | "TIMER_CANCEL" | "AUTOMATION_CREATE" | "AUTOMATION_EDIT";

export type AppAction =
  | "invite_user" | "remove_user" | "approve_request" | "reject_request"
  | "grant_device_access" | "revoke_device_access" | "view_audit_logs"
  | "edit_schedule" | "manage_automation" | "view_energy";

// Command allow-matrix: which roles may issue which commands
const COMMAND_ALLOWLIST: Record<DeviceCommand, AppRole[]> = {
  TURN_ON:           ["owner", "device_admin", "full_access", "partial_access", "guest"],
  TURN_OFF:          ["owner", "device_admin", "full_access", "partial_access", "guest"],
  TOGGLE:            ["owner", "device_admin", "full_access", "partial_access", "guest"],
  SET_BRIGHTNESS:    ["owner", "device_admin", "full_access", "partial_access"],
  SET_COLOR:         ["owner", "device_admin", "full_access"],
  SET_COLOR_TEMP:    ["owner", "device_admin", "full_access"],
  TIMER_START:       ["owner", "device_admin", "full_access", "partial_access"],
  TIMER_CANCEL:      ["owner", "device_admin", "full_access", "partial_access"],
  SCHEDULE_CREATE:   ["owner", "device_admin", "full_access"],
  SCHEDULE_EDIT:     ["owner", "device_admin"],
  SCHEDULE_DELETE:   ["owner", "device_admin"],
  AUTOMATION_CREATE: ["owner", "device_admin"],
  AUTOMATION_EDIT:   ["owner", "device_admin"],
  REBOOT:            ["owner", "device_admin"],
  FIRMWARE_UPDATE:   ["owner"],
  FACTORY_RESET:     ["owner"],
  PERMISSION_WRITE:  ["owner"],
  ADMIN_PROMOTE:     ["owner"],
};

// App-action allow-matrix
const ACTION_ALLOWLIST: Record<AppAction, AppRole[]> = {
  invite_user:          ["owner", "device_admin"],
  remove_user:          ["owner", "device_admin"],
  approve_request:      ["owner", "device_admin"],
  reject_request:       ["owner", "device_admin"],
  grant_device_access:  ["owner", "device_admin"],
  revoke_device_access: ["owner", "device_admin"],
  view_audit_logs:      ["owner", "device_admin"],
  edit_schedule:        ["owner", "device_admin", "full_access"],
  manage_automation:    ["owner", "device_admin"],
  view_energy:          ["owner", "device_admin", "full_access", "partial_access"],
};

export interface PermissionCheckResult {
  allowed: boolean;
  reason: string;
}

export class PermissionEngine implements IEngine {
  readonly id: CoreEngineId = "permission_engine";
  readonly name = "Permission Engine";
  readonly version = "1.0.0";
  readonly capabilities = ["rbac", "device-command-gate", "app-action-gate", "user-management"];
  readonly dependencies: CoreEngineId[] = ["database_engine", "event_engine"];
  readonly optional = false;

  private _status: import("./types").EngineStatus = "idle";
  private _startedAt: Date | null = null;
  private _errorCount = 0;
  private _lastError: string | null = null;
  private _lastHeartbeat: Date | null = null;
  private _heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private _messagesSent = 0;
  private _messagesReceived = 0;

  constructor(private db: DatabaseEngine, private events: EventEngine) {}

  get status() { return this._status; }

  async start(): Promise<void> {
    if (this._status === "running") return;
    this._status = "booting";
    this._heartbeatTimer = setInterval(() => { this._lastHeartbeat = new Date(); }, 5_000);
    this._startedAt = new Date();
    this._status = "running";
  }

  async stop(): Promise<void> {
    if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
    this._status = "stopped";
  }

  getHealth(): EngineHealthInfo {
    return {
      id: this.id, name: this.name, version: this.version,
      status: this._status,
      startedAt: this._startedAt?.toISOString() ?? null,
      uptimeMs: this._startedAt ? Date.now() - this._startedAt.getTime() : 0,
      lastHeartbeatAt: this._lastHeartbeat?.toISOString() ?? null,
      messagesSent: this._messagesSent,
      messagesReceived: this._messagesReceived,
      errorCount: this._errorCount,
      lastError: this._lastError,
    };
  }

  handleMessage(message: CoreMessage): void {
    this._messagesReceived++;
    switch (message.action) {
      case "PERMISSION_CHECK": {
        const { userId, deviceId, command } = message.payload as { userId: string; deviceId: string; command: DeviceCommand };
        void this.canPerformCommand(userId, deviceId, command).then(result => {
          this.events.sendCommand("permission_engine", message.source as CoreEngineId, "PERMISSION_CHECK_RESULT", {
            allowed: result.allowed, reason: result.reason, correlationId: message.id,
          });
        });
        break;
      }
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Check if a user (by userId) can issue a device command. */
  async canPerformCommand(userId: string, deviceId: string, command: DeviceCommand): Promise<PermissionCheckResult> {
    const user = await this._getUser(userId);
    if (!user) return { allowed: false, reason: "User not found" };

    const role = user.role as AppRole;
    const allowedRoles = COMMAND_ALLOWLIST[command];
    if (!allowedRoles) return { allowed: false, reason: "Unknown command" };
    if (!allowedRoles.includes(role)) {
      return { allowed: false, reason: `Role '${role}' cannot issue '${command}'` };
    }

    // Check device-level access (owner always passes)
    if (role !== "owner") {
      const hasAccess = await this._userHasDeviceAccess(userId, deviceId);
      if (!hasAccess) return { allowed: false, reason: `No access to device '${deviceId}'` };
    }

    return { allowed: true, reason: "ok" };
  }

  /** Check if a user can perform an app-level action. */
  canPerformAction(role: AppRole, action: AppAction): PermissionCheckResult {
    const allowedRoles = ACTION_ALLOWLIST[action];
    if (!allowedRoles) return { allowed: false, reason: "Unknown action" };
    return allowedRoles.includes(role)
      ? { allowed: true, reason: "ok" }
      : { allowed: false, reason: `Role '${role}' cannot perform '${action}'` };
  }

  /** Get allowed commands for a role. */
  getAllowedCommands(role: AppRole): DeviceCommand[] {
    return (Object.entries(COMMAND_ALLOWLIST) as [DeviceCommand, AppRole[]][])
      .filter(([, roles]) => roles.includes(role))
      .map(([cmd]) => cmd);
  }

  /** Get allowed app actions for a role. */
  getAllowedActions(role: AppRole): AppAction[] {
    return (Object.entries(ACTION_ALLOWLIST) as [AppAction, AppRole[]][])
      .filter(([, roles]) => roles.includes(role))
      .map(([action]) => action);
  }

  /** Get the role hierarchy rank (lower = more privileged). */
  getRoleRank(role: AppRole): number {
    const ranks: Record<AppRole, number> = {
      owner: 0, device_admin: 1, full_access: 2, partial_access: 3, guest: 4,
    };
    return ranks[role] ?? 99;
  }

  /** Check if actorRole can manage targetRole (can only manage roles of lower privilege). */
  canManageRole(actorRole: AppRole, targetRole: AppRole): boolean {
    return this.getRoleRank(actorRole) < this.getRoleRank(targetRole);
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private async _getUser(userId: string): Promise<{ id: string; role: string } | null> {
    return this.db.table<{ id: string; role: string }>("mc_users").getById(userId);
  }

  private async _userHasDeviceAccess(userId: string, deviceId: string): Promise<boolean> {
    const user = await this.db.table<{ id: string; deviceAccess: { deviceId: string }[] }>("mc_users").getById(userId);
    if (!user || !Array.isArray(user.deviceAccess)) return false;
    return user.deviceAccess.some((d) => d.deviceId === deviceId);
  }
}
