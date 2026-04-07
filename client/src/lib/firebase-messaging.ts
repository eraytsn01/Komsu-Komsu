import { Capacitor } from "@capacitor/core";
import { getToken, getMessaging, isSupported, onMessage, type MessagePayload } from "firebase/messaging";
import app, { isFirebaseConfigured } from "@/lib/firebase";

const SERVICE_WORKER_PATH = "/firebase-messaging-sw.js";
const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

export async function isFirebaseMessagingAvailable() {
  if (typeof window === "undefined") return false;
  if (Capacitor.isNativePlatform()) return false;
  if (!isFirebaseConfigured || !vapidKey) return false;
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return false;

  return isSupported();
}

export async function registerFirebaseMessagingServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.register(SERVICE_WORKER_PATH);
}

export async function enableFirebasePushNotifications() {
  const isAvailable = await isFirebaseMessagingAvailable();
  if (!isAvailable) {
    throw new Error("Firebase push bu cihazda veya mevcut yapılandırmada kullanılamıyor.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Bildirim izni verilmedi.");
  }

  const registration = await registerFirebaseMessagingServiceWorker();
  const messaging = getMessaging(app);
  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: registration ?? undefined,
  });

  if (!token) {
    throw new Error("Firebase bildirim token'ı alınamadı.");
  }

  return token;
}

export async function listenFirebaseForegroundMessages(
  callback: (payload: MessagePayload) => void,
) {
  const isAvailable = await isFirebaseMessagingAvailable();
  if (!isAvailable) return () => undefined;

  const messaging = getMessaging(app);
  return onMessage(messaging, callback);
}
