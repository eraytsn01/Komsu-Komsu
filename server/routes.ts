import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import * as turkey from "turkey-neighbourhoods";

declare module 'express-session' {
  interface SessionData {
    userId: number;
  }
}

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
      req.session.userId = headerUserId;
    }
  }

  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
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
    elements?: Array<{ tags?: { name?: string; highway?: string } }>;
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
          elements?: Array<{ tags?: { name?: string; highway?: string } }>;
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
  const dbStreets = await storage.getStreets(city, district, neighborhood);
  if (dbStreets.length > 0) return dbStreets;

  const key = `${city}|${district}|${neighborhood}`;
  if (streetsCache.has(key)) {
    return streetsCache.get(key)!;
  }

  try {
    const streets = await fetchStreetsFromOsm(city, district, neighborhood);
    streetsCache.set(key, streets);
    return streets;
  } catch {
    streetsCache.set(key, []);
    return [];
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  const PgSession = connectPgSimple(session);

  app.use(session({
    store: new PgSession({
      pool,
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || 'komsum-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    }
  }));

  // Auth routes
  app.post(api.auth.register.path, async (req, res) => {
    try {
      const input = api.auth.register.input.parse(req.body);
      
      if (input.password !== input.passwordConfirm) {
        return res.status(400).json({ message: "Passwords do not match" });
      }

      const existingUser = await storage.getUserByEmail(input.email);
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
      ].join("|");

      const addressDetails = `${input.city} / ${input.district} / ${input.neighborhood} / ${input.streetType} ${input.street} No:${input.doorNo.trim()}`;

      // Check if building exists
      let building = await storage.getBuildingByLocationCode(locationCode);
      let isAdmin = false;
      let isApproved = false;

      if (!building) {
        // First user creates the building and becomes admin
        building = await storage.createBuilding({
          locationCode,
          addressDetails,
        });
        isAdmin = true;
        isApproved = true; // Admin is auto-approved
      }

      const user = await storage.createUser({
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        password: input.password, // In MVP we store as plain. In prod use bcrypt!
        locationCode,
        buildingId: building.id,
        avatarUrl: input.avatarUrl || null,
        isAdmin,
        isApproved
      });

      if (isAdmin && !building.adminId) {
        await storage.updateBuildingAdmin(building.id, user.id);
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

  app.post(api.auth.login.path, async (req, res) => {
    try {
      const input = api.auth.login.input.parse(req.body);
      const user = await storage.getUserByEmail(input.email);

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

  app.post(api.auth.logout.path, (req, res) => {
    req.session.destroy(() => {
      res.status(200).json({ message: "Logged out" });
    });
  });

  app.get(api.auth.me.path, requireAuth, async (req, res) => {
    const user = await storage.getUser(req.session.userId!);
    if (!user) return res.status(401).json({ message: "User not found" });
    
    const { password, ...userWithoutPassword } = user;
    res.status(200).json(userWithoutPassword);
  });

  // Admin routes
  app.get(api.admin.pendingUsers.path, requireAuth, async (req, res) => {
    const user = await storage.getUser(req.session.userId!);
    if (!user?.isAdmin) return res.status(403).json({ message: "Forbidden" });

    const pending = await storage.getPendingUsersForBuilding(user.buildingId!);
    res.status(200).json(pending.map(u => {
      const { password, ...rest } = u;
      return rest;
    }));
  });

  app.post(api.admin.approveUser.path, requireAuth, async (req, res) => {
    const user = await storage.getUser(req.session.userId!);
    if (!user?.isAdmin) return res.status(403).json({ message: "Forbidden" });

    const targetUserId = parseInt(getSingleParam(req.params.id), 10);
    await storage.approveUser(targetUserId);
    res.status(200).json({ message: "User approved" });
  });

  // App features
  app.get(api.statuses.list.path, requireAuth, async (req, res) => {
    const user = await storage.getUser(req.session.userId!);
    const statuses = await storage.getStatuses();
    // In a real app we'd filter by radius or building. For MVP, we can return all or filter by building
    const buildingStatuses = statuses.filter(s => s.user.buildingId === user?.buildingId);
    res.status(200).json(buildingStatuses);
  });

  app.post(api.statuses.create.path, requireAuth, async (req, res) => {
    const input = api.statuses.create.input.parse(req.body);
    const status = await storage.createStatus({ ...input, userId: req.session.userId! });
    res.status(201).json(status);
  });

  app.post(api.statuses.view.path, requireAuth, async (req, res) => {
    const statusId = parseInt(getSingleParam(req.params.id), 10);
    await storage.recordStatusView(statusId, req.session.userId!);
    res.status(200).json({ success: true });
  });

  app.get(api.statuses.viewers.path, requireAuth, async (req, res) => {
    const statusId = parseInt(getSingleParam(req.params.id), 10);
    const viewers = await storage.getStatusViewers(statusId);
    res.status(200).json(viewers);
  });

  app.get(api.adverts.list.path, requireAuth, async (req, res) => {
    const user = await storage.getUser(req.session.userId!);
    const adverts = await storage.getAdvertsByBuilding(
      user!.buildingId!,
      user?.latitude ? parseFloat(user.latitude) : null,
      user?.longitude ? parseFloat(user.longitude) : null,
    );
    res.status(200).json(adverts);
  });

  app.post(api.adverts.create.path, requireAuth, async (req, res) => {
    const input = api.adverts.create.input.parse(req.body);
    const user = await storage.getUser(req.session.userId!);
    const advert = await storage.createAdvert({ ...input, userId: user!.id, buildingId: user!.buildingId! });
    res.status(201).json(advert);
  });

  app.get('/api/adverts/close-stats', requireAuth, async (req, res) => {
    const user = await storage.getUser(req.session.userId!);
    const stats = await storage.getAdvertCloseStats(user!.buildingId!);
    res.status(200).json(stats);
  });

  app.post('/api/adverts/:id/close', requireAuth, async (req, res) => {
    const id = parseInt(getSingleParam(req.params.id), 10);
    const input = z.object({ reason: z.enum(["sold", "rented", "withdrawn"]) }).parse(req.body);
    const user = await storage.getUser(req.session.userId!);
    const advert = await storage.getAdvert(id);

    if (!advert) return res.status(404).json({ message: "Not found" });
    if (advert.userId !== user!.id) return res.status(403).json({ message: "Forbidden" });

    const closed = await storage.closeAdvert(id, input.reason);
    res.status(200).json(closed);
  });

  app.patch('/api/adverts/:id', requireAuth, async (req, res) => {
    const id = parseInt(getSingleParam(req.params.id), 10);
    const user = await storage.getUser(req.session.userId!);
    const advert = await storage.getAdvert(id);
    if (!advert) return res.status(404).json({ message: "Not found" });
    if (advert.userId !== user!.id && !user!.isAdmin) return res.status(403).json({ message: "Forbidden" });
    const updated = await storage.updateAdvert(id, req.body);
    res.json(updated);
  });

  app.delete('/api/adverts/:id', requireAuth, async (req, res) => {
    const id = parseInt(getSingleParam(req.params.id), 10);
    const user = await storage.getUser(req.session.userId!);
    const advert = await storage.getAdvert(id);
    if (!advert) return res.status(404).json({ message: "Not found" });
    if (advert.userId !== user!.id && !user!.isAdmin) return res.status(403).json({ message: "Forbidden" });
    await storage.deleteAdvert(id);
    res.json({ message: "Deleted" });
  });

  app.delete('/api/statuses/:id', requireAuth, async (req, res) => {
    const id = parseInt(getSingleParam(req.params.id), 10);
    const user = await storage.getUser(req.session.userId!);
    const [status] = await (await storage.getStatuses()).filter(s => s.id === id);
    if (!status) return res.status(404).json({ message: "Not found" });
    if (status.userId !== user!.id && !user!.isAdmin) return res.status(403).json({ message: "Forbidden" });
    await storage.deleteStatus(id);
    res.json({ message: "Deleted" });
  });

  app.get(api.announcements.list.path, requireAuth, async (req, res) => {
    const user = await storage.getUser(req.session.userId!);
    const items = await storage.getAnnouncementsByBuilding(user!.buildingId!);
    const withInteractions = await Promise.all(
      items.map(async (item) => ({
        ...item,
        interactions: await storage.getAnnouncementInteractionSummary(item.id, user!.id),
      })),
    );
    res.status(200).json(withInteractions);
  });

  app.post(api.announcements.create.path, requireAuth, async (req, res) => {
    const input = api.announcements.create.input.parse(req.body);
    const user = await storage.getUser(req.session.userId!);
    if (!user?.isAdmin) return res.status(403).json({ message: "Only admin can create announcements" });
    const announcement = await storage.createAnnouncement({ ...input, userId: user.id, buildingId: user.buildingId! });
    res.status(201).json(announcement);
  });

  app.patch('/api/announcements/:id', requireAuth, async (req, res) => {
    const id = parseInt(getSingleParam(req.params.id), 10);
    const user = await storage.getUser(req.session.userId!);
    const ann = await storage.getAnnouncement(id);
    if (!ann) return res.status(404).json({ message: "Not found" });
    if (ann.userId !== user!.id && !user!.isAdmin) return res.status(403).json({ message: "Forbidden" });
    const updated = await storage.updateAnnouncement(id, req.body);
    res.json(updated);
  });

  app.delete('/api/announcements/:id', requireAuth, async (req, res) => {
    const id = parseInt(getSingleParam(req.params.id), 10);
    const user = await storage.getUser(req.session.userId!);
    const ann = await storage.getAnnouncement(id);
    if (!ann) return res.status(404).json({ message: "Not found" });
    if (ann.userId !== user!.id && !user!.isAdmin) return res.status(403).json({ message: "Forbidden" });
    await storage.deleteAnnouncement(id);
    res.json({ message: "Deleted" });
  });

  app.post('/api/announcements/:id/rsvp', requireAuth, async (req, res) => {
    const id = parseInt(getSingleParam(req.params.id), 10);
    const input = z.object({ response: z.enum(["attending", "not_attending"]) }).parse(req.body);
    const user = await storage.getUser(req.session.userId!);
    const ann = await storage.getAnnouncement(id);
    if (!ann) return res.status(404).json({ message: "Not found" });
    if (ann.buildingId !== user!.buildingId) return res.status(403).json({ message: "Forbidden" });

    const summary = await storage.setAnnouncementRsvp(id, user!.id, input.response);
    res.status(200).json(summary);
  });

  app.post('/api/announcements/:id/reaction', requireAuth, async (req, res) => {
    const id = parseInt(getSingleParam(req.params.id), 10);
    const input = z.object({ type: z.enum(["like", "dislike"]) }).parse(req.body);
    const user = await storage.getUser(req.session.userId!);
    const ann = await storage.getAnnouncement(id);
    if (!ann) return res.status(404).json({ message: "Not found" });
    if (ann.buildingId !== user!.buildingId) return res.status(403).json({ message: "Forbidden" });

    const summary = await storage.setAnnouncementReaction(id, user!.id, input.type);
    res.status(200).json(summary);
  });

  app.get(api.messages.list.path, requireAuth, async (req, res) => {
    const user = await storage.getUser(req.session.userId!);
    const messages = await storage.getMessagesByBuilding(user!.buildingId!);
    res.status(200).json(messages);
  });

  app.post(api.messages.create.path, requireAuth, async (req, res) => {
    const input = api.messages.create.input.parse(req.body);
    const user = await storage.getUser(req.session.userId!);
    const message = await storage.createMessage({ ...input, senderId: user!.id, buildingId: user!.buildingId! });
    res.status(201).json(message);
  });

  app.delete('/api/messages/:id', requireAuth, async (req, res) => {
    const id = parseInt(getSingleParam(req.params.id), 10);
    const user = await storage.getUser(req.session.userId!);
    const msg = await storage.getMessage(id);
    if (!msg) return res.status(404).json({ message: "Not found" });
    if (msg.senderId !== user!.id && !user!.isAdmin) return res.status(403).json({ message: "Forbidden" });
    await storage.deleteMessage(id);
    res.json({ message: "Deleted" });
  });

  app.delete('/api/private-messages/:id', requireAuth, async (req, res) => {
    const id = parseInt(getSingleParam(req.params.id), 10);
    await storage.deletePrivateMessage(id);
    res.json({ message: "Deleted" });
  });

  // Emergency routes
  app.get(api.emergency.list.path, requireAuth, async (req, res) => {
    const user = await storage.getUser(req.session.userId!);
    const alerts = await storage.getActiveEmergencyAlerts(user!.locationCode);
    res.status(200).json(alerts);
  });

  app.post(api.emergency.create.path, requireAuth, async (req, res) => {
    const user = await storage.getUser(req.session.userId!);

    const existing = await storage.getActiveEmergencyAlertByUser(user!.id);
    if (existing) {
      return res.status(200).json({
        ...existing,
        alreadyActive: true,
        message: "Zaten aktif bir acil durum kaydınız var. Önce çözülmesini bekleyin.",
      });
    }

    const alert = await storage.createEmergencyAlert({
      userId: user!.id,
      buildingId: user!.buildingId!,
      locationCode: user!.locationCode
    });
    res.status(201).json({ ...alert, alreadyActive: false });
  });

  app.post(api.emergency.resolve.path, requireAuth, async (req, res) => {
    const user = await storage.getUser(req.session.userId!);
    if (!user?.isAdmin) return res.status(403).json({ message: "Only admin can resolve alerts" });

    const input = api.emergency.resolve.input.parse(req.body);
    const alertId = parseInt(getSingleParam(req.params.id), 10);
    await storage.resolveEmergencyAlert(alertId, input.status);
    res.status(200).json({ message: "Alert resolved" });
  });

  // Private messages
  app.get('/api/conversations', requireAuth, async (req, res) => {
    const convs = await storage.getConversations(req.session.userId!);
    res.json(convs.map(u => {
      const { password, ...rest } = u;
      return rest;
    }));
  });

  app.get('/api/private-messages/:otherUserId', requireAuth, async (req, res) => {
    const otherId = parseInt(getSingleParam(req.params.otherUserId), 10);
    const msgs = await storage.getPrivateMessages(req.session.userId!, otherId);
    res.json(msgs);
  });

  app.post('/api/private-messages', requireAuth, async (req, res) => {
    const input = api.privateMessages.create.input.parse(req.body);
    const msg = await storage.createPrivateMessage({ ...input, senderId: req.session.userId! });
    res.status(201).json(msg);
  });

  // Ads
  app.get('/api/ads', requireAuth, async (req, res) => {
    const ads = await storage.getActiveAds();
    res.json(ads);
  });

  // Users
  app.get('/api/users', requireAuth, async (req, res) => {
    const user = await storage.getUser(req.session.userId!);
    const users = await storage.getAllUsersInBuilding(user!.buildingId!);
    res.json(users.map(u => {
      const { password, ...rest } = u;
      return rest;
    }));
  });

  app.patch('/api/users/me', requireAuth, async (req, res) => {
    const input = api.users.update.input.parse(req.body);
    const user = await storage.updateUser(req.session.userId!, input);
    const { password, ...rest } = user;
    res.json(rest);
  });

  app.get('/api/users/search', requireAuth, async (req, res) => {
    const q = req.query.q as string;
    const results = await storage.searchUsers(q);
    res.json(results.map(({ password, ...u }) => u));
  });

  app.get('/api/users/nearby', requireAuth, async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    const results = await storage.getNearbyUsers(lat, lon, 0.5); // 500m
    res.json(results.map(({ password, ...u }) => u));
  });

  app.post('/api/users/:id/block', requireAuth, async (req, res) => {
    await storage.blockUser(req.session.userId!, parseInt(getSingleParam(req.params.id), 10));
    res.json({ success: true });
  });

  app.post('/api/users/:id/report', requireAuth, async (req, res) => {
    await storage.reportUser(req.session.userId!, parseInt(getSingleParam(req.params.id), 10), req.body.reason);
    res.json({ success: true });
  });

  // Locations
  app.get('/api/locations/cities', async (req, res) => {
    const dbCities = await storage.getCities();
    const cities = dbCities.length > 0 ? dbCities : turkey.getCities().map((c) => c.name);
    res.json(cities);
  });

  app.get('/api/locations/districts', async (req, res) => {
    const city = req.query.city as string;
    if (!city) return res.status(400).json({ message: "City required" });
    const dbDistricts = await storage.getDistricts(city);
    let districts = dbDistricts;
    if (districts.length === 0) {
      const cityCode = getCityCode(city);
      districts = cityCode ? turkey.getDistrictsByCityCode(cityCode) : [];
    }
    res.json(districts);
  });

  app.get('/api/locations/neighborhoods', async (req, res) => {
    const city = req.query.city as string;
    const district = req.query.district as string;
    if (!city || !district) return res.status(400).json({ message: "City and district required" });
    const dbNeighborhoods = await storage.getNeighborhoods(city, district);
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

  app.get('/api/locations/streets', async (req, res) => {
    const city = req.query.city as string;
    const district = req.query.district as string;
    const neighborhood = req.query.neighborhood as string;
    if (!city || !district || !neighborhood) {
      return res.status(400).json({ message: "City, district and neighborhood required" });
    }
    const streets = await resolveStreets(city, district, neighborhood);
    res.json(streets);
  });

  return httpServer;
}
