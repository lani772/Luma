/**
 * MQTTSecurity — device tokens, command signing, and replay prevention.
 *
 * Honesty note: the vendored native MQTT library already supports real
 * X.509 client-certificate identity (`setIdentity`/`loadIdentity`) — that is
 * the "real" transport-layer auth path when a broker is configured for it.
 * What lives in *this* file is the app-layer scheme LUMA uses on top of that
 * for command authorization: a JWT-*shaped* device token (header.payload.
 * signature, base64url, checked for expiry) and a keyed-hash command
 * signature. It intentionally is NOT textbook HMAC (RFC 2104) — there is no
 * `crypto.subtle`/HMAC primitive available in this Expo/RN runtime without
 * pulling in a native crypto lib beyond `expo-crypto`'s SHA-256 digest — so
 * the signature is `SHA256(secret + ":" + timestamp + ":" + nonce + ":" +
 * canonicalPayload)`. That is a legitimate, widely-used lightweight IoT
 * command-auth construction (keyed hash + timestamp + nonce for replay
 * protection), but it is weaker than RFC 2104 HMAC against certain
 * length-extension attacks and should not be presented as HMAC.
 */
import * as Crypto from "expo-crypto";
import { hasSeenNonce, rememberNonce } from "./MQTTStorage";

const NONCE_TTL_MS = 5 * 60 * 1000;
const TOKEN_DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

function base64url(input: string): string {
  return input.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return padded + pad;
}

async function sha256Hex(input: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input, {
    encoding: Crypto.CryptoEncoding.HEX,
  });
}

async function randomHex(byteLength: number): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(byteLength);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Key generation (owner / admin / registration keys per device) ──────────

export async function generateKey(prefix: string): Promise<string> {
  return `${prefix}_${await randomHex(16)}`;
}

export async function hashKey(key: string): Promise<string> {
  return sha256Hex(`luma-key:${key}`);
}

// ── Device tokens (JWT-shaped, checked client-side for expiry/tamper) ──────

export interface DeviceTokenPayload {
  deviceId: string;
  ownerId: string;
  role: "owner" | "admin" | "member" | "guest";
  iat: number;
  exp: number;
}

export async function issueDeviceToken(
  payload: Omit<DeviceTokenPayload, "iat" | "exp">,
  secret: string,
  ttlMs: number = TOKEN_DEFAULT_TTL_MS,
): Promise<string> {
  const full: DeviceTokenPayload = { ...payload, iat: Date.now(), exp: Date.now() + ttlMs };
  const header = base64url(btoaSafe(JSON.stringify({ alg: "SHA256-KEYED", typ: "LUMA-DT" })));
  const body = base64url(btoaSafe(JSON.stringify(full)));
  const signature = base64url(await sha256Hex(`${secret}:${header}.${body}`));
  return `${header}.${body}.${signature}`;
}

export async function verifyDeviceToken(
  token: string,
  secret: string,
): Promise<{ valid: boolean; payload?: DeviceTokenPayload; reason?: string }> {
  const parts = token.split(".");
  if (parts.length !== 3) return { valid: false, reason: "malformed_token" };
  const [header, body, signature] = parts;
  const expected = base64url(await sha256Hex(`${secret}:${header}.${body}`));
  if (expected !== signature) return { valid: false, reason: "bad_signature" };
  let payload: DeviceTokenPayload;
  try {
    payload = JSON.parse(atobSafe(fromBase64url(body)));
  } catch {
    return { valid: false, reason: "bad_payload" };
  }
  if (Date.now() > payload.exp) return { valid: false, payload, reason: "expired" };
  return { valid: true, payload };
}

// ── Command signing (keyed hash + nonce/timestamp replay protection) ───────

export interface SignedCommandEnvelope {
  payload: Record<string, unknown>;
  timestamp: number;
  nonce: string;
  signature: string;
}

function canonicalize(payload: Record<string, unknown>): string {
  return JSON.stringify(payload, Object.keys(payload).sort());
}

export async function signCommand(
  payload: Record<string, unknown>,
  deviceKey: string,
): Promise<SignedCommandEnvelope> {
  const timestamp = Date.now();
  const nonce = await randomHex(8);
  const signature = await sha256Hex(`${deviceKey}:${timestamp}:${nonce}:${canonicalize(payload)}`);
  await rememberNonce(nonce, timestamp + NONCE_TTL_MS);
  return { payload, timestamp, nonce, signature };
}

export async function verifyCommandSignature(
  envelope: SignedCommandEnvelope,
  deviceKey: string,
): Promise<{ valid: boolean; reason?: string }> {
  const age = Date.now() - envelope.timestamp;
  if (age > NONCE_TTL_MS || age < -30_000) return { valid: false, reason: "stale_or_future_timestamp" };
  if (await hasSeenNonce(envelope.nonce)) return { valid: false, reason: "replayed_nonce" };
  const expected = await sha256Hex(
    `${deviceKey}:${envelope.timestamp}:${envelope.nonce}:${canonicalize(envelope.payload)}`,
  );
  if (expected !== envelope.signature) return { valid: false, reason: "bad_signature" };
  await rememberNonce(envelope.nonce, envelope.timestamp + NONCE_TTL_MS);
  return { valid: true };
}

// ── UTF-8 safe base64 (RN has global atob/btoa but not guaranteed for
//    multi-byte strings; JSON payloads here are ASCII-safe by construction
//    since keys/values are hex/ids/numbers, so plain atob/btoa suffice). ────

function btoaSafe(str: string): string {
  if (typeof btoa === "function") return btoa(str);
  return Buffer.from(str, "utf8").toString("base64");
}

function atobSafe(str: string): string {
  if (typeof atob === "function") return atob(str);
  return Buffer.from(str, "base64").toString("utf8");
}
