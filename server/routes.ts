
import express, { Request, Response, NextFunction } from "express";
import session from "express-session";
import type { Session, SessionData } from "express-session";
import { storage, FirebaseStorage, User } from "./storage";
import { api } from "../shared/routes";
import { z } from "zod";
const typedStorage = storage;
// Express session tipi genişletme
declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}
import { addPendingStreet, getPendingStreets, approvePendingStreet, rejectPendingStreet } from "./pendingStreets";
import { sendPushToTokens } from "./firebase-admin";
import * as turkey from "turkey-neighbourhoods";

// --- Yardımcı Fonksiyonlar ve Değişkenler ---
function getUserIdFromHeader(req: Request) {
  const rawUserId = req.header("x-user-id");
  if (!rawUserId) return undefined;
  const userId = Number.parseInt(rawUserId, 10);
  return Number.isNaN(userId) ? undefined : userId;
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
// Eksik storage fonksiyonları için stub ekle
if (!("getAllUsersInBuilding" in storage)) {
  (storage as any).getAllUsersInBuilding = async (buildingId: string) => [];
}
if (!("getStreets" in storage)) {
  (storage as any).getStreets = async (city: string, district: string, neighborhood: string) => [];
}

// --- Route Tanımları ---
function registerRoutes(app: express.Application) {


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
      const user = await typedStorage.createUser(input.email, {
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

  app.post(api.auth.login.path, async (req: Request, res: Response) => {
    try {
      const input = api.auth.login.input.parse(req.body);
      const user = await typedStorage.getUserByEmail(input.email);

      if (!user || user.password !== input.password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      if (!user.isApproved) {
        return res.status(403).json({ message: "Pending admin approval" });
      }

      req.session.userId = user.id;

      const { password, ...userWithoutPassword } = user;
      res.status(200).json(userWithoutPassword);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal error" });
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

    const targetUserId = parseInt(getSingleParam(req.params.id), 10);
    await typedStorage.approveUser(String(targetUserId));
    res.status(200).json({ message: "User approved" });
  });

  // App features
  app.get(api.statuses.list.path, requireAuth, async (req: Request, res: Response) => {
    const user = await typedStorage.getUser(req.session.userId!);
    const statuses = await typedStorage.getStatuses();
    // In a real app we'd filter by radius or building. For MVP, we can return all or filter by building
    const buildingStatuses = statuses.filter((s: any) => s.user.buildingId === user?.buildingId);
    res.status(200).json(buildingStatuses);
  });

  app.post(api.statuses.create.path, requireAuth, async (req: Request, res: Response) => {
    const input = api.statuses.create.input.parse(req.body);
    const status = await typedStorage.createStatus(req.session.userId!, { ...input, userId: req.session.userId! });
    res.status(201).json(status);
  });

  app.post(api.statuses.view.path, requireAuth, async (req: Request, res: Response) => {
    const statusId = parseInt(getSingleParam(req.params.id), 10);
    await typedStorage.recordStatusView(String(statusId), String(req.session.userId!));
    res.status(200).json({ success: true });
  });

  app.get(api.statuses.viewers.path, requireAuth, async (req: Request, res: Response) => {
    const statusId = parseInt(getSingleParam(req.params.id), 10);
    const viewers = await typedStorage.getStatusViewers(String(statusId));
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
    const id = parseInt(getSingleParam(req.params.id), 10);
    const input = z.object({ reason: z.enum(["sold", "rented", "withdrawn"]) }).parse(req.body);
    const user = await storage.getUser(req.session.userId!);
    const advert = await typedStorage.getAdvert(String(id));

    if (!advert) return res.status(404).json({ message: "Not found" });
    if (advert.userId !== user!.id) return res.status(403).json({ message: "Forbidden" });

    const closed = await typedStorage.closeAdvert(String(id), input.reason);
    res.status(200).json(closed);
  });

  app.patch('/api/adverts/:id', requireAuth, async (req: Request, res: Response) => {
    const id = parseInt(getSingleParam(req.params.id), 10);
    const user = await storage.getUser(req.session.userId!);
    const advert = await typedStorage.getAdvert(String(id));
    if (!advert) return res.status(404).json({ message: "Not found" });
    if (advert.userId !== user!.id && !user!.isAdmin) return res.status(403).json({ message: "Forbidden" });
    const updated = await typedStorage.updateAdvert(String(id), req.body);
    res.json(updated);
  });

  app.delete('/api/adverts/:id', requireAuth, async (req: Request, res: Response) => {
    const id = parseInt(getSingleParam(req.params.id), 10);
    const user = await storage.getUser(req.session.userId!);
    const advert = await typedStorage.getAdvert(String(id));
    if (!advert) return res.status(404).json({ message: "Not found" });
    if (advert.userId !== user!.id && !user!.isAdmin) return res.status(403).json({ message: "Forbidden" });
    await typedStorage.deleteAdvert(String(id));
    res.json({ message: "Deleted" });
  });

  app.delete('/api/statuses/:id', requireAuth, async (req: Request, res: Response) => {
    const id = parseInt(getSingleParam(req.params.id), 10);
    const user = await storage.getUser(req.session.userId!);
    const statusesList = await typedStorage.getStatuses();
    const status = statusesList.find((s: any) => s.id === id);
    if (!status) return res.status(404).json({ message: "Not found" });
    if (status.userId !== user!.id && !user!.isAdmin) return res.status(403).json({ message: "Forbidden" });
    await typedStorage.deleteStatus(String(id));
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
    const id = parseInt(getSingleParam(req.params.id), 10);
    const user = await storage.getUser(req.session.userId!);
    const ann = await typedStorage.getAnnouncement(String(id));
    if (!ann) return res.status(404).json({ message: "Not found" });
    if (ann.userId !== user!.id && !user!.isAdmin) return res.status(403).json({ message: "Forbidden" });
    const updated = await typedStorage.updateAnnouncement(String(id), req.body);
    res.json(updated);
  });

  app.delete('/api/announcements/:id', requireAuth, async (req: Request, res: Response) => {
    const id = parseInt(getSingleParam(req.params.id), 10);
    const user = await storage.getUser(req.session.userId!);
    const ann = await storage.getAnnouncement(String(id));
    if (!ann) return res.status(404).json({ message: "Not found" });
    if (ann.userId !== user!.id && !user!.isAdmin) return res.status(403).json({ message: "Forbidden" });
    await typedStorage.deleteAnnouncement(String(id));
    res.json({ message: "Deleted" });
  });

  app.post('/api/announcements/:id/rsvp', requireAuth, async (req: Request, res: Response) => {
    const id = parseInt(getSingleParam(req.params.id), 10);
    const input = z.object({ response: z.enum(["attending", "not_attending"]) }).parse(req.body);
    const user = await storage.getUser(req.session.userId!);
    const ann = await typedStorage.getAnnouncement(String(id));
    if (!ann) return res.status(404).json({ message: "Not found" });
    if (ann.buildingId !== user!.buildingId) return res.status(403).json({ message: "Forbidden" });

    const summary = await typedStorage.setAnnouncementRsvp(String(id), user!.id, input.response);
    res.status(200).json(summary);
  });

  app.post('/api/announcements/:id/reaction', requireAuth, async (req: Request, res: Response) => {
    const id = parseInt(getSingleParam(req.params.id), 10);
    const input = z.object({ type: z.enum(["like", "dislike"]) }).parse(req.body);
    const user = await storage.getUser(req.session.userId!);
    const ann = await storage.getAnnouncement(String(id));
    if (!ann) return res.status(404).json({ message: "Not found" });
    if (ann.buildingId !== user!.buildingId) return res.status(403).json({ message: "Forbidden" });

    const summary = await typedStorage.setAnnouncementReaction(String(id), user!.id, input.type);
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
    const id = parseInt(getSingleParam(req.params.id), 10);
    const user = await storage.getUser(req.session.userId!);
    const msg = await typedStorage.getMessage(String(id));
    if (!msg) return res.status(404).json({ message: "Not found" });
    if (msg.senderId !== user!.id && !user!.isAdmin) return res.status(403).json({ message: "Forbidden" });
    await typedStorage.deleteMessage(String(id));
    res.json({ message: "Deleted" });
  });

  app.delete('/api/private-messages/:id', requireAuth, async (req: Request, res: Response) => {
    const id = parseInt(getSingleParam(req.params.id), 10);
    await typedStorage.deletePrivateMessage(String(id));
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
    const alertId = parseInt(getSingleParam(req.params.id), 10);
    await typedStorage.resolveEmergencyAlert(String(alertId), input.status);
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
    const otherId = parseInt(getSingleParam(req.params.otherUserId), 10);
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
    await typedStorage.blockUser(req.session.userId!, parseInt(getSingleParam(req.params.id), 10));
    res.json({ success: true });
  });

  app.post('/api/users/:id/report', requireAuth, async (req: Request, res: Response) => {
    await typedStorage.reportUser(req.session.userId!, parseInt(getSingleParam(req.params.id), 10), req.body.reason);
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
}

export { registerRoutes };