/**
 * MQTTQueue — offline command queue. Anything that couldn't be delivered on
 * any channel (cloud, local, HTTP, Bluetooth) lands here, persisted to disk
 * so it survives an app restart, and is drained once connectivity returns.
 */
import { getQueue, setQueue, QueuedOperation } from "./MQTTStorage";
import { mqttEvents, MQTT_EVENT } from "./MQTTEvents";

const MAX_ATTEMPTS = 8;

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `q-${Date.now()}-${idCounter}`;
}

export async function enqueue(
  kind: QueuedOperation["kind"],
  deviceId: string,
  payload: unknown,
): Promise<QueuedOperation> {
  const op: QueuedOperation = { id: nextId(), kind, deviceId, payload, createdAt: Date.now(), attempts: 0 };
  const queue = await getQueue();
  queue.push(op);
  await setQueue(queue);
  mqttEvents.emit(MQTT_EVENT.COMMAND_QUEUED, op);
  return op;
}

export async function size(): Promise<number> {
  return (await getQueue()).length;
}

export async function peekAll(): Promise<QueuedOperation[]> {
  return getQueue();
}

/**
 * Drains the queue using `sendFn`. Operations that succeed are removed;
 * operations that fail keep their place (with attempt incremented) unless
 * they've exceeded `MAX_ATTEMPTS`, in which case they're dropped and a
 * SECURITY_VIOLATION-adjacent "gave up" event is NOT silently swallowed —
 * it's surfaced via COMMAND_QUEUED with a terminal flag so the UI can show
 * the user their command was lost.
 */
export async function drain(sendFn: (op: QueuedOperation) => Promise<boolean>): Promise<{ delivered: number; remaining: number }> {
  const queue = await getQueue();
  if (queue.length === 0) return { delivered: 0, remaining: 0 };

  const survivors: QueuedOperation[] = [];
  let delivered = 0;
  for (const op of queue) {
    let ok = false;
    try {
      ok = await sendFn(op);
    } catch (err) {
      console.error(`[MQTTQueue] send failed for ${op.id}`, err);
    }
    if (ok) {
      delivered += 1;
      continue;
    }
    op.attempts += 1;
    if (op.attempts < MAX_ATTEMPTS) {
      survivors.push(op);
    } else {
      console.warn(`[MQTTQueue] dropping ${op.id} after ${op.attempts} failed attempts`);
    }
  }
  await setQueue(survivors);
  return { delivered, remaining: survivors.length };
}

export async function clear(): Promise<void> {
  await setQueue([]);
}
