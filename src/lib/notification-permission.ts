// Browser notification support can be partial in embedded browsers/WebViews.
export function notificationPermission(): NotificationPermission | "unsupported" {
  try {
    if (typeof window === "undefined" || typeof window.Notification?.requestPermission !== "function") return "unsupported";
    return window.Notification.permission;
  } catch {
    return "unsupported";
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (notificationPermission() === "unsupported") return "unsupported";
  try {
    return await window.Notification.requestPermission();
  } catch {
    return "unsupported";
  }
}