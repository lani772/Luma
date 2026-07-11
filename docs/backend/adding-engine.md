# Adding a New Engine

This guide walks through every step needed to add a new engine to the LUMA backend.
The only constraint: your engine must never import another engine directly —
all communication goes through the `InternalAPIGateway`.

**Estimated time:** 15–30 minutes for a complete engine with REST exposure.

---

## Step 1 — Add the Engine ID to the type union

`lib/api-spec/openapi.yaml` and `artifacts/api-server/src/internal-api/types.ts` both define the valid engine IDs.
Update both files at once.

### `artifacts/api-server/src/internal-api/types.ts`

```diff
 export type EngineId =
   | "firmware_engine"
   | "device_engine"
   | "wifi_engine"
   | "mqtt_engine"
   | "usb_engine"
   | "firmware_upload_engine"
   | "rn_mqtt_client_engine"
   | "p2p_engine"
+  | "scene_engine";           // ← add your new ID here
```

Also add it to the `ENGINE_NAMES` map at the bottom of the same file:

```diff
 export const ENGINE_NAMES: Record<EngineId, string> = {
   // existing entries…
+  scene_engine: "Scene Engine",
 };
```

### `lib/api-spec/openapi.yaml`

Find the `EngineId` schema and add your ID to the enum:

```yaml
EngineId:
  type: string
  enum:
    - firmware_engine
    - device_engine
    # ...existing IDs...
    - scene_engine      # ← add here
```

---

## Step 2 — Create the engine file

Create `artifacts/api-server/src/engines/scene/scene-engine.ts`:

```typescript
import { BaseEngine } from "../base-engine";
import type { EngineId, InternalMessage } from "../../internal-api/types";
import { logger } from "../../lib/logger";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Scene {
  id:      string;
  name:    string;
  emoji:   string;
  devices: Array<{ deviceId: string; command: string; params?: Record<string, unknown> }>;
  active:  boolean;
}

// ── Engine ─────────────────────────────────────────────────────────────────────

export class SceneEngine extends BaseEngine {
  // 1. Required static metadata
  readonly id: EngineId = "scene_engine";
  readonly name = "Scene Engine";
  readonly version = "1.0.0";

  // 2. What this engine can do
  readonly capabilities = [
    "scene_management",
    "scene_activation",
    "multi_device_coordination",
  ];

  // 3. Which actions this engine handles
  readonly subscribedActions = [
    "ACTIVATE_SCENE",
    "DEACTIVATE_SCENE",
    "GET_SCENE",
    "LIST_SCENES",
    "CREATE_SCENE",
    "DELETE_SCENE",
  ];

  // 4. Internal state
  private scenes: Map<string, Scene> = new Map();

  // 5. Lifecycle hooks
  protected onStart(): void {
    this.seedScenes();
    logger.info("[SceneEngine] scenes loaded");
  }

  protected onStop(): void {
    // clean up timers, close connections, etc.
  }

  // 6. Message router
  protected handleMessage(message: InternalMessage): void {
    logger.debug({ action: message.action }, "[SceneEngine] received");

    switch (message.action) {
      case "ACTIVATE_SCENE":   this.handleActivate(message);   break;
      case "DEACTIVATE_SCENE": this.handleDeactivate(message); break;
      case "GET_SCENE":        this.handleGet(message);        break;
      case "LIST_SCENES":      this.handleList(message);       break;
      case "CREATE_SCENE":     this.handleCreate(message);     break;
      case "DELETE_SCENE":     this.handleDelete(message);     break;
      default:
        logger.warn({ action: message.action }, "[SceneEngine] unknown action");
    }
  }

  // 7. Action handlers

  private handleActivate(message: InternalMessage): void {
    const { sceneId } = message.payload as { sceneId: string };
    const scene = this.scenes.get(sceneId);

    if (!scene) {
      logger.warn({ sceneId }, "[SceneEngine] scene not found");
      return;
    }

    // Send a command for every device in the scene
    for (const step of scene.devices) {
      this.send("device_engine", "SEND_COMMAND", {
        deviceId: step.deviceId,
        command:  step.command,
        params:   step.params,
      }, "high");
    }

    scene.active = true;

    // Broadcast so all engines know the scene changed
    this.broadcast("SCENE_ACTIVATED", { sceneId, name: scene.name }, "normal");
    logger.info({ sceneId }, "[SceneEngine] activated");
  }

  private handleDeactivate(message: InternalMessage): void {
    const { sceneId } = message.payload as { sceneId: string };
    const scene = this.scenes.get(sceneId);
    if (scene) {
      scene.active = false;
      this.broadcast("SCENE_DEACTIVATED", { sceneId }, "normal");
    }
  }

  private handleGet(message: InternalMessage): void {
    const { sceneId } = message.payload as { sceneId: string };
    const scene = this.scenes.get(sceneId);

    this.emit(
      message.source as EngineId,
      "SCENE_DATA",
      scene ? { scene } : { error: "not_found", sceneId },
    );
  }

  private handleList(message: InternalMessage): void {
    this.emit(
      message.source as EngineId,
      "SCENE_LIST",
      { scenes: [...this.scenes.values()] },
    );
  }

  private handleCreate(message: InternalMessage): void {
    const scene = message.payload as Scene;
    this.scenes.set(scene.id, scene);
    this.broadcast("SCENE_CREATED", { scene }, "normal");
  }

  private handleDelete(message: InternalMessage): void {
    const { sceneId } = message.payload as { sceneId: string };
    if (this.scenes.delete(sceneId)) {
      this.broadcast("SCENE_DELETED", { sceneId }, "normal");
    }
  }

  // 8. Seed / helpers

  private seedScenes(): void {
    this.scenes.set("evening", {
      id: "evening",
      name: "Evening",
      emoji: "🌙",
      active: false,
      devices: [
        { deviceId: "ESP32_Lamp_01", command: "SET_BRIGHTNESS", params: { value: 30 } },
      ],
    });
  }

  // 9. Public accessors (for REST routes)
  getAllScenes(): Scene[] { return [...this.scenes.values()]; }
  getScene(id: string): Scene | undefined { return this.scenes.get(id); }
}

export const sceneEngine = new SceneEngine();
```

