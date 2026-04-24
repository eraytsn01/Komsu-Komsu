// Bu script, Firebase Admin SDK ile bir kullanıcı oluşturur ve ona admin rolü atar.
// Çalıştırmak için: node server/scripts/create_owner_eray_tosun.mjs

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({
  credential: applicationDefault(),
});

const auth = getAuth();
const db = getFirestore();

async function main() {
  // Ortam değişkenlerini kontrol et
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
    console.error('Hata: Lütfen ADMIN_EMAIL ve ADMIN_PASSWORD ortam değişkenlerini ayarlayın.');
    process.exit(1);
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  // Kullanıcıyı oluştur
  let user;
  try {
    user = await auth.createUser({
      email: adminEmail,
      password: adminPassword,
      emailVerified: true,
      displayName: 'Eray Admin',
      disabled: false,
    });
    console.log('Kullanıcı oluşturuldu:', user.uid);
  } catch (e) {
    if (e.code === 'auth/email-already-exists') {
      user = await auth.getUserByEmail(adminEmail);
      console.log('Kullanıcı zaten var:', user.uid);
    } else {
      throw e;
    }
  }

  // Firestore'da admin rolünü ata
  await db.collection('users').doc(user.uid).set({
    email: adminEmail,
    role: 'admin',
    createdAt: new Date(),
    displayName: 'Eray Admin',
  }, { merge: true });
  console.log('Admin rolü atandı.');
}

main().then(() => process.exit(0));
