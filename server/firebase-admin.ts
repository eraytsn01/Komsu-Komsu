// Railway/Vercel ortamında databaseURL eksikse elle set et
// Sabit bağlantı: Ortam değişkeni olmadan doğrudan adres
// Railway/Vercel'de hata almamak için databaseURL'i sabitliyoruz
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { getDatabase } from "firebase-admin/database";
import fs from "fs";
import path from "path";

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
  // 1. En güvenilir yöntem: Doğrudan JSON dosyasını okumayı dene
  const keyPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
  if (fs.existsSync(keyPath)) {
    console.log("Firebase: serviceAccountKey.json dosyası bulundu, bu dosya kullanılıyor.");
    return initializeApp({
      credential: cert(keyPath),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
  }

  // 2. Dosya yoksa .env üzerinden okumayı dene
  let rawKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!rawKey) {
    console.warn("Firebase: serviceAccountKey.json veya FIREBASE_PRIVATE_KEY bulunamadı!");
    return undefined;
  }

  if (rawKey.includes("SİZİN") || rawKey.includes("GİZLİ")) {
    console.error("\n=========================================================");
    console.error("HATA: .env dosyasındaki FIREBASE_PRIVATE_KEY değerini değiştirmemişsiniz!");
    console.error("ÇÖZÜM: Firebase'den indirdiğiniz JSON dosyasının adını 'serviceAccountKey.json' yapıp projenin ana klasörüne atın.");
    console.error("=========================================================\n");
    process.exit(1);
  }

  const formattedKey = rawKey.replace(/\\n/g, '\n').replace(/^["']|["']$/g, "");
  
  try {
    return initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: formattedKey,
      }),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
  } catch (error) {
    console.error("Firebase Admin başlatılamadı. Private Key formatı hatalı.");
    throw error;
  }
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
