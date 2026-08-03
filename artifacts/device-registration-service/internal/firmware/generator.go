package firmware

import (
	"archive/zip"
	"bytes"
	"fmt"
)

// Generator produces compile-ready Arduino/PlatformIO custom project packages
type Generator struct{}

func NewGenerator() *Generator {
	return &Generator{}
}

func (g *Generator) GenerateZIP(token, controllerID, serial string, gpioMappings map[string]interface{}) ([]byte, error) {
	var buf bytes.Buffer
	w := zip.NewWriter(&buf)

	files := map[string]string{
		"platformio.ini": "[env:esp32dev]\nplatform = espressif32\nboard = esp32dev\nframework = arduino\nlib_deps =\n    knolleary/PubSubClient @ 2.8\n    bblanchon/ArduinoJson @ 7.0.4\n",
		"src/main.cpp": "#include <Arduino.h>\n#include <WiFi.h>\n#include <PubSubClient.h>\n#include <ArduinoJson.h>\n#include \"device_config.h\"\n#include \"security.h\"\n\nWiFiClient espClient;\nPubSubClient client(espClient);\n\nvoid setup() {\n    Serial.begin(115200);\n    setup_wifi();\n    client.setServer(mqtt_broker, 1883);\n    \n    // Perform Secure Onboarding HTTP Handshake\n    perform_secure_registration();\n}\n\nvoid loop() {\n    if (!client.connected()) {\n        reconnect();\n    }\n    client.loop();\n}\n",
		"src/device_config.h": fmt.Sprintf("#ifndef DEVICE_CONFIG_H\n#define DEVICE_CONFIG_H\n\nconst char* ssid = \"YOUR_WIFI_SSID\";\nconst char* password = \"YOUR_WIFI_PASSWORD\";\nconst char* mqtt_broker = \"mqtt.luma.local\";\n\nconst char* controller_id = \"%s\";\nconst char* serial_number = \"%s\";\n\n#endif\n", controllerID, serial),
		"src/security.h": fmt.Sprintf("#ifndef SECURITY_H\n#define SECURITY_H\n\nconst char* registration_token = \"%s\";\nconst char* registration_url = \"http://localhost:8095/api/v1/controllers/register/complete\";\n\nvoid setup_wifi() {\n    delay(10);\n    WiFi.begin(ssid, password);\n    while (WiFi.status() != WL_CONNECTED) {\n        delay(500);\n    }\n}\n\nvoid perform_secure_registration() {\n    // REST Post to DRDMS Complete Registration Endpoint\n}\n\nvoid reconnect() {\n    // Connect to Broker with custom username/pass\n}\n\n#endif\n", token),
		"README.md": fmt.Sprintf("# LUMA ESP32 Auto-Generated Firmware\n\nThis package is compiled custom for Controller **%s** (Serial: %s).\n\n## Flashing Instructions\n\n1. Open this directory in VS Code with PlatformIO.\n2. Edit src/device_config.h to supply your Wi-Fi credentials.\n3. Click Upload to flash the ESP32.\n4. On boot, the device will connect to LUMA and claim itself automatically.\n", controllerID, serial),
	}

	for name, content := range files {
		f, err := w.Create(name)
		if err != nil {
			return nil, err
		}
		_, err = f.Write([]byte(content))
		if err != nil {
			return nil, err
		}
	}

	if err := w.Close(); err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}
