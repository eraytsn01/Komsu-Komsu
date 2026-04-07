import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

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
  if (!isFirebaseAdminConfigured()) return null;

  if (getApps().length > 0) {
    return getApps()[0];
  }

  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: getPrivateKey(),
    }),
  });
}

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
