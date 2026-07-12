// Automation Engine — trigger evaluation and action dispatch
// Spec: docs/mobile-core-engine/AutomationEngine.md
// Moves automation from UI-layer state (LumaContext) to a real evaluator engine.

import type { CoreEngineId, CoreMessage, EngineHealthInfo, IEngine } from "./types";
import type { EventEngine } from "./EventEngine";
import type { DatabaseEngine } from "./DatabaseEngine";

export type TriggerType = "time" | "device_state" | "schedule" | "scene" | "sensor" | "manual";
export type ActionType = "device_command" | "scene_activate" | "notification" | "webhook";

export interface AutomationTrigger {
  type: TriggerType;
  // time trigger
  time?: string;           // "HH:mm"
  days?: string[];         // ["Mon","Tue",...] — undefined = every day
  sunOffset?: number;      // minutes offset from sunrise/sunset
  sunEvent?: "sunrise" | "sunset";
  // device_state trigger
  deviceId?: string;
  stateKey?: string;       // e.g. "on", "brightness"
  stateValue?: unknown;
  operator?: "eq" | "gt" | "lt" | "neq";
}

export interface AutomationAction {
  type: ActionType;
  deviceId?: string;
  command?: string;
  commandPayload?: Record<string, unknown>;
  sceneId?: string;
  notificationTitle?: string;
  webhookUrl?: string;
}

export interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;         // lower = higher priority
  trigger: AutomationTrigger;
  conditions?: AutomationTrigger[]; // all must be true
  action: AutomationAction;
  lastFiredAt?: number;
  cooldownMs?: number;      // minimum ms between firings
}

const EVAL_INTERVAL_MS = 30_000; // evaluate time triggers every 30s

export class AutomationEngine implements IEngine {
  readonly id: CoreEngineId = "automation_engine";
  readonly name = "Automation Engine";
  readonly version = "1.0.0";
  readonly capabilities = ["automation-rules", "trigger-evaluation", "action-dispatch", "priority-resolution"];
  readonly dependencies: CoreEngineId[] = ["event_engine", "database_engine"];
  readonly optional = true;

  private _status: import("./types").EngineStatus = "idle";
  private _startedAt: Date | null = null;
  private _errorCount = 0;
  private _lastError: string | null = null;
  private _lastHeartbeat: Date | null = null;
  private _heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private _evalTimer: ReturnType<typeof setInterval> | null = null;
  private _messagesSent = 0;
  private _messagesReceived = 0;

  private _rules: Map<string, AutomationRule> = new Map();
  private _deviceStateCache: Map<string, Record<string, unknown>> = new Map();
  private _unsubscribe: (() => void) | null = null;
  private _paused = false;

  constructor(private events: EventEngine, private db: DatabaseEngine) {}

  get status() { return this._status; }

  async start(): Promise<void> {
    if (this._status === "running") return;
    this._status = "booting";
    await this._loadRules();

    // Subscribe to device state changes for state-trigger evaluation
    this._unsubscribe = this.events.subscribeAction("DEVICE_STATE_CHANGED", (msg) => {
      const { deviceId, state } = msg.payload as { deviceId: string; state: Record<string, unknown> };
      if (deviceId && state) {
        this._deviceStateCache.set(deviceId, state);
        void this._evaluateStateTriggers(deviceId);
      }
    });

    // Evaluate time-based triggers on an interval
    this._evalTimer = setInterval(() => {
      if (!this._paused) void this._evaluateTimeTriggers();
    }, EVAL_INTERVAL_MS);

    this._heartbeatTimer = setInterval(() => { this._lastHeartbeat = new Date(); }, 5_000);
    this._startedAt = new Date();
    this._status = "running";
  }

  async stop(): Promise<void> {
    if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
    if (this._evalTimer) clearInterval(this._evalTimer);
    this._unsubscribe?.();
    await this._persistRules();
    this._status = "stopped";
  }

  async pause(): Promise<void> {
    this._paused = true;
    this._status = "paused";
  }

