# Vendored copy — `@arduino/react-native-mqtt-client`

This is the upstream [`react-native-mqtt-client`](https://github.com/arduino/react-native-mqtt-client)
library (native Android/Kotlin + iOS/Swift MQTT client), vendored directly into
this workspace as a local package so LUMA Smart Home can depend on it via
`workspace:*` without needing to publish it.

**What was changed:** only `package.json` was trimmed — the upstream repo's own
build/lint/test toolchain (Jest 26, RN 0.62, old ESLint/TypeScript, `bob` build
pipeline) was removed because it targets a totally different RN version than
this app and would otherwise pollute the workspace's dependency resolution.
The library's actual implementation — `src/index.tsx` (JS/TS API), `android/`
(Kotlin native module), and `ios/` (Swift native module) — is untouched.

**Native module — requires a custom dev client.** This library ships real
native code (`RNMqttClient.kt`, Swift EC/TLS helpers). Native modules are not
loadable inside Expo Go. To actually run this on a device/emulator you must:

1. `npx expo prebuild` (generates native `android/` and `ios/` projects for
   the LUMA app with this library autolinked).
2. Build a custom dev client — `eas build --profile development` (needs an
   Expo/EAS account) or a local build via Android Studio / Xcode.
3. Install that dev client on the device/emulator and run
   `expo start --dev-client` instead of plain `expo start`.

None of this can be built or verified inside this container (no Android SDK
here, and iOS builds require macOS). Until a dev client is installed, the app
falls back to the pre-existing simulated engine bridge automatically — see
`src/modules/mqtt/MQTTService.ts` for the detection logic.
