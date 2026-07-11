/**
 * MQTTTopics — canonical topic architecture for every device.
 *
 * Every device gets exactly these ten topics. Nothing in this module ever
 * hands back a hand-rolled topic string — go through `buildTopics` /
 * `topicFor` so the naming scheme can only ever change in one place.
 */

export type TopicKind =
  | "status"
  | "command"
  | "response"
  | "event"
  | "firmware"
  | "schedule"
  | "permission"
  | "heartbeat"
  | "logs"
  | "sync";

const TOPIC_KINDS: TopicKind[] = [
  "status",
  "command",
  "response",
  "event",
  "firmware",
  "schedule",
  "permission",
  "heartbeat",
  "logs",
  "sync",
];

export type DeviceTopics = Record<TopicKind, string>;

const ROOT = "device";

export function topicFor(deviceId: string, kind: TopicKind): string {
  return `${ROOT}/${deviceId}/${kind}`;
}

export function buildTopics(deviceId: string): DeviceTopics {
  return TOPIC_KINDS.reduce((acc, kind) => {
    acc[kind] = topicFor(deviceId, kind);
    return acc;
  }, {} as DeviceTopics);
}

export function allTopicsFor(deviceId: string): string[] {
  return TOPIC_KINDS.map((kind) => topicFor(deviceId, kind));
}

/** Subscription wildcard for every topic belonging to a device (QoS layer). */
export function deviceWildcard(deviceId: string): string {
  return `${ROOT}/${deviceId}/+`;
}

export interface ParsedTopic {
  deviceId: string;
  kind: TopicKind;
}

/** Parses `device/{id}/{kind}` back into its parts, or null if malformed. */
export function parseTopic(topic: string): ParsedTopic | null {
  const parts = topic.split("/");
  if (parts.length !== 3 || parts[0] !== ROOT) return null;
  const [, deviceId, kindRaw] = parts;
  if (!TOPIC_KINDS.includes(kindRaw as TopicKind)) return null;
  return { deviceId, kind: kindRaw as TopicKind };
}

export { TOPIC_KINDS };
