import { useEffect, useState } from "react";

export type NotificationSound = "chime" | "bell" | "beep";

export type NotificationSettings = {
  messages: boolean;
  emergencies: boolean;
  announcements: boolean;
  sound: NotificationSound;
};

const STORAGE_KEY = "notificationSettings";

const defaultSettings: NotificationSettings = {
  messages: true,
  emergencies: true,
  announcements: true,
  sound: "chime",
};

let memoryState: NotificationSettings = defaultSettings;
const listeners: Array<(s: NotificationSettings) => void> = [];

function parseSettings(raw: string | null): NotificationSettings {
  if (!raw) return defaultSettings;
  try {
    const parsed = JSON.parse(raw);
    return {
      ...defaultSettings,
      ...parsed,
    };
  } catch {
    return defaultSettings;
  }
}

function init() {
  if (typeof window === "undefined") return;
  memoryState = parseSettings(localStorage.getItem(STORAGE_KEY));
}

function emit() {
  listeners.forEach((listener) => listener(memoryState));
}

export function setNotificationSettings(next: NotificationSettings) {
  memoryState = next;
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  emit();
}

export function patchNotificationSettings(partial: Partial<NotificationSettings>) {
  setNotificationSettings({ ...memoryState, ...partial });
}

export function getNotificationSettings() {
  return memoryState;
}

init();

export function useNotificationSettings() {
  const [settings, setSettings] = useState<NotificationSettings>(memoryState);

  useEffect(() => {
    const listener = (s: NotificationSettings) => setSettings(s);
    listeners.push(listener);

    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      memoryState = parseSettings(e.newValue);
      emit();
    };

    window.addEventListener("storage", onStorage);

    return () => {
      const index = listeners.indexOf(listener);
      if (index >= 0) listeners.splice(index, 1);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return {
    settings,
    setSettings: setNotificationSettings,
    patchSettings: patchNotificationSettings,
  };
}
