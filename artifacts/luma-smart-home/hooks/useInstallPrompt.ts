import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

export type InstallPromptState = "idle" | "available" | "installed" | "dismissed";

export function useInstallPrompt() {
  const [state, setState] = useState<InstallPromptState>("idle");
  const deferredPrompt = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS !== "web") return;

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setState("installed");
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e;
      setState("available");
    };

    window.addEventListener("beforeinstallprompt", handler);

    const appInstalled = () => setState("installed");
    window.addEventListener("appinstalled", appInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", appInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferredPrompt.current) return;
    deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;
    deferredPrompt.current = null;
    setState(outcome === "accepted" ? "installed" : "dismissed");
  };

  const dismiss = () => setState("dismissed");

  return { state, promptInstall, dismiss };
}
