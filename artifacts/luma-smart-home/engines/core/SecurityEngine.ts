// Security Engine — command signing, key management, replay protection
// Spec: docs/mobile-core-engine/SecurityEngine.md
// Generalizes MQTTSecurity.ts to the whole app.
// Uses expo-crypto for SHA-256 hashing (keyed hash, NOT HMAC — documented explicitly).

import * as Crypto from "expo-crypto";
import type { CoreEngineId, EngineHealthInfo } from "./types";
import type { IEngine } from "./types";
import type { DatabaseEngine } from "./DatabaseEngine";

const NONCE_TTL_MS = 5 * 60 * 1_000; // 5 minutes
const MAX_NONCES_PER_DEVICE = 200;

export interface DeviceKeys {
  deviceId: string;
  ownerKeyHash: string;
  adminKeyHash: string;
  registrationKeyHash: string;
}

export interface SignedCommand {
  payload: string;       // JSON-stringified command
  nonce: string;
  timestamp: string;
  signature: string;     // keyed-SHA256(payload+nonce+timestamp+key) — NOT HMAC
}

export interface DeviceToken {
  // JWT-shaped structure. NOT a real JWT. Not interoperable with a standard JWT verifier.
  header: string;    // base64({"alg":"LUMA-KH256","typ":"DT"})
  payload: string;   // base64({"deviceId","issuedAt","expiresAt","role"})
  signature: string; // base64(keyed-SHA256(header.payload, sessionKey))
}

