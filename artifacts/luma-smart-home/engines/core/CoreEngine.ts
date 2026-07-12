// Core Engine — root runtime orchestrator
// Spec: docs/mobile-core-engine/CoreEngine.md
// Boots all engines in dependency order, provides ServiceLocator, manages AppState lifecycle.

import { AppState, type AppStateStatus } from "react-native";
import type { CoreEngineId, EngineHealthInfo, IEngine, EngineManifestEntry } from "./types";
import { CORE_EVENTS } from "./types";

import { EventEngine, eventEngine } from "./EventEngine";
import { DatabaseEngine, databaseEngine } from "./DatabaseEngine";
import { SecurityEngine } from "./SecurityEngine";
import { PermissionEngine } from "./PermissionEngine";
import { NotificationEngine } from "./NotificationEngine";
import { AutomationEngine } from "./AutomationEngine";
import { DeviceManagementEngine } from "./DeviceManagementEngine";
import { DiscoveryEngine } from "./DiscoveryEngine";
import { DashboardEngine } from "./DashboardEngine";
import { FirmwareEngine } from "./FirmwareEngine";
import { MQTTCommunicationEngine } from "./MQTTCommunicationEngine";
import { ExtensionEngine } from "./ExtensionEngine";
import { SynchronizationEngine } from "./SynchronizationEngine";

export type CoreState = "idle" | "booting" | "ready" | "degraded" | "backgrounded" | "shutting_down" | "shutdown";

export class CoreEngineClass {
  private _state: CoreState = "idle";
  private _bootPromise: Promise<void> | null = null;
  private _bootStartedAt: number | null = null;
  private _readyCallbacks: Array<() => void> = [];
  private _appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;
  private _capabilities: Map<string, unknown> = new Map();

  // ── Engine singletons ──────────────────────────────────────────────────────
  readonly events: EventEngine = eventEngine;
  readonly database: DatabaseEngine = databaseEngine;
  readonly security: SecurityEngine = new SecurityEngine(databaseEngine);
  readonly permissions: PermissionEngine = new PermissionEngine(databaseEngine, eventEngine);
  readonly notifications: NotificationEngine = new NotificationEngine(eventEngine);
  readonly automation: AutomationEngine = new AutomationEngine(eventEngine, databaseEngine);
  readonly deviceManagement: DeviceManagementEngine = new DeviceManagementEngine(eventEngine, databaseEngine);
  readonly discovery: DiscoveryEngine = new DiscoveryEngine(eventEngine, databaseEngine);
  readonly dashboard: DashboardEngine = new DashboardEngine(eventEngine, this.deviceManagement as DeviceManagementEngine, this.discovery as DiscoveryEngine);
  readonly firmware: FirmwareEngine = new FirmwareEngine(eventEngine, databaseEngine);
  readonly mqtt: MQTTCommunicationEngine = new MQTTCommunicationEngine(eventEngine, databaseEngine);
  readonly extensions: ExtensionEngine = new ExtensionEngine(eventEngine, databaseEngine);
  // SynchronizationEngine receives SecurityEngine so drain() can obtain fresh signatures.
  readonly sync: SynchronizationEngine = new SynchronizationEngine(eventEngine, databaseEngine, this.security);

  // Boot order per spec: Database → Security → Event → Discovery/Comms → DevMgmt → everything else
  private get _bootSequence(): IEngine[][] {
    return [
      // Wave 0: Foundation (no deps)
      [this.database, this.events],
      // Wave 1: Security + Extension (depend on Database+Event)
      [this.security, this.extensions],
      // Wave 2: Permissions, MQTT, Discovery, Sync (depend on Security/Database/Event)
      [this.permissions, this.mqtt, this.discovery, this.sync],
      // Wave 3: Device Management (depends on MQTT + Discovery + Sync)
      [this.deviceManagement],
      // Wave 4: Higher-level engines
      [this.notifications, this.automation, this.firmware, this.dashboard],
    ];
  }

  private get _shutdownOrder(): IEngine[] {
    return [
      this.dashboard, this.firmware, this.automation, this.notifications,
      this.deviceManagement, this.sync, this.discovery, this.mqtt, this.permissions,
      this.extensions, this.security, this.events, this.database,
    ];
  }

  get state(): CoreState { return this._state; }
  get isReady(): boolean { return this._state === "ready" || this._state === "degraded" || this._state === "backgrounded"; }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Boot all engines. Idempotent — second call awaits the first if still in-flight. */
  async boot(): Promise<void> {
    if (this._state === "ready" || this._state === "degraded") return;
    if (this._bootPromise) return this._bootPromise;

    this._bootPromise = this._doBoot();
    try {
      await this._bootPromise;
    } finally {
      this._bootPromise = null;
    }
  }

  /** Shut down all engines in reverse dependency order. Never throws. */
  async shutdown(): Promise<void> {
    if (this._state === "shutdown" || this._state === "shutting_down") return;
    this._state = "shutting_down";
    this._appStateSubscription?.remove();

    for (const engine of this._shutdownOrder) {
      try {
        await engine.stop();
      } catch (err) {
        console.error(`[CoreEngine] failed to stop ${engine.id}:`, err);
      }
    }

    this.events.emit("system", CORE_EVENTS.SHUTDOWN, {});
    this._state = "shutdown";
  }

