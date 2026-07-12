// TransportManager — priority-ordered failover across all ITransport adapters.
//
// Any engine that needs to send a command calls `sendWithFallback()`.
// The manager tries each transport in ascending priority order, stopping at the
// first success. If every channel fails, the returned result has sent=false and
// the caller should enqueue via SynchronizationEngine.
//
// Adding a new transport (Matter, Thread, Zigbee, USB) is a one-line change:
// pass a new ITransport implementation to the constructor — no other code needs
// to change.

import type { ITransport, TransportStatus } from "./ITransport";

export interface SendResult {
  /** Whether any transport successfully accepted the message. */
  sent: boolean;
  /** The transport that delivered the message, or null if all failed. */
  via: string | null;
  /** Transports that were tried before the successful one (or all of them on total failure). */
  tried: string[];
}

export interface TransportManagerStatus {
  activeTransport: string | null;
  transports: TransportStatus[];
}

export class TransportManager {
  /** Sorted by ascending priority (lower = better). */
  private _transports: ITransport[];

  constructor(transports: ITransport[]) {
    this._transports = [...transports].sort((a, b) => a.priority - b.priority);
  }

  /**
   * Attempt delivery on each transport in priority order.
   * Stops as soon as one succeeds. Never throws.
   */
  async sendWithFallback(topic: string, payload: unknown): Promise<SendResult> {
    const tried: string[] = [];

    for (const transport of this._transports) {
      // Ensure connected before sending
      if (!transport.isConnected()) {
        const ok = await this._tryConnect(transport);
        if (!ok) { tried.push(transport.name); continue; }
      }

      tried.push(transport.name);
      let sent = false;
      try {
        sent = await transport.send(topic, payload);
      } catch (err) {
        console.warn(`[TransportManager] ${transport.name} threw during send:`, err);
      }

      if (sent) {
        return { sent: true, via: transport.name, tried };
      }

      // This transport failed — mark it disconnected so the next cycle re-probes
      await this._safeDisconnect(transport);
    }

    return { sent: false, via: null, tried };
  }

  /**
   * Refresh connection state for all transports.
   * Call this once after a background→foreground transition or when
   * connectivity status changes.
   */
  async refreshAll(): Promise<void> {
    await Promise.allSettled(
      this._transports.map(t => this._tryConnect(t))
    );
  }

  /** Current status of every registered transport for diagnostics UI. */
  getStatus(): TransportManagerStatus {
    const statuses = this._transports.map(t => t.getStatus());
    const active = statuses.find(s => s.state === "connected") ?? null;
    return {
      activeTransport: active?.name ?? null,
      transports: statuses,
    };
  }

  /**
   * The name of the highest-priority currently-connected transport.
   * Returns null when fully offline.
   */
  getActiveTransportName(): string | null {
    for (const t of this._transports) {
      if (t.isConnected()) return t.name;
    }
    return null;
  }

  /**
   * Clean up all transports (timers, subscriptions).
   * Call this when the owning engine stops.
   */
  dispose(): void {
    for (const t of this._transports) {
      try { t.dispose?.(); } catch {}
    }
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private async _tryConnect(transport: ITransport): Promise<boolean> {
    try {
      return await transport.connect();
    } catch {
      return false;
    }
  }

  private async _safeDisconnect(transport: ITransport): Promise<void> {
    try {
      await transport.disconnect();
    } catch {}
  }
}