  async resume(): Promise<void> {
    this._paused = false;
    this._status = "running";
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
      case "AUTOMATION_ADD":
        this.addRule(message.payload as unknown as AutomationRule);
        break;
      case "AUTOMATION_UPDATE":
        this.updateRule(message.payload.id as string, message.payload as Partial<AutomationRule>);
        break;
      case "AUTOMATION_DELETE":
        this.deleteRule(message.payload.id as string);
        break;
      case "AUTOMATION_TOGGLE":
        this.toggleRule(message.payload.id as string);
        break;
      case "AUTOMATION_FIRE_MANUAL":
        void this._fireRule(message.payload.id as string, "manual");
        break;
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  getRules(): AutomationRule[] {
    return [...this._rules.values()].sort((a, b) => a.priority - b.priority);
  }

  getRulesForDevice(deviceId: string): AutomationRule[] {
    return this.getRules().filter(r => r.trigger.deviceId === deviceId || r.action.deviceId === deviceId);
  }

  addRule(rule: AutomationRule): void {
    this._rules.set(rule.id, rule);
    void this._persistRules();
    this.events.emit("automation_engine", "AUTOMATION_RULE_ADDED", { ruleId: rule.id, name: rule.name });
    this._messagesSent++;
  }

  updateRule(id: string, patch: Partial<AutomationRule>): void {
    const existing = this._rules.get(id);
    if (!existing) return;
    this._rules.set(id, { ...existing, ...patch });
    void this._persistRules();
  }

  deleteRule(id: string): void {
    this._rules.delete(id);
    void this._persistRules();
    this.events.emit("automation_engine", "AUTOMATION_RULE_DELETED", { ruleId: id });
    this._messagesSent++;
  }

  toggleRule(id: string): void {
    const rule = this._rules.get(id);
    if (rule) this._rules.set(id, { ...rule, enabled: !rule.enabled });
    void this._persistRules();
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private async _evaluateTimeTriggers(): Promise<void> {
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const dayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][now.getDay()];

    for (const rule of this._rules.values()) {
      if (!rule.enabled || rule.trigger.type !== "time") continue;
      if (rule.trigger.time !== hhmm) continue;
      if (rule.trigger.days && !rule.trigger.days.includes(dayName)) continue;
      if (!this._respectsCooldown(rule)) continue;
      await this._fireRule(rule.id, "time");
    }
  }

  private async _evaluateStateTriggers(deviceId: string): Promise<void> {
    const state = this._deviceStateCache.get(deviceId);
    if (!state) return;

    // Collect all state-trigger rules for this device, sorted by priority
    const candidates = [...this._rules.values()]
      .filter(r => r.enabled && r.trigger.type === "device_state" && r.trigger.deviceId === deviceId)
      .sort((a, b) => a.priority - b.priority);

    for (const rule of candidates) {
      if (!this._evaluateTriggerCondition(rule.trigger, state)) continue;
      if (!this._respectsCooldown(rule)) continue;
      // Prevent feedback: mark as fired BEFORE dispatching action
      this._rules.set(rule.id, { ...rule, lastFiredAt: Date.now() });
      await this._fireRule(rule.id, "device_state");
      break; // highest priority wins for conflicting rules on same trigger
    }
  }

  private _evaluateTriggerCondition(trigger: AutomationTrigger, state: Record<string, unknown>): boolean {
    if (!trigger.stateKey) return false;
    const actual = state[trigger.stateKey];
    switch (trigger.operator ?? "eq") {
      case "eq":  return actual === trigger.stateValue;
      case "neq": return actual !== trigger.stateValue;
      case "gt":  return typeof actual === "number" && typeof trigger.stateValue === "number" && actual > trigger.stateValue;
      case "lt":  return typeof actual === "number" && typeof trigger.stateValue === "number" && actual < trigger.stateValue;
      default: return false;
    }
  }

  private _respectsCooldown(rule: AutomationRule): boolean {
    if (!rule.lastFiredAt || !rule.cooldownMs) return true;
    return Date.now() - rule.lastFiredAt >= rule.cooldownMs;
  }

  private async _fireRule(ruleId: string, triggerType: string): Promise<void> {
    const rule = this._rules.get(ruleId);
    if (!rule) return;
    this._rules.set(ruleId, { ...rule, lastFiredAt: Date.now() });
    this.events.emit("automation_engine", "AUTOMATION_RULE_FIRED", {
      ruleId, ruleName: rule.name, triggerType, action: rule.action,
    });
    this._messagesSent++;
    // Device Management Engine will pick up AUTOMATION_RULE_FIRED and execute the action
  }

  private async _loadRules(): Promise<void> {
    try {
      const stored = await this.db.table<AutomationRule & { id: string }>("automation_rules").getAll();
      stored.forEach(r => this._rules.set(r.id, r));
    } catch (err) {
      console.warn("[AutomationEngine] failed to load rules:", err);
    }
  }

  private async _persistRules(): Promise<void> {
    try {
      const table = this.db.table<AutomationRule & { id: string }>("automation_rules");
      await table.clear();
      for (const rule of this._rules.values()) await table.upsert(rule);
    } catch (err) {
      console.warn("[AutomationEngine] failed to persist rules:", err);
    }
  }
}
