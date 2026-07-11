/**
 * MQTTService — the transport boundary. Everything above this file
 * (MQTTConnection, MQTTManager, …) talks to a `MQTTServiceInterface` and
 * genuinely does not know or care whether messages are moving over the real
 * native MQTT session or the app's existing simulated engine bus.
 *
 * `@arduino/react-native-mqtt-client` ships real Kotlin/Swift native
 * modules. Native modules cannot load inside Expo Go — only inside a custom
 * dev client (`expo prebuild` + `eas build --profile development`, or a
 * local Android Studio/Xcode build). This container cannot build or run
 * that dev client (no Android SDK, no macOS for iOS), so this fallback path
 * is the only one ever exercised here — but the real-native path is fully
 * wired and will activate automatically the moment the app is running
 * inside a dev client that has this module autolinked.
 *
 * The fallback is never silent: the very first time it's used, a
 * NATIVE_TRANSPORT_UNAVAILABLE event fires so the UI can show a clear
 * "simulated" badge instead of quietly pretending to be the real thing.
 */
import { NativeModules } from "react-native";
import { mobileRNMQTTClientEngine, MQTTIncomingMessage } from "../../../engines/mqtt-client-engine";
import { mqttEvents, MQTT_EVENT } from "./MQTTEvents";

export interface ConnectParams {
  host: string;
  port: number;
  clientId: string;
  username?: string;
  password?: string;
  cleanSession?: boolean;
  keepAlive?: number;
  useTls?: boolean;
}

export type IncomingHandler = (topic: string, payload: Record<string, unknown>) => void;

export interface MQTTServiceInterface {
  readonly transport: "native" | "simulated";
  connect(params: ConnectParams): Promise<void>;
  disconnect(): Promise<void> | void;
  publish(topic: string, payload: Record<string, unknown>): Promise<void>;
  subscribe(topic: string, handler: IncomingHandler): Promise<() => void>;
  isConnected(): Promise<boolean>;
  onConnected(handler: () => void): () => void;
  onDisconnected(handler: () => void): () => void;
  onError(handler: (err: { code: string; message: string }) => void): () => void;
}

function utf8ToBytes(str: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.codePointAt(i)!;
    if (code > 0xffff) i++; // consumed a surrogate pair
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return bytes;
}

function bytesToUtf8(bytes: number[]): string {
  let out = "";
  let i = 0;
  while (i < bytes.length) {
    const b0 = bytes[i];
    if (b0 < 0x80) {
      out += String.fromCharCode(b0);
      i += 1;
    } else if ((b0 & 0xe0) === 0xc0) {
      out += String.fromCharCode(((b0 & 0x1f) << 6) | (bytes[i + 1] & 0x3f));
      i += 2;
    } else if ((b0 & 0xf0) === 0xe0) {
      out += String.fromCharCode(((b0 & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f));
      i += 3;
    } else {
      const code =
        ((b0 & 0x07) << 18) | ((bytes[i + 1] & 0x3f) << 12) | ((bytes[i + 2] & 0x3f) << 6) | (bytes[i + 3] & 0x3f);
      out += String.fromCodePoint(code);
      i += 4;
    }
  }
  return out;
}

/** Wraps one real `MqttClient` native session. Used only inside a dev client build. */
class NativeMQTTService implements MQTTServiceInterface {
  readonly transport = "native" as const;
  private client: import("@arduino/react-native-mqtt-client").MqttClient;
  private subs: Array<{ remove: () => void }> = [];
  private connectedHandlers = new Set<() => void>();
  private disconnectedHandlers = new Set<() => void>();
  private errorHandlers = new Set<(err: { code: string; message: string }) => void>();
  private messageHandlers = new Map<string, Set<IncomingHandler>>();

  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { MqttClient } = require("@arduino/react-native-mqtt-client");
    this.client = new MqttClient();
    this.subs.push(this.client.addListener("connected", () => this.connectedHandlers.forEach((h) => h())));
    this.subs.push(this.client.addListener("disconnected", () => this.disconnectedHandlers.forEach((h) => h())));
    this.subs.push(
      this.client.addListener("got-error", (err: { code: string; message: string }) =>
        this.errorHandlers.forEach((h) => h(err)),
      ),
    );
    this.subs.push(
      this.client.addListener("received-message", (msg: { topic: string; payload: number[] }) => {
        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(bytesToUtf8(msg.payload));
        } catch {
          parsed = { raw: bytesToUtf8(msg.payload) };
        }
        this.messageHandlers.get(msg.topic)?.forEach((h) => h(msg.topic, parsed));
      }),
    );
  }

  async connect(params: ConnectParams): Promise<void> {
    if (params.username != null) {
      await this.client.connect({
        clientId: params.clientId,
        reconnect: true,
        url: `${params.useTls ? "mqtts" : "mqtt"}://${params.host}:${params.port}`,
        username: params.username,
        password: params.password ?? "",
      });
    } else {
      await this.client.connect({
        clientId: params.clientId,
        reconnect: true,
        host: params.host,
        port: params.port,
      });
    }
  }

  disconnect(): void {
    this.client.disconnect();
  }

  async publish(topic: string, payload: Record<string, unknown>): Promise<void> {
    await this.client.publish(topic, utf8ToBytes(JSON.stringify(payload)));
  }

  async subscribe(topic: string, handler: IncomingHandler): Promise<() => void> {
    if (!this.messageHandlers.has(topic)) this.messageHandlers.set(topic, new Set());
    this.messageHandlers.get(topic)!.add(handler);
    await this.client.subscribe(topic);
    return () => this.messageHandlers.get(topic)?.delete(handler);
  }

  isConnected(): Promise<boolean> {
    return this.client.isConnected();
  }

  onConnected(handler: () => void): () => void {
    this.connectedHandlers.add(handler);
    return () => this.connectedHandlers.delete(handler);
  }

  onDisconnected(handler: () => void): () => void {
    this.disconnectedHandlers.add(handler);
    return () => this.disconnectedHandlers.delete(handler);
  }

  onError(handler: (err: { code: string; message: string }) => void): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }
}

