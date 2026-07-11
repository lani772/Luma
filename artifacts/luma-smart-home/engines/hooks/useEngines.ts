import { useEffect, useRef } from "react";
import { startAllMobileEngines, stopAllMobileEngines } from "../index";
import {
  mobileDeviceEngine,
  mobileWiFiEngine,
  mobileRNMQTTClientEngine,
  mobileP2PEngine,
  mobileFirmwareEngine,
  mobileFirmwareUploadEngine,
  mobileUSBEngine,
} from "../index";

export function useEngines() {
  const startedRef = useRef(false);

  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      startAllMobileEngines();
    }
    return () => {
      stopAllMobileEngines();
    };
  }, []);

  return {
    deviceEngine: mobileDeviceEngine,
    wifiEngine: mobileWiFiEngine,
    mqttClient: mobileRNMQTTClientEngine,
    p2pEngine: mobileP2PEngine,
    firmwareEngine: mobileFirmwareEngine,
    firmwareUploadEngine: mobileFirmwareUploadEngine,
    usbEngine: mobileUSBEngine,
  };
}
