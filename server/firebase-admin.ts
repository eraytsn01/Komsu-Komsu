// Railway/Vercel ortamında databaseURL eksikse elle set et
// Sabit bağlantı: Ortam değişkeni olmadan doğrudan adres
// Railway/Vercel'de hata almamak için databaseURL'i sabitliyoruz
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { getDatabase } from "firebase-admin/database";

function getPrivateKey() {
  const raw = process.env.FIREBASE_PRIVATE_KEY;
  if (!raw) return undefined;
  return raw.replace(/\\n/g, "\n");
}

function isFirebaseAdminConfigured() {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY,
  );
}

function getFirebaseAdminApp() {
  // 1. Önce Railway'deki değişkeni bir sabit değişkene al
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;
  // 2. Eğer anahtar varsa, hatalı kaçış karakterlerini (\n) gerçek alt satıra çevir
  const formattedKey = rawKey ? rawKey.replace(/\\n/g, '\n') : undefined;
  // 3. Firebase'i bu temizlenmiş anahtar ile başlat
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: formattedKey, // BURASI ÖNEMLİ: 'rawKey' değil 'formattedKey' kullanıyoruz
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
}

export const firebaseAdminApp = getFirebaseAdminApp();
export const db = firebaseAdminApp ? getDatabase(firebaseAdminApp) : undefined;

export async function sendPushToTokens(
  tokens: string[],
  payload: {
    title: string;
    body: string;
    data?: Record<string, string>;
  },
) {
  const uniqueTokens = Array.from(new Set(tokens.filter(Boolean)));
  if (uniqueTokens.length === 0) return;

  const app = getFirebaseAdminApp();
  if (!app) return;

  const messaging = getMessaging(app);

  await messaging.sendEachForMulticast({
    tokens: uniqueTokens,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: payload.data,
    webpush: {
      notification: {
        title: payload.title,
        body: payload.body,
        icon: "/favicon.png",
      },
      fcmOptions: {
        link: process.env.WEB_APP_URL || "https://komsukomsu.online",
      },
    },
  });
}
