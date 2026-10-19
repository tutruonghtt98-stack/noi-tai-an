"use client";

export type AlertPrefs = { enabled: boolean; sound: boolean; lead: number };
export const PREFS_KEY = "nta:alerts";
export const DEFAULT_PREFS: AlertPrefs = { enabled: true, sound: true, lead: 0 };

export function loadPrefs(): AlertPrefs {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(p: AlertPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
    window.dispatchEvent(new Event("nta:alerts-prefs"));
  } catch {}
}

export const notifySupported = () => typeof window !== "undefined" && "Notification" in window;

export function permission(): NotificationPermission | "unsupported" {
  return notifySupported() ? Notification.permission : "unsupported";
}

export async function requestPermission() {
  if (!notifySupported()) return "unsupported" as const;
  if (Notification.permission !== "default") return Notification.permission;
  return Notification.requestPermission();
}

/** Thông báo của hệ điều hành (pop-up góc màn hình). Bấm vào sẽ đưa về tab và mở trang tương ứng. */
export function systemNotify(title: string, body: string, opts: { tag: string; href?: string; requireInteraction?: boolean }) {
  if (!notifySupported() || Notification.permission !== "granted") return false;
  try {
    const n = new Notification(title, {
      body,
      tag: opts.tag,
      icon: "/icon.svg",
      badge: "/icon.svg",
      requireInteraction: opts.requireInteraction ?? false,
      silent: true, // âm thanh do ứng dụng tự phát để đồng nhất giữa các hệ điều hành
    });
    n.onclick = () => {
      window.focus();
      if (opts.href && location.pathname !== opts.href) location.assign(opts.href);
      n.close();
    };
    return true;
  } catch {
    return false;
  }
}

/** Chống báo trùng giữa nhiều tab: chỉ tab đầu tiên "nhận" được khoá mới báo. */
export function claimOnce(key: string) {
  try {
    const k = `nta:notified:${key}`;
    if (localStorage.getItem(k)) return false;
    localStorage.setItem(k, String(Date.now()));
    // Dọn khoá cũ hơn 2 ngày
    for (let i = 0; i < localStorage.length; i++) {
      const name = localStorage.key(i);
      if (name?.startsWith("nta:notified:") && Date.now() - Number(localStorage.getItem(name)) > 172_800_000) localStorage.removeItem(name);
    }
    return true;
  } catch {
    return true;
  }
}
