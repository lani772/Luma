// Database Engine — typed, namespaced on-device persistent storage
// Spec: docs/mobile-core-engine/DatabaseEngine.md
// Generalizes MQTTStorage.ts pattern to the whole app.
// Uses AsyncStorage as the backing store; typed table API over JSON blobs.

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CoreEngineId, EngineHealthInfo } from "./types";
import type { IEngine } from "./types";

const SCHEMA_VERSION = 1;
const NS = "@luma_core";

export interface TableRecord {
  id: string;
  [key: string]: unknown;
}

export interface TableAccessor<T extends TableRecord> {
  getAll(): Promise<T[]>;
  getById(id: string): Promise<T | null>;
  upsert(record: T): Promise<void>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
  count(): Promise<number>;
}

export type KnownTable =
  | "devices"
  | "device_states"
  | "automation_rules"
  | "schedules"
  | "access_requests"
  | "mc_users"
  | "notifications"
  | "discovered_devices"
  | "security_nonces"
  | "extension_state"
  | "firmware_jobs"
  | "session_tokens"
  | "offline_commands";

class TableAccessorImpl<T extends TableRecord> implements TableAccessor<T> {
  private key: string;

  constructor(private name: string) {
    this.key = `${NS}:table:${name}`;
  }

  async getAll(): Promise<T[]> {
    try {
      const raw = await AsyncStorage.getItem(this.key);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as T[];
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.warn(`[DatabaseEngine] getAll(${this.name}) failed:`, err);
      return [];
    }
  }

  async getById(id: string): Promise<T | null> {
    const all = await this.getAll();
    return all.find(r => r.id === id) ?? null;
  }

  async upsert(record: T): Promise<void> {
    try {
      const all = await this.getAll();
      const idx = all.findIndex(r => r.id === record.id);
      if (idx >= 0) all[idx] = record; else all.push(record);
      await AsyncStorage.setItem(this.key, JSON.stringify(all));
    } catch (err) {
      console.error(`[DatabaseEngine] upsert(${this.name}) failed:`, err);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const all = await this.getAll();
      const filtered = all.filter(r => r.id !== id);
      await AsyncStorage.setItem(this.key, JSON.stringify(filtered));
    } catch (err) {
      console.error(`[DatabaseEngine] delete(${this.name}) failed:`, err);
    }
  }

  async clear(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.key);
    } catch (err) {
      console.error(`[DatabaseEngine] clear(${this.name}) failed:`, err);
    }
  }

  async count(): Promise<number> {
    return (await this.getAll()).length;
  }
}

export class DatabaseEngine implements IEngine {
  readonly id: CoreEngineId = "database_engine";
  readonly name = "Local Database Engine";
  readonly version = "1.0.0";
  readonly capabilities = ["persistent-storage", "typed-tables", "kv-store", "migration"];
  readonly dependencies: CoreEngineId[] = [];
  readonly optional = false;

  private _status: import("./types").EngineStatus = "idle";
  private _startedAt: Date | null = null;
  private _errorCount = 0;
  private _lastError: string | null = null;
  private _lastHeartbeat: Date | null = null;
  private _heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private _messagesSent = 0;
  private _messagesReceived = 0;
  private _tables: Map<string, TableAccessorImpl<TableRecord>> = new Map();

  get status() { return this._status; }

  async start(): Promise<void> {
    if (this._status === "running") return;
    this._status = "booting";
    try {
      await this._runMigrations();
      this._heartbeatTimer = setInterval(() => { this._lastHeartbeat = new Date(); }, 5_000);
      this._startedAt = new Date();
      this._status = "running";
    } catch (err) {
      this._status = "error";
      this._lastError = String(err);
      this._errorCount++;
      throw err;
    }
  }

  async stop(): Promise<void> {
    if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
    this._tables.clear();
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

  handleMessage(_message: import("./types").CoreMessage): void { this._messagesReceived++; }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Get a typed table accessor. Creates table on first access. */
  table<T extends TableRecord>(name: KnownTable | string): TableAccessor<T> {
    if (!this._tables.has(name)) {
      this._tables.set(name, new TableAccessorImpl(name));
    }
    return this._tables.get(name)! as TableAccessor<T>;
  }

  /** Simple key-value get with safe default. */
  async get<T>(key: string, defaultValue: T): Promise<T> {
    try {
      const raw = await AsyncStorage.getItem(`${NS}:kv:${key}`);
      if (raw === null) return defaultValue;
      return JSON.parse(raw) as T;
    } catch {
      return defaultValue;
    }
  }

  /** Simple key-value set. */
  async set<T>(key: string, value: T): Promise<void> {
    try {
      await AsyncStorage.setItem(`${NS}:kv:${key}`, JSON.stringify(value));
    } catch (err) {
      this._errorCount++;
      this._lastError = String(err);
      console.error(`[DatabaseEngine] set(${key}) failed:`, err);
    }
  }

  /** Delete a key-value entry. */
  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`${NS}:kv:${key}`);
    } catch (err) {
      console.warn(`[DatabaseEngine] remove(${key}) failed:`, err);
    }
  }

  /** Wipe all data managed by this engine. Use with caution. */
  async clearAll(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const ours = keys.filter(k => k.startsWith(NS));
      await AsyncStorage.multiRemove(ours);
    } catch (err) {
      console.error("[DatabaseEngine] clearAll failed:", err);
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private async _runMigrations(): Promise<void> {
    const currentVersion = await this.get<number>("schema_version", 0);
    if (currentVersion >= SCHEMA_VERSION) return;
    // v0 → v1: initialize all known tables (no-op for fresh installs)
    await this.set("schema_version", SCHEMA_VERSION);
    console.log(`[DatabaseEngine] migrated schema v${currentVersion} → v${SCHEMA_VERSION}`);
  }
}

export const databaseEngine = new DatabaseEngine();
