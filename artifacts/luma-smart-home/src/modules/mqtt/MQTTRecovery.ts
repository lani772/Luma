/**
 * MQTTRecovery — reconnect/backoff supervisor shared by every MQTTConnection.
 * On a successful reconnect it fires `onReconnected`, which callers wire up
 * to MQTTSync + MQTTQueue.drain so nothing has to remember to do that
 * per-channel.
 */

export function computeBackoffMs(attempt: number, baseMs = 1000, capMs = 30_000): number {
  const exp = Math.min(capMs, baseMs * Math.pow(2, attempt));
  const jitter = exp * (0.15 * (Math.random() - 0.5) * 2); // ±15% jitter
  return Math.max(baseMs, Math.round(exp + jitter));
}

export type ConnectFn = () => Promise<boolean>;

export class ReconnectSupervisor {
  private attempt = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private stopped = false;
  private connecting = false;

  constructor(
    private readonly connectFn: ConnectFn,
    private readonly onReconnected: () => void,
    private readonly label: string = "channel",
  ) {}

  /** Kick off connection immediately, then keep retrying with backoff on failure. */
  start(): void {
    this.stopped = false;
    void this.attemptConnect();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }

  /** Call when the transport reports an unexpected disconnect. */
  notifyDropped(): void {
    if (this.stopped || this.connecting) return;
    this.scheduleRetry();
  }

  getAttempt(): number {
    return this.attempt;
  }

  private async attemptConnect(): Promise<void> {
    if (this.stopped || this.connecting) return;
    this.connecting = true;
    try {
      const ok = await this.connectFn();
      if (ok) {
        const wasRetrying = this.attempt > 0;
        this.attempt = 0;
        if (wasRetrying) this.onReconnected();
        else this.onReconnected(); // also fire on first successful connect, for initial sync
      } else {
        this.scheduleRetry();
      }
    } catch (err) {
      console.error(`[MQTTRecovery:${this.label}] connect threw`, err);
      this.scheduleRetry();
    } finally {
      this.connecting = false;
    }
  }

  private scheduleRetry(): void {
    if (this.stopped) return;
    const delay = computeBackoffMs(this.attempt);
    this.attempt += 1;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.attemptConnect(), delay);
  }
}
