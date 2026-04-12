// Elle girilen sokak/cadde/bulvarlar admin onayına düşer
import { db } from "./firebase-admin";

export async function addPendingStreet(city, district, neighborhood, street, type) {
  const ref = db.ref("pendingStreets").push();
  await ref.set({ city, district, neighborhood, street, type, createdAt: Date.now() });
  return ref.key;
}

export async function getPendingStreets() {
  const snap = await db.ref("pendingStreets").get();
  if (!snap.exists()) return [];
  const val = snap.val();
  return Object.entries(val).map(([id, data]) => ({ id, ...data }));
}

export async function approvePendingStreet(id) {
  const snap = await db.ref(`pendingStreets/${id}`).get();
  if (!snap.exists()) return false;
  const { city, district, neighborhood, street, type } = snap.val();
  // Kalıcı sokak listesine ekle (örnek: db.ref('streets/...').push())
  await db.ref(`streets/${city}/${district}/${neighborhood}`).push({ street, type });
  await db.ref(`pendingStreets/${id}`).remove();
  return true;
}

export async function rejectPendingStreet(id) {
  await db.ref(`pendingStreets/${id}`).remove();
  return true;
}
