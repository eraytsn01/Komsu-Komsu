# Backend Deployment Guide - Railway

Bu rehber, Express backend'i Railway'e deploy etmek için adım adım talimatlar içerir.

## 1. Railway Account Oluştur

1. https://railway.app adresine git
2. GitHub hesabınızla sign up yap
3. Yeni project oluştur

## 2. PostgreSQL Database Kurulumu

Railway'de PostgreSQL bağla:
1. Railway dashboard'da "Add Service" → "Database" → "PostgreSQL" seç
2. Otomatik olarak `DATABASE_URL` env var'ı oluşturulacak
3. Bu URL'i kopyala (migration için gerekecek)

## 3. Backend Deployment

### Option A: GitHub Repository Connect (Önerilen)

1. Railway dashboard'da "New Project" → "Deploy from GitHub repo"
2. `proje_yedek` repository'sini seç
3. Railway otomatik olarak `build` ve `start` script'lerini bulacak

### Option B: CLI ile Deploy

```bash
npm install -g @railway/cli
railway login
railway link
railway up
```

## 4. Environment Variables Ayarla

Railway dashboard'da şu env var'ları ekle:

### Gerekli Variables:
```
NODE_ENV=production
PORT=3000

# PostgreSQL
DATABASE_URL=(Railway otomatik sağlayacak)

# Firebase Admin SDK
FIREBASE_PROJECT_ID=komsu-komsu-xxxxxxx
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@komsu-komsu-xxxxx.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"

# Security
SESSION_SECRET=your-secure-random-string-min-32-chars
CORS_ORIGIN=https://komsukomsu.online
```

### Firebase Keys Nereden Alınır:

1. https://console.firebase.google.com adresine git
2. Projen seç (komsu-komsu)
3. Project Settings → Service Accounts
4. "Generate new private key" butonuna tıkla
5. İndirilen JSON dosyasından değerleri kopyala:
   - `project_id` → FIREBASE_PROJECT_ID
   - `client_email` → FIREBASE_CLIENT_EMAIL
   - `private_key` → FIREBASE_PRIVATE_KEY (tırnaklar içinde, newline'lar \n olarak)

## 5. Database Migration

Railway backend'i deploy edildikten sonra:

```bash
# Local makineda:
DATABASE_URL="postgresql://user:pass@railway-db-url:5432/dbname" npm run db:push
```

Veya Railway CLI ile:
```bash
railway run npm run db:push
```

## 6. Frontend Configuration

Vercel'de env var'ı güncelle:

1. Vercel dashboard → Proje → Settings → Environment Variables
2. `VITE_API_BASE_URL` değerini güncelle:
   ```
   VITE_API_BASE_URL=https://api-production-xxxx.railway.app
   ```
3. Projeyi redeploy et: "Deployments" → Trigger deploy

Railway backend'in URL'sini öğrenmen için:
- Railway dashboard'da → Backend Service → Deployments
- "Live" deploy'ın üstünde "View Logs" ya da Domain adresini görebilirsin

## 7. APK Rebuild

Android APK'yı yeni backend URL ile rebuild et:

```bash
# Production APK ile Railway backend
npm run android:prod

# ya da manuel olarak:
echo "VITE_API_BASE_URL=https://your-railway-backend.railway.app" > client/.env.production
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
```

## 8. Test

### Browser'dan:
```bash
curl https://your-railway-backend.railway.app/api/auth/me
```

### Android cihazdan:
- APK'yı test et
- Login yap
- Notification settings'e git
- Push notification'ı enable et

## Troubleshooting

### "Cannot connect to database"
- Railway'de DATABASE_URL'in doğru olup olmadığını kontrol et
- PostgreSQL service'in running olup olmadığını kontrol et

### "Firebase error"
- FIREBASE_PRIVATE_KEY'in doğru format olup olmadığını kontrol et
- `\n` escape karakterleri kontrol et

### "CORS error"
- CORS_ORIGIN env var'ını kontrol et (https://komsukomsu.online olmalı)
- Frontend'in doğru backend URL'sine işaret etip etmediğini kontrol et

### "Port already in use"
- Railway PORT otomatik assign eder, lokal test için PORT=3000 kullan

## Deployment Sonrası Checklist

- [ ] PostgreSQL database Railway'de running
- [ ] Backend başarıyla deployed
- [ ] Env variables ayarlandı (Firebase, SESSION_SECRET, CORS_ORIGIN)
- [ ] Database migration çalıştırıldı (fcmToken column eklendi)
- [ ] Frontend'de VITE_API_BASE_URL güncellendi
- [ ] Vercel redeploy başarılı
- [ ] APK rebuild edildi yeni backend URL ile
- [ ] Browser'dan API test edildi
- [ ] Android'de login denendi
- [ ] Push notification test edildi
