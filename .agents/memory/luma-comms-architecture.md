---
name: LUMA communication engine design choices
description: Why the MQTT/comms module reuses existing simulated engines instead of building new discovery/Bluetooth/security primitives from scratch.
---

When adding a new "real" capability (native MQTT, device discovery, Bluetooth backup, command signing) to the LUMA Smart Home app, check `engines/wifi-engine.ts` and `engines/p2p-engine.ts` first — they already simulate ESP32 discovery (mDNS/UDP/heartbeat) and a Bluetooth mesh (peers, gateways, route priority, offline queue) in real depth.

**Why:** duplicating that simulation elsewhere creates two sources of truth for the same fake hardware behavior and makes the eventual swap to real hardware (real BLE lib, real mDNS scanner) harder — only one call site needs to change if the new module *wraps* the existing engine's events/methods instead of reimplementing them.

**How to apply:** new communication features should subscribe to `mobileWiFiEngine`/`mobileP2PEngine` events and re-emit through their own typed bus rather than adding parallel simulation logic. This pattern is used by `src/modules/mqtt/MQTTDiscovery.ts` (wraps wifi-engine) and `MQTTManager`'s Bluetooth channel (wraps p2p-engine).

Also: this codebase has an `engines/hooks/useEngines.ts` hook that is dead code (never imported) — the actual engine bootstrap happens in `context/ConnectivityContext.tsx`, which calls `mobileWiFiEngine.start()`/`mobileP2PEngine.start()` directly. Don't trust `useEngines` as the wiring pattern to follow; follow `ConnectivityContext.tsx`'s context-provider pattern instead.

Separately: `components/DeviceCard.tsx` is unused dead code — the actually-rendered card component across the app is `components/UnifiedDeviceCard.tsx` (mode="mqtt"|"gpio"). Always grep for actual imports before assuming a component file is live UI.

For lightweight command-auth in an Expo/RN runtime without a native HMAC primitive, a keyed SHA-256 hash (`SHA256(secret:timestamp:nonce:payload)`, expo-crypto) + nonce/timestamp replay cache is an honest, adequate substitute — but must be labeled "keyed hash," not HMAC, since it lacks HMAC's length-extension resistance.