function base64url(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export class SecurityEngine implements IEngine {
  readonly id: CoreEngineId = "security_engine";
  readonly name = "Security Engine";
  readonly version = "1.0.0";
  readonly capabilities = ["command-signing", "key-management", "replay-protection", "token-issuance"];
  readonly dependencies: CoreEngineId[] = ["database_engine"];
  readonly optional = false;

  private _status: import("./types").EngineStatus = "idle";
  private _startedAt: Date | null = null;
  private _errorCount = 0;
  private _lastError: string | null = null;
  private _lastHeartbeat: Date | null = null;
  private _heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private _messagesSent = 0;
  private _messagesReceived = 0;

  // In-memory nonce registry: deviceId → Set<nonce>
  private _nonces: Map<string, Map<string, number>> = new Map(); // nonce → expiresAt

  constructor(private db: DatabaseEngine) {}

  get status() { return this._status; }

  async start(): Promise<void> {
    if (this._status === "running") return;
    this._status = "booting";
    try {
      await this._loadNonces();
      this._heartbeatTimer = setInterval(() => {
        this._lastHeartbeat = new Date();
        this._pruneExpiredNonces();
      }, 30_000);
      this._startedAt = new Date();
      this._status = "running";
    } catch (err) {
      this._status = "error"; this._lastError = String(err); this._errorCount++;
      throw err;
    }
  }

  async stop(): Promise<void> {
    if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
    await this._persistNonces();
    this._nonces.clear();
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

  /** Generate a new secure random key (hex string, 32 bytes). */
  async generateKey(): Promise<string> {
    const bytes = await Crypto.getRandomBytesAsync(32);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
  }

  /** Hash a plaintext key with a device-specific salt (keyed SHA-256). NOT HMAC. */
  async hashKey(plaintext: string, deviceId: string): Promise<string> {
    const input = `${deviceId}:${plaintext}`;
    return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input);
  }

  /** Register a device by minting and hashing three keys. Returns the plaintext keys (show once). */
  async registerDevice(deviceId: string): Promise<{ ownerKey: string; adminKey: string; registrationKey: string }> {
    const [ownerKey, adminKey, registrationKey] = await Promise.all([
      this.generateKey(), this.generateKey(), this.generateKey(),
    ]);
    const [ownerKeyHash, adminKeyHash, registrationKeyHash] = await Promise.all([
      this.hashKey(ownerKey, deviceId),
      this.hashKey(adminKey, deviceId),
      this.hashKey(registrationKey, deviceId),
    ]);
    const keys: DeviceKeys = { deviceId, ownerKeyHash, adminKeyHash, registrationKeyHash };
    await this.db.table<DeviceKeys & { id: string }>("security_nonces").upsert({ id: deviceId, ...keys });
    return { ownerKey, adminKey, registrationKey };
  }

  /** Verify a presented plaintext key against stored hashes. */
  async verifyKey(deviceId: string, presentedKey: string, role: "owner" | "admin" | "registration"): Promise<boolean> {
    const table = this.db.table<DeviceKeys & { id: string }>("security_nonces");
    const stored = await table.getById(deviceId);
    if (!stored) return false;
    const hash = await this.hashKey(presentedKey, deviceId);
    const fieldMap = { owner: "ownerKeyHash", admin: "adminKeyHash", registration: "registrationKeyHash" } as const;
    return hash === (stored as Record<string, string>)[fieldMap[role]];
  }

  /** Sign a command payload. Returns a SignedCommand envelope. */
  async signCommand(payload: Record<string, unknown>, deviceKey: string): Promise<SignedCommand> {
    const nonce = await this._freshNonce();
    const timestamp = new Date().toISOString();
    const payloadStr = JSON.stringify(payload);
    const sigInput = `${payloadStr}${nonce}${timestamp}${deviceKey}`;
    const signature = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, sigInput);
    return { payload: payloadStr, nonce, timestamp, signature };
  }

  /** Verify a signed command. Returns false if signature is wrong or nonce was already seen. */
  async verifyCommand(cmd: SignedCommand, deviceId: string, deviceKey: string): Promise<boolean> {
    // Check nonce freshness
    if (!this._checkAndRecordNonce(deviceId, cmd.nonce, cmd.timestamp)) return false;
    const sigInput = `${cmd.payload}${cmd.nonce}${cmd.timestamp}${deviceKey}`;
    const expected = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, sigInput);
    return expected === cmd.signature;
  }

  /** Issue a device token (JWT-shaped, NOT a real JWT). */
  async issueToken(deviceId: string, role: string, sessionKey: string, ttlMs = 3_600_000): Promise<DeviceToken> {
    const header = base64url(JSON.stringify({ alg: "LUMA-KH256", typ: "DT" }));
    const payloadObj = { deviceId, issuedAt: Date.now(), expiresAt: Date.now() + ttlMs, role };
    const payload = base64url(JSON.stringify(payloadObj));
    const sigInput = `${header}.${payload}${sessionKey}`;
    const sigBytes = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, sigInput);
    const signature = base64url(sigBytes);
    return { header, payload, signature };
  }

  /** Validate a device token. Returns the decoded payload or null if invalid/expired. */
  async validateToken(token: DeviceToken, sessionKey: string): Promise<{ deviceId: string; role: string } | null> {
    try {
      const sigInput = `${token.header}.${token.payload}${sessionKey}`;
      const expected = base64url(await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, sigInput));
      if (expected !== token.signature) return null;
      const decoded = JSON.parse(atob(token.payload.replace(/-/g, "+").replace(/_/g, "/")));
      if (Date.now() > decoded.expiresAt) return null;
      return { deviceId: decoded.deviceId, role: decoded.role };
    } catch { return null; }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private async _freshNonce(): Promise<string> {
    const bytes = await Crypto.getRandomBytesAsync(16);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
  }

  private _checkAndRecordNonce(deviceId: string, nonce: string, timestamp: string): boolean {
    const ts = new Date(timestamp).getTime();
    if (Date.now() - ts > NONCE_TTL_MS) return false;
    if (!this._nonces.has(deviceId)) this._nonces.set(deviceId, new Map());
    const deviceNonces = this._nonces.get(deviceId)!;
    if (deviceNonces.has(nonce)) return false; // replay!
    if (deviceNonces.size >= MAX_NONCES_PER_DEVICE) {
      // Evict oldest
      const oldest = [...deviceNonces.entries()].sort((a, b) => a[1] - b[1])[0];
      if (oldest) deviceNonces.delete(oldest[0]);
    }
    deviceNonces.set(nonce, ts + NONCE_TTL_MS);
    return true;
  }

  private _pruneExpiredNonces(): void {
    const now = Date.now();
    this._nonces.forEach(deviceNonces => {
      deviceNonces.forEach((expiresAt, nonce) => {
        if (expiresAt < now) deviceNonces.delete(nonce);
      });
    });
  }

  private async _loadNonces(): Promise<void> {
    // Nonces are ephemeral — not persisted across cold starts (intentional, per spec)
  }

  private async _persistNonces(): Promise<void> {
    // Intentionally not persisted — nonces only live for the current session
  }
}
