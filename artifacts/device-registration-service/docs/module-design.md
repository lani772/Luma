# Module Design Specification

## Module Overview

The DRDMS architecture consists of cohesive modules separated cleanly inside the Go backend:

```
                  +----------------------------------+
                  |         Handlers / Routes        |
                  +-----------------+----------------+
                                    |
                                    v
                  +----------------------------------+
                  |             Services             |
                  +--------+----------------+--------+
                           |                |
         +-----------------+                +-----------------+
         v                                                    v
+------------------+                                 +------------------+
|    Simulation    |                                 |    Controller    |
|   & AI Engine    |                                 |   Registration   |
+--------+---------+                                 +--------+---------+
         |                                                    |
         v                                                    v
+------------------+                                 +------------------+
|     Firmware     |                                 |    Credentials   |
|    Generator     |                                 |      & Keys      |
+------------------+                                 +------------------+
```

### 1. `ai` & `simulation` Modules
- Parses the virtual onboarding requirements prompt (e.g., `"Add 6 lamps and 2 fans"`).
- Uses regular expressions inside a mock AI provider structure.
- Creates a `DeviceSimulation` entity.
- Yields logical JSON configurations and automated pin allocations.

### 2. `firmware` Module
- Generates a compiled template containing preconfigured parameters:
  - `main.cpp`
  - `device_config.h`
  - `mqtt_client.h`
  - `security.h`
  - `wifi_manager.h`
- Packs them using standard Go `archive/zip` and returns a binary buffer for the download endpoint.

### 3. `hardware` & `resources` Modules
- Handles pin validation to prevent resource conflicts.
- Associates logical components (lamps, fans, relays) with specific rooms and microcontroller resource bindings.

### 4. `credentials` & `security` Modules
- Generates registration tokens, permanent access API keys, and rotates MQTT broker credentials.
- Encrypts keys at rest using the AES GCM model.
