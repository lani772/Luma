# Workflow Specification

## 1. Simulation-First Onboarding Workflow

The complete onboarding process occurs in 6 seamless phases:

```
[User App]
    │  1. Provide natural language prompt (e.g. "Create 4 lamps in Living Room")
    ▼
[DRDMS: /register/start]
    │  2. AI parses parameters & generates blueprint
    │  3. Creates Simulation Record & Single-Use Registration Token
    ▼
[DRDMS: /register/firmware]
    │  4. Bundles blueprint & credentials into custom Arduino project ZIP
    ▼
[User App]
    │  5. Code is flashed/uploaded to ESP32 board
    ▼
[Microcontroller Boot]
    │  6. ESP32 starts, reads token, connects to WiFi/Internet
    │  7. Calls DRDMS Registration API /register/complete
    ▼
[DRDMS: /register/complete]
    │  8. Verifies registration token, promotes Simulation to Real Active Controller
    │  9. Generates permanent API Key & MQTT details
    │ 10. Publishes Event DEVICE_REGISTERED (subscribed to by UAMS & MQTT Services)
```

## 2. Microcontroller Claiming & Security Handshake

1. First-time boot contact utilizes `POST /api/v1/controllers/register/complete` with the custom single-use token.
2. The registration token acts as proof-of-possession of the AI-generated blueprint.
3. If valid, the controller status moves from `simulation` to `active`, establishing the registered owner ID.
