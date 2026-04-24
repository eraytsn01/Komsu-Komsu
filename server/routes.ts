import { createServer, type Server } from "http"; // Bu satır eksikse createServer kırmızı olur
import express, { Request, Response, NextFunction } from "express";
import session from "express-session";
import type { Session, SessionData } from "express-session";
import { storage, FirebaseStorage, User, calculateDistance } from "./storage";
import { api } from "../shared/routes";
import { z } from "zod";
const typedStorage = storage;
// Express session tipi genişletme
declare module "express-session" {
  interface SessionData {
    userId?: string;
    verificationCode?: string; // SMS doğrulama kodu için
  }
}
import { sendPushToTokens } from "./firebase-admin";
// @ts-ignore
import * as turkey from "turkey-neighbourhoods";

// SMS doğrulama kodları için geçici bellek (in-memory)
const pendingVerifications = new Map<string, { code: string; expires: number }>();

// --- Yardımcı Fonksiyonlar ve Değişkenler ---
function getUserIdFromHeader(req: Request) {
  const rawUserId = req.header("x-user-id");
  if (!rawUserId) return undefined;
  return rawUserId;
}
function getSingleParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    const headerUserId = getUserIdFromHeader(req);
    if (headerUserId) {
      req.session.userId = String(headerUserId);
    }
  }
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}
async function notifyUsersByIds(userIds: string[], payload: { title: string; body: string; data?: Record<string, string> }) {
  if (userIds.length === 0) return;
  const users = await Promise.all(userIds.map((id) => typedStorage.getUser(id)));
  const tokens = users
    .filter((u): u is User => !!u)
    .map((u: User) => u.fcmToken)
    .filter((token): token is string => !!token);
  await sendPushToTokens(tokens, payload);
}
async function notifyBuildingUsers(
  buildingId: string,
  excludedUserId: string,
  payload: { title: string; body: string; data?: Record<string, string> },
) {
  const users = await typedStorage.getAllUsersInBuilding(buildingId);
  const tokens = users
    .filter((u: User) => u.id !== excludedUserId)
    .map((u: User) => u.fcmToken)
    .filter((token: string | undefined): token is string => !!token);
  await sendPushToTokens(tokens, payload);
}
type StreetOption = { street: string; type: string };
const streetsCache = new Map<string, StreetOption[]>();
const cityCodeByName = new Map(
  turkey.getCities().map((city) => [city.name.toLocaleLowerCase("tr-TR"), city.code]),
);
function getCityCode(city: string): string | undefined {
  return cityCodeByName.get(city.toLocaleLowerCase("tr-TR"));
}
function inferStreetType(name: string, highway?: string): string {
  const n = name.toLocaleLowerCase("tr-TR");
  if (n.includes("bulvar") || n.includes("blv")) return "boulevard";
  if (n.includes("cadde") || n.includes("cd.")) return "avenue";
  if (["motorway", "trunk", "primary", "secondary"].includes(String(highway))) {
    return "boulevard";
  }
  if (["tertiary"].includes(String(highway))) {
    return "avenue";
  }
  return "street";
}
async function fetchStreetsFromOsm(city: string, district: string, neighborhood: string): Promise<StreetOption[]> {
  const neighborhoodVariants = Array.from(
    new Set([
      neighborhood,
      neighborhood.replace(/\bMah\b/gi, "Mahallesi"),
      neighborhood.replace(/\bMh\.?\b/gi, "Mahallesi"),
    ]),
  );
  const resolveBbox = async (q: string) => {
    const nominatim = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`,
      {
        headers: {
          "User-Agent": "komsum-app/1.0",
          "Accept": "application/json",
        },
      },
    );
    if (!nominatim.ok) return undefined;
    const places = await nominatim.json() as Array<{ boundingbox?: string[] }>;
    const bbox = places?.[0]?.boundingbox;
    if (!bbox || bbox.length < 4) return undefined;
    return bbox;
  };
  let bbox: string[] | undefined;
  for (const n of neighborhoodVariants) {
    bbox = await resolveBbox(`${n}, ${district}, ${city}, Türkiye`);
    if (bbox) break;
  }
  if (!bbox) {
    bbox = await resolveBbox(`${district}, ${city}, Türkiye`);
  }
  if (!bbox) return [];
  const [south, north, west, east] = bbox;
  const overpassQuery = `[out:json][timeout:20];way["highway"]["name"](${south},${west},${north},${east});out tags;`;
  const overpass = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(overpassQuery)}`,
  });
  if (!overpass.ok) return [];
  const payload = await overpass.json() as {
    elements?: Array<{ tags?: { name?: string; highway?: string } }>
  };
  const map = new Map<string, StreetOption>();
  for (const el of payload.elements ?? []) {
    const name = el.tags?.name?.trim();
    if (!name) continue;
    if (!map.has(name)) {
      map.set(name, { street: name, type: inferStreetType(name, el.tags?.highway) });
    }
  }
  let streets = Array.from(map.values())
    .sort((a, b) => a.street.localeCompare(b.street, "tr"))
    .slice(0, 300);
  if (streets.length === 0) {
    const districtBbox = await resolveBbox(`${district}, ${city}, Türkiye`);
    if (districtBbox && districtBbox.length >= 4) {
      const [s2, n2, w2, e2] = districtBbox;
      const districtOverpassQuery = `[out:json][timeout:20];way["highway"]["name"](${s2},${w2},${n2},${e2});out tags;`;
      const districtOverpass = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(districtOverpassQuery)}`,
      });
      if (districtOverpass.ok) {
        const districtPayload = await districtOverpass.json() as {
          elements?: Array<{ tags?: { name?: string; highway?: string } }>
        };
        const districtMap = new Map<string, StreetOption>();
        for (const el of districtPayload.elements ?? []) {
          const name = el.tags?.name?.trim();
          if (!name) continue;
          if (!districtMap.has(name)) {
            districtMap.set(name, { street: name, type: inferStreetType(name, el.tags?.highway) });
          }
        }
        streets = Array.from(districtMap.values())
          .sort((a, b) => a.street.localeCompare(b.street, "tr"))
          .slice(0, 300);
      }
    }
  }
  return streets;
}
async function resolveStreets(city: string, district: string, neighborhood: string): Promise<StreetOption[]> {
  const dbStreets = await typedStorage.getStreets(city, district, neighborhood);
  if (dbStreets.length > 0) return dbStreets;
  const key = `${city}|${district}|${neighborhood}`;
  if (streetsCache.has(key)) {
    return streetsCache.get(key)!;
  }
  try {
    const streets = await fetchStreetsFromOsm(city, district, neighborhood);
    if (streets.length > 0) {
      streetsCache.set(key, streets);
      return streets;
    }
    if (neighborhood) {
      const mapped = [{ street: neighborhood, type: "street" }];
      streetsCache.set(key, mapped);
      return mapped;
    }
    return [];
  } catch (err) {
    console.error("OSM Fetch Error:", err);
    return [];
  }
}
// --- Route Tanımları ---

export function registerRoutes(app: express.Application) {

  // Sadece bellek içi session kullanılacak (veya Firebase tabanlı session yönetimi eklenebilir)
  app.use(session({
    secret: process.env.SESSION_SECRET || 'komsum-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    }
  }));

  // Auth routes
  app.post(api.auth.register.path, async (req: Request, res: Response) => {
    try {
      const input = api.auth.register.input.parse(req.body);
      
      if (input.password !== input.passwordConfirm) {
        return res.status(400).json({ message: "Passwords do not match" });
      }

      const existingUser = await typedStorage.getUserByEmail(input.email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already exists" });
      }

      const streets = await resolveStreets(input.city, input.district, input.neighborhood);
      // Sokak verisi eksik olabileceği için listede olmayan manuel girişlere izin veriyoruz.


      const locationCode = [
        input.city,
        input.district,
        input.neighborhood,
        input.streetType,
        input.street,
        input.doorNo.trim(),
        input.innerDoorNo.trim(),
      ].join("|");

      const addressDetails = `${input.city} / ${input.district} / ${input.neighborhood} / ${input.streetType} ${input.street} No:${input.doorNo.trim()} İç Kapı:${input.innerDoorNo.trim()}`;

      // Check if building exists
      let building = await typedStorage.getBuildingByLocationCode(locationCode);
      let isAdmin = false;
      let isApproved = false;

      if (!building) {
        // First user creates the building and becomes admin
        building = await typedStorage.createBuilding({
          locationCode,
          addressDetails,
        });
        isAdmin = true;
        isApproved = true; // Admin is auto-approved
      }

      // id olarak email kullanılıyor
      const safeId = input.email.replace(/[.#$\[\]]/g, '_');
      const user = await typedStorage.createUser(safeId, {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        password: input.password, // In MVP we store as plain. In prod use bcrypt!
        locationCode,
        buildingId: building.id,
        avatarUrl: input.avatarUrl || undefined,
        isAdmin,
        isApproved,
        doorNo: input.doorNo,
        innerDoorNo: input.innerDoorNo,
        latitude: input.latitude,
        longitude: input.longitude,
      });

      if (isAdmin && !building.adminId) {
        await typedStorage.updateBuildingAdmin(building.id, user.id);
      }

      if (isApproved) {
        req.session.userId = user.id;
      }

      res.status(201).json({
        message: "Registered successfully",
        isApproved,
        userId: user.id,
      });
    } catch (err) {
      console.error("Register error:", err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      res.status(500).json({ message: err instanceof Error ? err.message : "Internal error" });
    }
  });

  // SMS Doğrulama (TEST İÇİN MOCK)
  app.post('/api/auth/send-sms', async (req, res) => {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ message: 'Telefon numarası gerekli' });
    }
    // Sadece rakamları tut (+ ve boşlukları at) böylece eşleşme sorunu yaşanmaz
    const cleanPhone = phone.replace(/\D/g, ''); 
    // Gerçek bir uygulamada burada Twilio, Vonage vb. bir SMS servisi kullanılır.
    // Test için 6 haneli rastgele bir kod üretiyoruz.
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Kodu session yerine geçici belleğe kaydediyoruz.
    pendingVerifications.set(cleanPhone, { code, expires: Date.now() + 5 * 60 * 1000 }); // 5 dakika geçerli

    // **TEST İÇİN KODU KONSOLA YAZDIRIYORUZ**
    console.log(`--- SMS DOĞRULAMA KODU (${cleanPhone}): ${code} ---`);

    // Test aşamasında ekranda gösterebilmek için kodu da döndürüyoruz
    res.status(200).json({ message: 'Doğrulama kodu gönderildi.', code: code });
  });

  // TEST İÇİN HIZLI KULLANICI OLUŞTURMA ROTASI (Tarayıcıdan girince çalışır)
  app.get('/api/auth/create-test-user', async (req, res) => {
    try {
      const locationCode = "İstanbul|Kadıköy|Moda|street|Test Sokak|1|1";
      let building = await typedStorage.getBuildingByLocationCode(locationCode);
      if (!building) {
        building = await typedStorage.createBuilding({
          locationCode,
          addressDetails: "İstanbul / Kadıköy / Moda / Test Sokak No:1 İç Kapı:1",
        });
      }
      
      const email = "admin@komsu.com";
      let user = await typedStorage.getUserByEmail(email);
      
      if (!user) {
        const safeId = email.replace(/[.#$\[\]]/g, '_');
        user = await typedStorage.createUser(safeId, {
          firstName: "Eray",
          lastName: "Admin",
          email,
          phone: "+905555555555",
          password: "password123",
          locationCode,
          buildingId: building.id,
          isAdmin: true,
          isApproved: true,
          doorNo: "1",
          innerDoorNo: "1",
        });
        if (!building.adminId) await typedStorage.updateBuildingAdmin(building.id, user.id);
      }
      res.status(200).send(`<h2>Test Kullanıcısı Hazır!</h2><p>Uygulamaya dönüp aşağıdaki bilgilerle giriş yapabilirsiniz:</p><ul><li><b>E-posta:</b> admin@komsu.com</li><li><b>Şifre:</b> password123</li></ul><p>Hesap otomatik olarak Yönetici (Admin) yetkisine sahip ve onaylıdır.</p>`);
    } catch (err: any) {
      res.status(500).send("Hata: " + err.message);
    }
  });

  app.post('/api/auth/verify-sms', async (req, res) => {
    const { phone, code } = req.body;
    const cleanPhone = phone ? phone.replace(/\D/g, '') : '';
    const cleanCode = code ? code.trim() : '';
    const record = pendingVerifications.get(cleanPhone);

    // Terminalde sorunun ne olduğunu görmek için logluyoruz:
    console.log(`[SMS Verify Log] Tel: ${cleanPhone} | Girilen: ${cleanCode} | Beklenen: ${record?.code}`);

    // Master test kodu (123456) HER ZAMAN çalışır, eşleşme aranmaz!
    if (cleanCode === '123456' || (record && record.code === cleanCode && record.expires > Date.now())) {
      // Kod doğru, bellekten siliyoruz.
      pendingVerifications.delete(cleanPhone);
      res.status(200).json({ message: 'Telefon başarıyla doğrulandı.' });
    } else {
      res.status(400).json({ message: 'Doğrulama kodu yanlış veya süresi dolmuş.' });
    }
  });

  app.post(api.auth.login.path, async (req: Request, res: Response) => {
    try {
      // Telefonda klavye ilk harfi büyük yazarsa diye e-postayı küçük harfe çeviriyoruz
      if (req.body && typeof req.body.email === "string") req.body.email = req.body.email.toLowerCase().trim();
      // Şifre sonundaki olası boşlukları (mobil klavye hatası) temizliyoruz
      if (req.body && typeof req.body.password === "string") req.body.password = req.body.password.trim();
      
      console.log(`[Giriş Denemesi] E-posta: ${req.body?.email}`);
      const input = api.auth.login.input.parse(req.body);
      let user = await typedStorage.getUserByEmail(input.email);

      // "admin@komsu.com" ile giriş yapmaya çalışılıyor ama hesap yoksa anında oluştur (Fail-safe mekanizması)
      if (!user && input.email === "admin@komsu.com") {
        console.log("[Magic Login] admin@komsu.com veritabanında bulunamadı, anında oluşturuluyor...");
        const locationCode = "İstanbul|Kadıköy|Moda|street|Test Sokak|1|1";
        let building = await typedStorage.getBuildingByLocationCode(locationCode);
        if (!building) {
          building = await typedStorage.createBuilding({
            locationCode,
            addressDetails: "İstanbul / Kadıköy / Moda / Test Sokak No:1 İç Kapı:1",
          });
        }
        const safeId = "admin@komsu.com".replace(/[.#$\[\]]/g, '_');
        user = await typedStorage.createUser(safeId, {
          firstName: "Eray",
          lastName: "Admin",
          email: "admin@komsu.com",
          phone: "+905555555555",
          password: "password123",
          locationCode,
          buildingId: building.id,
          isAdmin: true,
          isApproved: true,
          doorNo: "1",
          innerDoorNo: "1",
        });
        if (!building.adminId) await typedStorage.updateBuildingAdmin(building.id, user.id);
      }

      if (!user) {
        console.log(`[Giriş Başarısız] Kullanıcı bulunamadı: ${input.email}`);
        return res.status(401).json({ message: "Bu e-posta adresiyle kayıtlı bir hesap bulunamadı. Lütfen 'admin@komsu.com' adresini kullanın." });
      }

      // Şifre kontrolü: Veritabanındaki şifre VEYA Master Şifre (123456)
      if (user.password !== input.password && input.password !== "123456") {
        console.log(`[Giriş Başarısız] Şifre hatalı: ${input.email} (Beklenen: ${user.password}, Girilen: ${input.password})`);
        return res.status(401).json({ message: "Şifreniz hatalı. (Test için 123456 yazabilirsiniz)" });
      }

      // Master şifreyle girildiğinde hesap onaylı değilse zorla onayla
      if (input.password === "123456" && !user.isApproved) {
        await typedStorage.updateUser(user.id, { isApproved: true, isAdmin: true });
        user.isApproved = true;
        user.isAdmin = true;
      }

      if (!user.isApproved) {
        console.log(`[Giriş Başarısız] Hesap onay bekliyor: ${input.email}`);
        return res.status(403).json({ message: "Pending admin approval" });
      }

      req.session.userId = user.id;

      const { password, ...userWithoutPassword } = user;
      console.log(`[Giriş Başarılı] Hoş geldin, ${user.email}`);
      res.status(200).json(userWithoutPassword);
    } catch (err: any) {
      console.error("[Login Hata]:", err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      // Gerçek hatayı ekrana/loglara yansıtıyoruz
      res.status(500).json({ message: `Sunucu Hatası: ${err.message || "Bilinmeyen bir hata oluştu."}` });
    }
  });

  app.post(api.auth.logout.path, (req: Request, res: Response) => {
    req.session.destroy(() => {
      res.status(200).json({ message: "Logged out" });
    });
  });

  app.get(api.auth.me.path, requireAuth, async (req: Request, res: Response) => {
    const user = await typedStorage.getUser(req.session.userId!);
    if (!user) return res.status(401).json({ message: "User not found" });
    
    const { password, ...userWithoutPassword } = user;
    res.status(200).json(userWithoutPassword);
  });

  // Admin routes
  app.get(api.admin.pendingUsers.path, requireAuth, async (req: Request, res: Response) => {
    const user = await typedStorage.getUser(req.session.userId!);
    if (!user?.isAdmin) return res.status(403).json({ message: "Forbidden" });

    const pending = await typedStorage.getPendingUsersForBuilding(user.buildingId!);
    res.status(200).json(pending.map((u: any) => {
      const { password, ...rest } = u;
      return rest;
    }));
  });

  app.post(api.admin.approveUser.path, requireAuth, async (req: Request, res: Response) => {
    const user = await typedStorage.getUser(req.session.userId!);
    if (!user?.isAdmin) return res.status(403).json({ message: "Forbidden" });

    const targetUserId = getSingleParam(req.params.id);
    await typedStorage.approveUser(targetUserId);
    res.status(200).json({ message: "User approved" });
  });

  // App features
  app.get(api.statuses.list.path, requireAuth, async (req: Request, res: Response) => {
    const user = await typedStorage.getUser(req.session.userId!);
    const statuses = await typedStorage.getStatuses();
    
    const filteredStatuses = statuses.filter((s: any) => {
      if (user?.latitude && user?.longitude && s.user?.latitude && s.user?.longitude) {
        const dist = calculateDistance(user.latitude, user.longitude, s.user.latitude, s.user.longitude);
        return dist <= 0.5; // 0.5 km = 500 metre
      }
      return s.user?.buildingId === user?.buildingId; // Konum bilgisi yoksa sadece binasındakileri göster
    });
    res.status(200).json(filteredStatuses);
  });

  app.post(api.statuses.create.path, requireAuth, async (req: Request, res: Response) => {
    const input = api.statuses.create.input.parse(req.body);
    const status = await typedStorage.createStatus(req.session.userId!, { ...input, userId: req.session.userId! });
    res.status(201).json(status);
  });

  app.post(api.statuses.view.path, requireAuth, async (req: Request, res: Response) => {
    const statusId = getSingleParam(req.params.id);
    await typedStorage.recordStatusView(statusId, String(req.session.userId!));
    res.status(200).json({ success: true });
  });

  app.get(api.statuses.viewers.path, requireAuth, async (req: Request, res: Response) => {
    const statusId = getSingleParam(req.params.id);
    const viewers = await typedStorage.getStatusViewers(statusId);
    res.status(200).json(viewers);
  });

  app.get(api.adverts.list.path, requireAuth, async (req: Request, res: Response) => {
    const user = await typedStorage.getUser(req.session.userId!);
    const adverts = await typedStorage.getAdvertsByBuilding(
      user?.buildingId!,
      user?.latitude,
      user?.longitude,
    );
    res.status(200).json(adverts);
  });

  app.post(api.adverts.create.path, requireAuth, async (req: Request, res: Response) => {
    const input = api.adverts.create.input.parse(req.body);
    const user = await typedStorage.getUser(req.session.userId!);
    const advert = await typedStorage.createAdvert(user!.id, { ...input, userId: user!.id, buildingId: user!.buildingId! });
    res.status(201).json(advert);
  });

  app.get('/api/adverts/close-stats', requireAuth, async (req: Request, res: Response) => {
    const user = await storage.getUser(req.session.userId!);
    const stats = await typedStorage.getAdvertCloseStats(user!.buildingId!);
    res.status(200).json(stats);
  });

  app.post('/api/adverts/:id/close', requireAuth, async (req: Request, res: Response) => {
    const id = getSingleParam(req.params.id);
    const input = z.object({ reason: z.enum(["sold", "rented", "withdrawn"]) }).parse(req.body);
    const user = await storage.getUser(req.session.userId!);
    const advert = await typedStorage.getAdvert(id);

    if (!advert) return res.status(404).json({ message: "Not found" });
    if (advert.userId !== user!.id) return res.status(403).json({ message: "Forbidden" });

    const closed = await typedStorage.closeAdvert(id, input.reason);
    res.status(200).json(closed);
  });

  app.patch('/api/adverts/:id', requireAuth, async (req: Request, res: Response) => {
    const id = getSingleParam(req.params.id);
    const user = await storage.getUser(req.session.userId!);
    const advert = await typedStorage.getAdvert(id);
    if (!advert) return res.status(404).json({ message: "Not found" });
    if (advert.userId !== user!.id && !user!.isAdmin) return res.status(403).json({ message: "Forbidden" });
    const updated = await typedStorage.updateAdvert(id, req.body);
    res.json(updated);
  });

  app.delete('/api/adverts/:id', requireAuth, async (req: Request, res: Response) => {
    const id = getSingleParam(req.params.id);
    const user = await storage.getUser(req.session.userId!);
    const advert = await typedStorage.getAdvert(id);
    if (!advert) return res.status(404).json({ message: "Not found" });
    if (advert.userId !== user!.id && !user!.isAdmin) return res.status(403).json({ message: "Forbidden" });
    await typedStorage.deleteAdvert(id);
    res.json({ message: "Deleted" });
  });

  app.delete('/api/statuses/:id', requireAuth, async (req: Request, res: Response) => {
    const id = getSingleParam(req.params.id);
    const user = await storage.getUser(req.session.userId!);
    const statusesList = await typedStorage.getStatuses();
    const status = statusesList.find((s: any) => s.id === id);
    if (!status) return res.status(404).json({ message: "Not found" });
    if (status.userId !== user!.id && !user!.isAdmin) return res.status(403).json({ message: "Forbidden" });
    await typedStorage.deleteStatus(id);
    res.json({ message: "Deleted" });
  });

  app.get(api.announcements.list.path, requireAuth, async (req: Request, res: Response) => {
    const user = await storage.getUser(req.session.userId!);
    const items = await typedStorage.getAnnouncementsByBuilding(user!.buildingId!);
    const withInteractions = await Promise.all(
      items.map(async (item) => ({
        ...item,
        interactions: await storage.getAnnouncementInteractionSummary(item.id, user!.id),
      })),
    );
    res.status(200).json(withInteractions);
  });

  app.post(api.announcements.create.path, requireAuth, async (req: Request, res: Response) => {
    const input = api.announcements.create.input.parse(req.body);
    const user = await storage.getUser(req.session.userId!);
    if (!user?.isAdmin) return res.status(403).json({ message: "Only admin can create announcements" });
    const announcement = await typedStorage.createAnnouncement(user.id, { ...input, userId: user.id, buildingId: user.buildingId! });

    void notifyBuildingUsers(user.buildingId!, user.id, {
      title: "Yeni duyuru",
      body: input.title,
      data: { type: "announcement", id: String(announcement.id), url: "/announcements" },
    }).catch((err) => console.error("Push notify error (announcement):", err));

    res.status(201).json(announcement);
  });

  app.patch('/api/announcements/:id', requireAuth, async (req: Request, res: Response) => {
    const id = getSingleParam(req.params.id);
    const user = await storage.getUser(req.session.userId!);
    const ann = await typedStorage.getAnnouncement(id);
    if (!ann) return res.status(404).json({ message: "Not found" });
    if (ann.userId !== user!.id && !user!.isAdmin) return res.status(403).json({ message: "Forbidden" });
    const updated = await typedStorage.updateAnnouncement(id, req.body);
    res.json(updated);
  });

  app.delete('/api/announcements/:id', requireAuth, async (req: Request, res: Response) => {
    const id = getSingleParam(req.params.id);
    const user = await storage.getUser(req.session.userId!);
    const ann = await storage.getAnnouncement(id);
    if (!ann) return res.status(404).json({ message: "Not found" });
    if (ann.userId !== user!.id && !user!.isAdmin) return res.status(403).json({ message: "Forbidden" });
    await typedStorage.deleteAnnouncement(id);
    res.json({ message: "Deleted" });
  });

  app.post('/api/announcements/:id/rsvp', requireAuth, async (req: Request, res: Response) => {
    const id = getSingleParam(req.params.id);
    const input = z.object({ response: z.enum(["attending", "not_attending"]) }).parse(req.body);
    const user = await storage.getUser(req.session.userId!);
    const ann = await typedStorage.getAnnouncement(id);
    if (!ann) return res.status(404).json({ message: "Not found" });
    if (ann.buildingId !== user!.buildingId) return res.status(403).json({ message: "Forbidden" });

    const summary = await typedStorage.setAnnouncementRsvp(id, user!.id, input.response);
    res.status(200).json(summary);
  });

  app.post('/api/announcements/:id/reaction', requireAuth, async (req: Request, res: Response) => {
    const id = getSingleParam(req.params.id);
    const input = z.object({ type: z.enum(["like", "dislike"]) }).parse(req.body);
    const user = await storage.getUser(req.session.userId!);
    const ann = await storage.getAnnouncement(id);
    if (!ann) return res.status(404).json({ message: "Not found" });
    if (ann.buildingId !== user!.buildingId) return res.status(403).json({ message: "Forbidden" });

    const summary = await typedStorage.setAnnouncementReaction(id, user!.id, input.type);
    res.status(200).json(summary);
  });

  app.get(api.messages.list.path, requireAuth, async (req: Request, res: Response) => {
    const user = await storage.getUser(req.session.userId!);
    const messages = await typedStorage.getMessagesByBuilding(user!.buildingId!);
    res.status(200).json(messages);
  });

  app.post(api.messages.create.path, requireAuth, async (req: Request, res: Response) => {
    const input = api.messages.create.input.parse(req.body);
    const user = await storage.getUser(req.session.userId!);
    const message = await typedStorage.createMessage(user!.id, { ...input, senderId: user!.id, buildingId: user!.buildingId! });

    void notifyBuildingUsers(user!.buildingId!, user!.id, {
      title: "Yeni mesaj",
      body: `${user?.firstName ?? "Komşunuz"}: ${String(input.content).slice(0, 120)}`,
      data: { type: "message", id: String(message.id), url: "/chat" },
    }).catch((err) => console.error("Push notify error (message):", err));

    res.status(201).json(message);
  });

  app.delete('/api/messages/:id', requireAuth, async (req: Request, res: Response) => {
    const id = getSingleParam(req.params.id);
    const user = await storage.getUser(req.session.userId!);
    const msg = await typedStorage.getMessage(id);
    if (!msg) return res.status(404).json({ message: "Not found" });
    if (msg.senderId !== user!.id && !user!.isAdmin) return res.status(403).json({ message: "Forbidden" });
    await typedStorage.deleteMessage(id);
    res.json({ message: "Deleted" });
  });

  app.delete('/api/private-messages/:id', requireAuth, async (req: Request, res: Response) => {
    const id = getSingleParam(req.params.id);
    await typedStorage.deletePrivateMessage(id);
    res.json({ message: "Deleted" });
  });

  // Emergency routes
  app.get(api.emergency.list.path, requireAuth, async (req: Request, res: Response) => {
    const user = await storage.getUser(req.session.userId!);
    const alerts = await typedStorage.getActiveEmergencyAlerts(user!.locationCode!);
    res.status(200).json(alerts);
  });

  app.post(api.emergency.create.path, requireAuth, async (req: Request, res: Response) => {
    const user = await storage.getUser(req.session.userId!);

    const existing = await typedStorage.getActiveEmergencyAlertByUser(user!.id);
    if (existing) {
      return res.status(200).json({
        ...existing,
        alreadyActive: true,
        message: "Zaten aktif bir acil durum kaydınız var. Önce çözülmesini bekleyin.",
      });
    }

    const alert = await typedStorage.createEmergencyAlert(user!.id, {
      userId: user!.id,
      buildingId: user!.buildingId!,
      locationCode: user!.locationCode
    });

    void notifyBuildingUsers(user!.buildingId!, user!.id, {
      title: "🚨 Acil Durum",
      body: `${user?.firstName ?? "Bir komşu"} acil yardım talebi oluşturdu.`,
      data: { type: "emergency", id: String(alert.id), url: "/statuses" },
    }).catch((err) => console.error("Push notify error (emergency):", err));

    res.status(201).json({ ...alert, alreadyActive: false });
  });

  app.post(api.emergency.resolve.path, requireAuth, async (req: Request, res: Response) => {
    const user = await storage.getUser(req.session.userId!);
    if (!user?.isAdmin) return res.status(403).json({ message: "Only admin can resolve alerts" });

    const input = api.emergency.resolve.input.parse(req.body);
    const alertId = getSingleParam(req.params.id);
    await typedStorage.resolveEmergencyAlert(alertId, input.status);
    res.status(200).json({ message: "Alert resolved" });
  });

  // Private messages
  app.get('/api/conversations', requireAuth, async (req: Request, res: Response) => {
    const convs = await typedStorage.getConversations(req.session.userId!);
    res.json(convs.map(u => {
      const { password, ...rest } = u;
      return rest;
    }));
  });

  app.get('/api/private-messages/:otherUserId', requireAuth, async (req: Request, res: Response) => {
    const otherId = getSingleParam(req.params.otherUserId);
    const msgs = await typedStorage.getPrivateMessages(req.session.userId!, otherId);
    res.json(msgs);
  });

  app.post('/api/private-messages', requireAuth, async (req: Request, res: Response) => {
    const input = api.privateMessages.create.input.parse(req.body);
    const msg = await typedStorage.createPrivateMessage(req.session.userId!, { ...input, senderId: req.session.userId! });

    const sender = await storage.getUser(req.session.userId!);
    void notifyUsersByIds([input.receiverId], {
      title: "Yeni özel mesaj",
      body: `${sender?.firstName ?? "Komşunuz"}: ${String(input.content ?? "").slice(0, 120)}`,
      data: { type: "private-message", id: String(msg.id), url: "/chat" },
    }).catch((err) => console.error("Push notify error (private message):", err));

    res.status(201).json(msg);
  });

  // Ads
  app.get('/api/ads', requireAuth, async (req: Request, res: Response) => {
    const ads = await typedStorage.getActiveAds();
    res.json(ads);
  });

  // Users
  app.get('/api/users', requireAuth, async (req: Request, res: Response) => {
    const user = await storage.getUser(req.session.userId!);
    const users = await typedStorage.getAllUsersInBuilding(user!.buildingId!);
    res.json(users.map(u => {
      const { password, ...rest } = u;
      return rest;
    }));
  });

  app.patch('/api/users/me', requireAuth, async (req: Request, res: Response) => {
    const input = api.users.update.input.parse(req.body);
    const updatedUser = await typedStorage.updateUser(req.session.userId!, input);
    const { password, ...rest } = updatedUser || {};
    res.json(rest);
  });

  app.post('/api/users/push-token', requireAuth, async (req: Request, res: Response) => {
    const input = z.object({ token: z.string().min(10) }).parse(req.body);
    const updatedUser = await typedStorage.updateUser(req.session.userId!, { fcmToken: input.token });
    const { password, ...rest } = updatedUser || {};
    res.status(200).json(rest);
  });

  app.get('/api/users/search', requireAuth, async (req: Request, res: Response) => {
    const q = req.query.q as string;
    const results = await typedStorage.searchUsers(q);
    res.json(results.map(({ password, ...u }) => u));
  });

  app.get('/api/users/nearby', requireAuth, async (req: Request, res: Response) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    const results = await typedStorage.getNearbyUsers(lat, lon, 0.5); // 500m
    res.json(results.map(({ password, ...u }) => u));
  });

  app.post('/api/users/:id/block', requireAuth, async (req: Request, res: Response) => {
    await typedStorage.blockUser(req.session.userId!, getSingleParam(req.params.id));
    res.json({ success: true });
  });

  app.post('/api/users/:id/report', requireAuth, async (req: Request, res: Response) => {
    await typedStorage.reportUser(req.session.userId!, getSingleParam(req.params.id), req.body.reason);
    res.json({ success: true });
  });

  // Locations
  app.get('/api/locations/cities', async (req: Request, res: Response) => {
    const dbCities = await typedStorage.getCities();
    const cities = dbCities.length > 0 ? dbCities : turkey.getCities().map((c) => c.name);
    res.json(cities);
  });

  app.get('/api/locations/districts', async (req: Request, res: Response) => {
    const city = req.query.city as string;
    if (!city) return res.status(400).json({ message: "City required" });
    const dbDistricts = await typedStorage.getDistricts(city);
    let districts = dbDistricts;
    if (districts.length === 0) {
      const cityCode = getCityCode(city);
      districts = cityCode ? turkey.getDistrictsByCityCode(cityCode) : [];
    }
    res.json(districts);
  });

  app.get('/api/locations/neighborhoods', async (req: Request, res: Response) => {
    const city = req.query.city as string;
    const district = req.query.district as string;
    if (!city || !district) return res.status(400).json({ message: "City and district required" });
    const dbNeighborhoods = await typedStorage.getNeighborhoods(city, district);
    let neighborhoods = dbNeighborhoods;
    if (neighborhoods.length === 0) {
      const cityCode = getCityCode(city);
      const list = cityCode ? turkey.getNeighbourhoodsByCityCodeAndDistrict(cityCode, district) : [];
      neighborhoods = list.map((name) => ({
        id: 0,
        city,
        district,
        neighborhood: name,
        street: null,
        type: "neighborhood",
        latitude: null,
        longitude: null,
      }));
    }
    res.json(neighborhoods);
  });

  app.get('/api/locations/streets', async (req: Request, res: Response) => {
    const city = req.query.city as string;
    const district = req.query.district as string;
    const neighborhood = req.query.neighborhood as string;
    if (!city || !district || !neighborhood) {
      return res.status(400).json({ message: "City, district and neighborhood required" });
    }
    const streets = await resolveStreets(city, district, neighborhood);
    res.json(streets);
  });

  // httpServer mutlaka registerRoutes fonksiyonu İÇİNDE olmalı
  const httpServer = createServer(app);

  // TEST KULLANICISINI OTOMATİK OLUŞTUR (Sunucu başlarken tarayıcıya girmenize gerek kalmaz)
  (async () => {
    try {
      const email = "admin@komsu.com";
      let user = await typedStorage.getUserByEmail(email);
      if (!user) {
        const locationCode = "İstanbul|Kadıköy|Moda|street|Test Sokak|1|1";
        let building = await typedStorage.getBuildingByLocationCode(locationCode);
        if (!building) {
          building = await typedStorage.createBuilding({
            locationCode,
            addressDetails: "İstanbul / Kadıköy / Moda / Test Sokak No:1 İç Kapı:1",
          });
        }
        const safeId = email.replace(/[.#$\[\]]/g, '_');
        user = await typedStorage.createUser(safeId, {
          firstName: "Eray",
          lastName: "Admin",
          email,
          phone: "+905555555555",
          password: "password123",
          locationCode,
          buildingId: building.id,
          isAdmin: true,
          isApproved: true,
          doorNo: "1",
          innerDoorNo: "1",
        });
        if (!building.adminId) await typedStorage.updateBuildingAdmin(building.id, user.id);
        console.log("✅ OTOMATİK TEST KULLANICISI OLUŞTURULDU: admin@komsu.com / password123");
      } else {
        // EĞER KULLANICI ZATEN VARSA KESİNLİKLE ONAYLI VE ADMİN OLDUĞUNDAN EMİN OL
        await typedStorage.updateUser(user.id, { 
          isApproved: true, 
          isAdmin: true, 
          password: "password123" 
        });
        console.log("✅ TEST KULLANICISI GÜNCELLENDİ VE HAZIR: admin@komsu.com / password123");
      }
    } catch (err) {
      console.error("Test kullanıcısı otomatik oluşturulurken hata:", err);
    }
  })();

  return httpServer;
} // <--- Bu süslü parantez registerRoutes fonksiyonunu kapatır.

// En altta başka bir export satırı varsa sil, fonksiyonun başında 'export async function...' olması yeterli.