let warnedFallback = false;

/**
 * Bridges to the app's pre-existing simulated engine (`mobileRNMQTTClientEngine`
 * → `mqtt_engine` on the gateway). Used whenever the native module isn't
 * loaded (i.e. Expo Go, or any environment without this dev client build).
 */
class SimulatedMQTTService implements MQTTServiceInterface {
  readonly transport = "simulated" as const;
  private connectedHandlers = new Set<() => void>();
  private disconnectedHandlers = new Set<() => void>();
  private errorHandlers = new Set<(err: { code: string; message: string }) => void>();
  private unsubscribes: Array<() => void> = [];

  constructor() {
    if (!warnedFallback) {
      warnedFallback = true;
      mqttEvents.emit(MQTT_EVENT.NATIVE_TRANSPORT_UNAVAILABLE, {
        reason:
          "Native @arduino/react-native-mqtt-client module not found — running under Expo Go or a build without it autolinked. Falling back to the simulated engine bus. Build a custom dev client (expo prebuild + eas build --profile development) to use the real transport.",
      });
    }
    mobileRNMQTTClientEngine.onConnect(() => this.connectedHandlers.forEach((h) => h()));
    mobileRNMQTTClientEngine.onDisconnect(() => this.disconnectedHandlers.forEach((h) => h()));
  }

  async connect(params: ConnectParams): Promise<void> {
    mobileRNMQTTClientEngine.connect({
      brokerUrl: params.host,
      port: params.port,
      clientId: params.clientId,
      username: params.username,
      password: params.password,
      cleanSession: params.cleanSession ?? true,
      keepAlive: params.keepAlive ?? 60,
    });
  }

  disconnect(): void {
    mobileRNMQTTClientEngine.disconnect();
  }

  async publish(topic: string, payload: Record<string, unknown>): Promise<void> {
    mobileRNMQTTClientEngine.publish(topic, payload);
  }

  async subscribe(topic: string, handler: IncomingHandler): Promise<() => void> {
    const unsub = mobileRNMQTTClientEngine.subscribe(topic, (msg: MQTTIncomingMessage) => {
      handler(msg.topic, msg.payload as Record<string, unknown>);
    });
    this.unsubscribes.push(unsub);
    return unsub;
  }

  async isConnected(): Promise<boolean> {
    return mobileRNMQTTClientEngine.isConnected();
  }

  onConnected(handler: () => void): () => void {
    this.connectedHandlers.add(handler);
    return () => this.connectedHandlers.delete(handler);
  }

  onDisconnected(handler: () => void): () => void {
    this.disconnectedHandlers.add(handler);
    return () => this.disconnectedHandlers.delete(handler);
  }

  onError(handler: (err: { code: string; message: string }) => void): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }
}

export function isNativeMqttAvailable(): boolean {
  return !!(NativeModules as Record<string, unknown>).MqttClient;
}

/** One independent transport session per call — mirrors the native library's per-instance design. */
export function createMQTTService(): MQTTServiceInterface {
  return isNativeMqttAvailable() ? new NativeMQTTService() : new SimulatedMQTTService();
}