---

## Step 3 — Register the engine in the bootstrap file

`artifacts/api-server/src/engines/index.ts`:

```diff
+import { sceneEngine } from "./scene/scene-engine";

 const engines = [
   firmwareEngine,
   deviceEngine,
   wifiEngine,
   mqttEngine,
   usbEngine,
   firmwareUploadEngine,
+  sceneEngine,
 ];

 // also add to named exports at the bottom:
+export { sceneEngine };
```

---

## Step 4 — Add REST routes (optional)

`artifacts/api-server/src/routes/engines.ts`:

```typescript
import { sceneEngine } from "../engines/scene/scene-engine";

// List all scenes
router.get("/engines/scenes/all", (_req, res) => {
  res.json({ scenes: sceneEngine.getAllScenes() });
});

// Activate a scene
router.post("/engines/scenes/:sceneId/activate", (req, res) => {
  const { sceneId } = req.params;
  const msgId = gateway.sendCommand("device_engine", "scene_engine", "ACTIVATE_SCENE", { sceneId });
  res.json({ messageId: msgId });
});
```

---

## Step 5 — Update the OpenAPI spec

Add a path entry for each new REST endpoint in `lib/api-spec/openapi.yaml`:

```yaml
paths:
  /engines/scenes/all:
    get:
      operationId: listScenes
      tags: [scenes]
      summary: List all scenes
      responses:
        "200":
          description: Scene list
          content:
            application/json:
              schema:
                type: object
                properties:
                  scenes:
                    type: array
                    items:
                      $ref: "#/components/schemas/Scene"
```

Then regenerate client code:

```bash
pnpm --filter @workspace/api-spec run codegen
```

---

## Step 6 — Typecheck

```bash
pnpm --filter @workspace/api-server run typecheck
```

Fix any errors, then restart the workflow.

---

## Step 7 — Add to mobile (if needed)

If the new engine also needs a mobile counterpart, create
`artifacts/luma-smart-home/engines/scene-engine.ts` following the same pattern
as the existing mobile engines (no `BaseEngine` — register directly with `gateway`).

Then add it to `artifacts/luma-smart-home/engines/index.ts`.

---

## Checklist

```
[ ] EngineId added to  src/internal-api/types.ts
[ ] ENGINE_NAMES map updated
[ ] Engine class created in  src/engines/{name}/{name}-engine.ts
[ ] Engine added to engines/index.ts array
[ ] REST routes added to  src/routes/engines.ts  (if needed)
[ ] OpenAPI spec updated  lib/api-spec/openapi.yaml
[ ] Codegen re-run  pnpm --filter @workspace/api-spec run codegen
[ ] Typecheck passes  pnpm --filter @workspace/api-server run typecheck
[ ] API Server workflow restarted
[ ] Mobile engine added to  engines/  (if needed)
```

---

## Communication Patterns Quick Reference

```typescript
// Send a command to another engine
this.send("device_engine", "SEND_COMMAND", { deviceId, command: "TURN_ON" }, "high");

// Emit an event to a specific engine
this.emit("firmware_engine", "SCENE_ACTIVATED", { sceneId, triggeredBy: "timer" });

// Broadcast to ALL engines (e.g. system-wide events)
this.broadcast("NIGHT_MODE_ACTIVATED", { sceneId: "night" }, "normal");

// Queue a message if the target might be offline
this.queueOffline("mqtt_engine", "PUBLISH", { topic, payload }, 30_000);

// Reply to a QUERY with a correlationId
gateway.publishMessage({
  source:        this.id,
  destination:   message.source as EngineId,
  type:          "RESPONSE",
  action:        "SCENE_DATA",
  payload:       { scene },
  priority:      "normal",
  correlationId: message.id,
});
```