  /** Get health info for every registered engine. */
  getEngineStatuses(): EngineHealthInfo[] {
    return this._allEngines().map(e => e.getHealth());
  }

  /** Dependency-injection lookup by capability string. Returns null if not available. */
  locate<T>(capability: string): T | null {
    return (this._capabilities.get(capability) as T) ?? null;
  }

  /** Register a callback to fire once (or immediately) when CoreEngine is ready. */
  onReady(cb: () => void): () => void {
    if (this.isReady) { cb(); return () => {}; }
    this._readyCallbacks.push(cb);
    return () => {
      const idx = this._readyCallbacks.indexOf(cb);
      if (idx >= 0) this._readyCallbacks.splice(idx, 1);
    };
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private async _doBoot(): Promise<void> {
    this._state = "booting";
    this._bootStartedAt = Date.now();
    let hasDegraded = false;

    this.events.emit("system", CORE_EVENTS.BOOT_STARTED, {
      manifestSize: this._allEngines().length,
    });

    // Load extension manifest so ExtensionEngine knows what's registered
    const manifest = this._buildManifest();

    for (const wave of this._bootSequence) {
      const waveResults = await Promise.allSettled(
        wave.map(engine => this._bootEngine(engine))
      );
      for (const result of waveResults) {
        if (result.status === "rejected") hasDegraded = true;
      }
    }

    // Wire up capabilities for ServiceLocator
    this._registerCapabilities();

    // Load extension state (enable/disable table)
    this.extensions.loadManifest(manifest);

    this._state = hasDegraded ? "degraded" : "ready";
    const bootDurationMs = Date.now() - (this._bootStartedAt ?? Date.now());

    this.events.emit("system", CORE_EVENTS.READY, {
      bootDurationMs,
      extensionCount: this._allEngines().length,
    });

    this._readyCallbacks.forEach(cb => { try { cb(); } catch {} });
    this._readyCallbacks = [];

    this._setupAppStateListener();
  }

  private async _bootEngine(engine: IEngine): Promise<void> {
    // Check if engine is disabled via ExtensionEngine
    if (engine.id !== "extension_engine" && engine.id !== "database_engine" && engine.id !== "event_engine") {
      if (!this.extensions.isEnabled(engine.id)) {
        console.log(`[CoreEngine] ${engine.id} is disabled, skipping`);
        return;
      }
    }

    const BOOT_TIMEOUT_MS = 10_000;
    const timer = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Boot timeout: ${engine.id}`)), BOOT_TIMEOUT_MS)
    );

    try {
      await Promise.race([engine.start(), timer]);
      console.log(`[CoreEngine] ${engine.id} started`);
    } catch (err) {
      const msg = String(err);
      console.error(`[CoreEngine] ${engine.id} failed to start:`, msg);
      this.extensions.recordError(engine.id, msg);
      this.events.emit("system", CORE_EVENTS.EXTENSION_FAILED, { engineId: engine.id, error: msg });

      if (!engine.optional) {
        // Required engine failure: retry once after 2s
        await new Promise(r => setTimeout(r, 2_000));
        try {
          await engine.start();
          console.log(`[CoreEngine] ${engine.id} started on retry`);
        } catch (retryErr) {
          throw retryErr; // propagate — will mark boot as degraded
        }
      }
    }
  }

  private _setupAppStateListener(): void {
    this._appStateSubscription = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (nextState === "background" || nextState === "inactive") {
        this._state = "backgrounded";
        this.events.emit("system", CORE_EVENTS.BACKGROUNDED, {});
        // Pause non-critical engines to save resources
        void this.dashboard.pause?.();
        void this.automation.pause?.();
      } else if (nextState === "active") {
        if (this._state === "backgrounded") {
          this._state = "ready";
          this.events.emit("system", CORE_EVENTS.FOREGROUNDED, {});
          void this.dashboard.resume?.();
          void this.automation.resume?.();
          // Re-check connections after background
          void this.discovery.resume?.();
        }
      }
    });
  }

  private _registerCapabilities(): void {
    this._capabilities.set("command-signing", {
      sign: this.security.signCommand.bind(this.security),
      verify: this.security.verifyCommand.bind(this.security),
    });
    this._capabilities.set("permission-check", this.permissions);
    this._capabilities.set("notification-push", this.notifications.push.bind(this.notifications));
    this._capabilities.set("device-command", this.deviceManagement.sendCommand.bind(this.deviceManagement));
    this._capabilities.set("event-bus", this.events);
    this._capabilities.set("database", this.database);
    this._capabilities.set("offline-queue", {
      enqueue: this.sync.enqueue.bind(this.sync),
      drain:   this.sync.drain.bind(this.sync),
      syncAll: this.sync.syncAll.bind(this.sync),
      size:    this.sync.size.bind(this.sync),
    });
  }

  private _buildManifest(): EngineManifestEntry[] {
    return this._allEngines().map(e => ({
      id: e.id,
      name: e.name,
      version: e.version,
      capabilities: e.capabilities,
      dependencies: e.dependencies,
      optional: e.optional,
    }));
  }

  private _allEngines(): IEngine[] {
    return [
      this.database, this.events, this.security, this.extensions,
      this.permissions, this.mqtt, this.discovery, this.sync, this.deviceManagement,
      this.notifications, this.automation, this.firmware, this.dashboard,
    ];
  }
}

// Singleton — import this anywhere
export const CoreEngine = new CoreEngineClass();
