import { useEffect, useState } from "react";

// ---------- Service worker + update prompt ----------

let waiting: ServiceWorker | null = null;
let updateRequested = false;
const listeners = new Set<() => void>();

function setWaiting(worker: ServiceWorker) {
  waiting = worker;
  listeners.forEach(fn => fn());
}

export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator) || !import.meta.env.PROD) return;

  // Reload only when the user tapped "Refresh", not on the first install.
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (updateRequested) window.location.reload();
  });

  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("./sw.js");

      if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);

      reg.addEventListener("updatefound", () => {
        const worker = reg.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            setWaiting(worker);
          }
        });
      });

      // Check for a new deploy whenever the app comes back to the foreground.
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") reg.update().catch(() => {});
      });
    } catch {
      /* service worker unavailable — app still works online */
    }
  });
}

export function applyUpdate(): void {
  if (!waiting) {
    window.location.reload();
    return;
  }
  updateRequested = true;
  waiting.postMessage({ type: "SKIP_WAITING" });
}

export function useUpdateAvailable(): boolean {
  const [ready, setReady] = useState(waiting !== null);
  useEffect(() => {
    const fn = () => setReady(true);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return ready;
}

// ---------- App icon badge ----------

type BadgeNavigator = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

export function setBadge(count: number): void {
  const nav = navigator as BadgeNavigator;
  try {
    if (count > 0) nav.setAppBadge?.(count)?.catch(() => {});
    else nav.clearAppBadge?.()?.catch(() => {});
  } catch {
    /* badging unsupported */
  }
}

// ---------- Notifications ----------

export type Permission = NotificationPermission | "unsupported";

export function notificationPermission(): Permission {
  return "Notification" in window ? Notification.permission : "unsupported";
}

export async function requestNotifications(): Promise<Permission> {
  if (!("Notification" in window)) return "unsupported";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export async function notify(title: string, options: NotificationOptions): Promise<void> {
  try {
    const reg =
      "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (reg) {
      await reg.showNotification(title, options);
    } else {
      new Notification(title, options);
    }
  } catch {
    /* notifications unavailable */
  }
}

// ---------- Shared / shortcut launches ----------

/** Text shared into the app (via the share sheet), and whether to focus the input. */
export function readLaunchParams(): { shared: string; focus: boolean } {
  const params = new URLSearchParams(window.location.search);
  const title = params.get("title")?.trim() ?? "";
  const text = params.get("text")?.trim() ?? "";
  const url = params.get("url")?.trim() ?? "";

  const parts: string[] = [];
  for (const part of [title, text, url]) {
    if (part && !parts.some(p => p.includes(part))) parts.push(part);
  }
  const shared = parts.join(" — ");

  if (window.location.search) {
    window.history.replaceState(null, "", window.location.pathname);
  }
  return { shared, focus: Boolean(shared) || params.get("action") === "add" };
}
