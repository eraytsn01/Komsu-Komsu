import { db } from "./db";
import {
  users, buildings, statuses, statusViews, adverts, announcements, announcementRsvps, announcementLikes, messages, emergencyAlerts, privateMessages, ads, locations, reports, blocks,
  type User, type Building, type Status, type StatusView, type Advert, type Announcement, type Message, type EmergencyAlert, type PrivateMessage, type Ad, type Location,
  type InsertUser, type InsertBuilding, type InsertStatus, type InsertAdvert, type InsertAnnouncement, type InsertMessage, type InsertEmergencyAlert, type InsertPrivateMessage, type InsertAd
} from "@shared/schema";
import { eq, and, or, desc, sql, isNotNull } from "drizzle-orm";

export interface IStorage {
  // Building ops
  getBuildingByLocationCode(code: string): Promise<Building | undefined>;
  createBuilding(building: InsertBuilding): Promise<Building>;
  updateBuildingAdmin(id: number, adminId: number): Promise<void>;

  // User ops
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser & { buildingId: number, isAdmin: boolean, isApproved: boolean }): Promise<User>;
  getPendingUsersForBuilding(buildingId: number): Promise<User[]>;
  approveUser(id: number): Promise<User>;

  // Statuses ops
  getStatuses(): Promise<(Status & { user: User })[]>;
  createStatus(status: Omit<InsertStatus, "expiresAt"> & { userId: number }): Promise<Status>;
  recordStatusView(statusId: number, viewerId: number): Promise<void>;
  getStatusViewers(statusId: number): Promise<(StatusView & { user: User })[]>;

  // Statuses ops
  deleteStatus(id: number): Promise<void>;

  // Adverts ops
  getAdvertsByBuilding(buildingId: number, userLat?: number | null, userLon?: number | null): Promise<(Advert & { user: { firstName: string; lastName: string; avatarUrl: string | null } })[]>;
  createAdvert(advert: InsertAdvert & { userId: number, buildingId: number }): Promise<Advert>;
  updateAdvert(id: number, data: Partial<Advert>): Promise<Advert>;
  closeAdvert(id: number, reason: "sold" | "rented" | "withdrawn"): Promise<Advert>;
  getAdvertCloseStats(buildingId: number): Promise<{ sold: number; rented: number; withdrawn: number }>;
  deleteAdvert(id: number): Promise<void>;
  getAdvert(id: number): Promise<Advert | undefined>;

  // Announcements ops
  getAnnouncementsByBuilding(buildingId: number): Promise<Announcement[]>;
  createAnnouncement(announcement: InsertAnnouncement & { userId: number, buildingId: number }): Promise<Announcement>;
  updateAnnouncement(id: number, data: Partial<Announcement>): Promise<Announcement>;
  deleteAnnouncement(id: number): Promise<void>;
  getAnnouncement(id: number): Promise<Announcement | undefined>;
  setAnnouncementRsvp(announcementId: number, userId: number, response: "attending" | "not_attending"): Promise<{ attending: number; notAttending: number; userResponse: "attending" | "not_attending" | null }>;
  setAnnouncementReaction(announcementId: number, userId: number, type: "like" | "dislike"): Promise<{ likes: number; dislikes: number; userType: "like" | "dislike" | null }>;
  getAnnouncementInteractionSummary(announcementId: number, userId?: number): Promise<{ attending: number; notAttending: number; likes: number; dislikes: number; userResponse: "attending" | "not_attending" | null; userType: "like" | "dislike" | null }>;

  // Messages ops
  getMessagesByBuilding(buildingId: number): Promise<(Message & { sender: User })[]>;
  createMessage(message: InsertMessage & { senderId: number, buildingId: number }): Promise<Message>;
  deleteMessage(id: number): Promise<void>;
  getMessage(id: number): Promise<Message | undefined>;

  // Private Messages delete
  deletePrivateMessage(id: number): Promise<void>;

  // Emergency ops
  getActiveEmergencyAlerts(locationCode: string): Promise<(EmergencyAlert & { user: User })[]>;
  getActiveEmergencyAlertByUser(userId: number): Promise<EmergencyAlert | undefined>;
  createEmergencyAlert(alert: { userId: number, buildingId: number, locationCode: string }): Promise<EmergencyAlert>;
  resolveEmergencyAlert(id: number, status: string): Promise<void>;

  // Private Messages ops
  getPrivateMessages(userId1: number, userId2: number): Promise<PrivateMessage[]>;
  getConversations(userId: number): Promise<any[]>;
  createPrivateMessage(msg: InsertPrivateMessage & { senderId: number }): Promise<PrivateMessage>;

  // Ads ops
  getActiveAds(): Promise<Ad[]>;

  // Users ops extra
  getAllUsersInBuilding(buildingId: number): Promise<User[]>;
  searchUsers(query: string): Promise<User[]>;
  getNearbyUsers(lat: number, lon: number, radiusKm: number): Promise<User[]>;
  blockUser(blockerId: number, blockedId: number): Promise<void>;
  reportUser(reporterId: number, reportedId: number, reason: string): Promise<void>;
  isBlocked(userId1: number, userId2: number): Promise<boolean>;
  updateUser(id: number, data: Partial<User>): Promise<User>;

  // Locations ops
  getLocations(city?: string, district?: string): Promise<Location[]>;
  getCities(): Promise<string[]>;
  getDistricts(city: string): Promise<string[]>;
  getNeighborhoods(city: string, district: string): Promise<Location[]>;
  getStreets(city: string, district: string, neighborhood: string): Promise<Array<{ street: string; type: string }>>;
}

export class DatabaseStorage implements IStorage {
  async getBuildingByLocationCode(code: string): Promise<Building | undefined> {
    const [building] = await db.select().from(buildings).where(eq(buildings.locationCode, code));
    return building;
  }

  async createBuilding(building: InsertBuilding): Promise<Building> {
    const [newBuilding] = await db.insert(buildings).values(building).returning();
    return newBuilding;
  }

  async updateBuildingAdmin(id: number, adminId: number): Promise<void> {
    await db.update(buildings).set({ adminId }).where(eq(buildings.id, id));
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(user: InsertUser & { buildingId: number, isAdmin: boolean, isApproved: boolean }): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async getPendingUsersForBuilding(buildingId: number): Promise<User[]> {
    return await db.select().from(users).where(
      and(eq(users.buildingId, buildingId), eq(users.isApproved, false))
    );
  }

  async approveUser(id: number): Promise<User> {
    const [updated] = await db.update(users).set({ isApproved: true }).where(eq(users.id, id)).returning();
    return updated;
  }

  async getStatuses(): Promise<(Status & { user: User })[]> {
    const rows = await db.select().from(statuses)
      .innerJoin(users, eq(statuses.userId, users.id));
    return rows.map(r => ({ ...r.statuses, user: r.users }));
  }

  async createStatus(status: Omit<InsertStatus, "expiresAt"> & { userId: number }): Promise<Status> {
    const [newStatus] = await db.insert(statuses).values({
      ...status,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    }).returning();
    return newStatus;
  }

  async recordStatusView(statusId: number, viewerId: number): Promise<void> {
    const [existing] = await db.select().from(statusViews).where(and(eq(statusViews.statusId, statusId), eq(statusViews.viewerId, viewerId)));
    if (!existing) {
      await db.insert(statusViews).values({ statusId, viewerId });
    }
  }

  async getStatusViewers(statusId: number): Promise<(StatusView & { user: User })[]> {
    const rows = await db.select().from(statusViews)
      .innerJoin(users, eq(statusViews.viewerId, users.id))
      .where(eq(statusViews.statusId, statusId));
    return rows.map(r => ({ ...r.status_views, user: r.users }));
  }

  async getAdvertsByBuilding(buildingId: number, userLat?: number | null, userLon?: number | null): Promise<(Advert & { user: { firstName: string; lastName: string; avatarUrl: string | null } })[]> {
    const rows = await db.select({
      advert: adverts,
      user: { firstName: users.firstName, lastName: users.lastName, avatarUrl: users.avatarUrl, lat: users.latitude, lon: users.longitude },
    }).from(adverts)
      .innerJoin(users, eq(adverts.userId, users.id))
      .where(and(eq(adverts.buildingId, buildingId), eq(adverts.status, "active")))
      .orderBy(sql`${adverts.createdAt} DESC`);

    return rows.filter(row => {
      // If user has no coords or poster has no coords — show all
      if (!userLat || !userLon || !row.user.lat || !row.user.lon) return true;
      // Haversine distance
      const rowLat = parseFloat(row.user.lat);
      const rowLon = parseFloat(row.user.lon);
      if (Number.isNaN(rowLat) || Number.isNaN(rowLon)) return true;
      const R = 6371000;
      const dLat = (rowLat - userLat) * Math.PI / 180;
      const dLon = (rowLon - userLon) * Math.PI / 180;
      const a = Math.sin(dLat/2)**2 + Math.cos(userLat * Math.PI/180) * Math.cos(rowLat * Math.PI/180) * Math.sin(dLon/2)**2;
      const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return dist <= (row.advert.visibilityRadius ?? 500);
    }).map(row => ({ ...row.advert, user: { firstName: row.user.firstName, lastName: row.user.lastName, avatarUrl: row.user.avatarUrl } }));
  }

  async deleteStatus(id: number): Promise<void> {
    await db.delete(statuses).where(eq(statuses.id, id));
  }

  async createAdvert(advert: InsertAdvert & { userId: number, buildingId: number }): Promise<Advert> {
    const [newAdvert] = await db.insert(adverts).values(advert).returning();
    return newAdvert;
  }

  async getAdvert(id: number): Promise<Advert | undefined> {
    const [a] = await db.select().from(adverts).where(eq(adverts.id, id));
    return a;
  }

  async updateAdvert(id: number, data: Partial<Advert>): Promise<Advert> {
    const [updated] = await db.update(adverts).set(data).where(eq(adverts.id, id)).returning();
    return updated;
  }

  async closeAdvert(id: number, reason: "sold" | "rented" | "withdrawn"): Promise<Advert> {
    const [updated] = await db.update(adverts)
      .set({
        status: reason,
        closedReason: reason,
        closedAt: new Date(),
      })
      .where(eq(adverts.id, id))
      .returning();
    return updated;
  }

  async getAdvertCloseStats(buildingId: number): Promise<{ sold: number; rented: number; withdrawn: number }> {
    const [counts] = await db.select({
      sold: sql<number>`count(*) filter (where ${adverts.closedReason} = 'sold')`,
      rented: sql<number>`count(*) filter (where ${adverts.closedReason} = 'rented')`,
      withdrawn: sql<number>`count(*) filter (where ${adverts.closedReason} = 'withdrawn')`,
    }).from(adverts).where(eq(adverts.buildingId, buildingId));

    return {
      sold: Number(counts?.sold ?? 0),
      rented: Number(counts?.rented ?? 0),
      withdrawn: Number(counts?.withdrawn ?? 0),
    };
  }

  async deleteAdvert(id: number): Promise<void> {
    await db.delete(adverts).where(eq(adverts.id, id));
  }

  async getAnnouncementsByBuilding(buildingId: number): Promise<Announcement[]> {
    return await db.select().from(announcements)
      .where(eq(announcements.buildingId, buildingId))
      .orderBy(sql`${announcements.createdAt} DESC`);
  }

  async createAnnouncement(announcement: InsertAnnouncement & { userId: number, buildingId: number }): Promise<Announcement> {
    const [newAnnouncement] = await db.insert(announcements).values(announcement).returning();
    return newAnnouncement;
  }

  async getAnnouncement(id: number): Promise<Announcement | undefined> {
    const [a] = await db.select().from(announcements).where(eq(announcements.id, id));
    return a;
  }

  async setAnnouncementRsvp(announcementId: number, userId: number, response: "attending" | "not_attending"): Promise<{ attending: number; notAttending: number; userResponse: "attending" | "not_attending" | null }> {
    const [existing] = await db.select().from(announcementRsvps).where(
      and(eq(announcementRsvps.announcementId, announcementId), eq(announcementRsvps.userId, userId))
    );

    let userResponse: "attending" | "not_attending" | null = response;

    if (!existing) {
      await db.insert(announcementRsvps).values({ announcementId, userId, response });
    } else if (existing.response === response) {
      await db.delete(announcementRsvps).where(eq(announcementRsvps.id, existing.id));
      userResponse = null;
    } else {
      await db.update(announcementRsvps)
        .set({ response, createdAt: new Date() })
        .where(eq(announcementRsvps.id, existing.id));
    }

    const [counts] = await db.select({
      attending: sql<number>`count(*) filter (where ${announcementRsvps.response} = 'attending')`,
      notAttending: sql<number>`count(*) filter (where ${announcementRsvps.response} = 'not_attending')`,
    }).from(announcementRsvps).where(eq(announcementRsvps.announcementId, announcementId));

    return {
      attending: Number(counts?.attending ?? 0),
      notAttending: Number(counts?.notAttending ?? 0),
      userResponse,
    };
  }

  async setAnnouncementReaction(announcementId: number, userId: number, type: "like" | "dislike"): Promise<{ likes: number; dislikes: number; userType: "like" | "dislike" | null }> {
    const [existing] = await db.select().from(announcementLikes).where(
      and(eq(announcementLikes.announcementId, announcementId), eq(announcementLikes.userId, userId))
    );

    let userType: "like" | "dislike" | null = type;

    if (!existing) {
      await db.insert(announcementLikes).values({ announcementId, userId, type });
    } else if (existing.type === type) {
      await db.delete(announcementLikes).where(eq(announcementLikes.id, existing.id));
      userType = null;
    } else {
      await db.update(announcementLikes)
        .set({ type, createdAt: new Date() })
        .where(eq(announcementLikes.id, existing.id));
    }

    const [counts] = await db.select({
      likes: sql<number>`count(*) filter (where ${announcementLikes.type} = 'like')`,
      dislikes: sql<number>`count(*) filter (where ${announcementLikes.type} = 'dislike')`,
    }).from(announcementLikes).where(eq(announcementLikes.announcementId, announcementId));

    return {
      likes: Number(counts?.likes ?? 0),
      dislikes: Number(counts?.dislikes ?? 0),
      userType,
    };
  }

  async getAnnouncementInteractionSummary(announcementId: number, userId?: number): Promise<{ attending: number; notAttending: number; likes: number; dislikes: number; userResponse: "attending" | "not_attending" | null; userType: "like" | "dislike" | null }> {
    const [rsvpCounts] = await db.select({
      attending: sql<number>`count(*) filter (where ${announcementRsvps.response} = 'attending')`,
      notAttending: sql<number>`count(*) filter (where ${announcementRsvps.response} = 'not_attending')`,
    }).from(announcementRsvps).where(eq(announcementRsvps.announcementId, announcementId));

    const [likeCounts] = await db.select({
      likes: sql<number>`count(*) filter (where ${announcementLikes.type} = 'like')`,
      dislikes: sql<number>`count(*) filter (where ${announcementLikes.type} = 'dislike')`,
    }).from(announcementLikes).where(eq(announcementLikes.announcementId, announcementId));

    let userResponse: "attending" | "not_attending" | null = null;
    let userType: "like" | "dislike" | null = null;

    if (userId) {
      const [rsvp] = await db.select().from(announcementRsvps).where(
        and(eq(announcementRsvps.announcementId, announcementId), eq(announcementRsvps.userId, userId))
      );
      const [reaction] = await db.select().from(announcementLikes).where(
        and(eq(announcementLikes.announcementId, announcementId), eq(announcementLikes.userId, userId))
      );
      userResponse = (rsvp?.response as "attending" | "not_attending" | undefined) ?? null;
      userType = (reaction?.type as "like" | "dislike" | undefined) ?? null;
    }

    return {
      attending: Number(rsvpCounts?.attending ?? 0),
      notAttending: Number(rsvpCounts?.notAttending ?? 0),
      likes: Number(likeCounts?.likes ?? 0),
      dislikes: Number(likeCounts?.dislikes ?? 0),
      userResponse,
      userType,
    };
  }

  async updateAnnouncement(id: number, data: Partial<Announcement>): Promise<Announcement> {
    const [updated] = await db.update(announcements).set(data).where(eq(announcements.id, id)).returning();
    return updated;
  }

  async deleteAnnouncement(id: number): Promise<void> {
    await db.delete(announcementRsvps).where(eq(announcementRsvps.announcementId, id));
    await db.delete(announcementLikes).where(eq(announcementLikes.announcementId, id));
    await db.delete(announcements).where(eq(announcements.id, id));
  }

  async getMessagesByBuilding(buildingId: number): Promise<(Message & { sender: User })[]> {
    const rows = await db.select().from(messages)
      .innerJoin(users, eq(messages.senderId, users.id))
      .where(eq(messages.buildingId, buildingId))
      .orderBy(messages.createdAt);
    return rows.map(r => ({ ...r.messages, sender: r.users }));
  }

  async createMessage(message: InsertMessage & { senderId: number, buildingId: number }): Promise<Message> {
    const [newMessage] = await db.insert(messages).values(message).returning();
    return newMessage;
  }

  async getMessage(id: number): Promise<Message | undefined> {
    const [m] = await db.select().from(messages).where(eq(messages.id, id));
    return m;
  }

  async deleteMessage(id: number): Promise<void> {
    await db.delete(messages).where(eq(messages.id, id));
  }

  async deletePrivateMessage(id: number): Promise<void> {
    await db.delete(privateMessages).where(eq(privateMessages.id, id));
  }

  async getActiveEmergencyAlerts(locationCode: string): Promise<(EmergencyAlert & { user: User })[]> {
    const rows = await db.select().from(emergencyAlerts)
      .innerJoin(users, eq(emergencyAlerts.userId, users.id))
      .where(and(eq(emergencyAlerts.locationCode, locationCode), eq(emergencyAlerts.status, "active")));
    return rows.map(r => ({ ...r.emergency_alerts, user: r.users }));
  }

  async getActiveEmergencyAlertByUser(userId: number): Promise<EmergencyAlert | undefined> {
    const [alert] = await db
      .select()
      .from(emergencyAlerts)
      .where(and(eq(emergencyAlerts.userId, userId), eq(emergencyAlerts.status, "active")))
      .orderBy(desc(emergencyAlerts.createdAt));

    return alert;
  }

  async createEmergencyAlert(alert: { userId: number, buildingId: number, locationCode: string }): Promise<EmergencyAlert> {
    const [newAlert] = await db.insert(emergencyAlerts).values({
      ...alert,
      status: "active"
    }).returning();
    return newAlert;
  }

  async resolveEmergencyAlert(id: number, status: string): Promise<void> {
    await db.update(emergencyAlerts)
      .set({ status, resolvedAt: new Date() })
      .where(eq(emergencyAlerts.id, id));
  }

  async getPrivateMessages(userId1: number, userId2: number): Promise<PrivateMessage[]> {
    return await db.select().from(privateMessages)
      .where(or(
        and(eq(privateMessages.senderId, userId1), eq(privateMessages.receiverId, userId2)),
        and(eq(privateMessages.senderId, userId2), eq(privateMessages.receiverId, userId1))
      ))
      .orderBy(privateMessages.createdAt);
  }

  async getConversations(userId: number): Promise<any[]> {
    // Simplified for MVP: get all unique users I've messaged or who messaged me
    const sent = await db.select().from(privateMessages).where(eq(privateMessages.senderId, userId));
    const received = await db.select().from(privateMessages).where(eq(privateMessages.receiverId, userId));
    const userIds = Array.from(new Set([...sent.map(m => m.receiverId), ...received.map(m => m.senderId)]));
    if (userIds.length === 0) return [];
    return await db.select().from(users).where(or(...userIds.map(id => eq(users.id, id))));
  }

  async createPrivateMessage(msg: InsertPrivateMessage & { senderId: number }): Promise<PrivateMessage> {
    const [newMsg] = await db.insert(privateMessages).values(msg).returning();
    return newMsg;
  }

  async getActiveAds(): Promise<Ad[]> {
    return await db.select().from(ads).where(eq(ads.isActive, true));
  }

  async getAllUsersInBuilding(buildingId: number): Promise<User[]> {
    return await db.select().from(users).where(eq(users.buildingId, buildingId));
  }

  async searchUsers(query: string): Promise<User[]> {
    return await db.select().from(users).where(
      or(
        eq(users.firstName, query),
        eq(users.lastName, query),
        eq(users.email, query),
        eq(users.phone, query)
      )
    );
  }

  async getNearbyUsers(lat: number, lon: number, radiusKm: number): Promise<User[]> {
    const allUsers = await db.select().from(users);
    return allUsers.filter(u => {
      if (!u.latitude || !u.longitude) return false;
      const dLat = (parseFloat(u.latitude) - lat) * Math.PI / 180;
      const dLon = (parseFloat(u.longitude) - lon) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat * Math.PI / 180) * Math.cos(parseFloat(u.latitude) * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const d = 6371 * c; // Distance in km
      return d <= radiusKm;
    });
  }

  async blockUser(blockerId: number, blockedId: number): Promise<void> {
    await db.insert(blocks).values({ blockerId, blockedId });
  }

  async reportUser(reporterId: number, reportedId: number, reason: string): Promise<void> {
    await db.insert(reports).values({ reporterId, reportedId, reason });
  }

  async isBlocked(userId1: number, userId2: number): Promise<boolean> {
    const [b] = await db.select().from(blocks).where(
      or(
        and(eq(blocks.blockerId, userId1), eq(blocks.blockedId, userId2)),
        and(eq(blocks.blockerId, userId2), eq(blocks.blockedId, userId1))
      )
    );
    return !!b;
  }

  async updateUser(id: number, data: Partial<User>): Promise<User> {
    const [updated] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return updated;
  }

  async getLocations(city?: string, district?: string): Promise<Location[]> {
    if (city && district) {
      return db.select().from(locations).where(and(eq(locations.city, city), eq(locations.district, district)));
    }
    if (city) {
      return db.select().from(locations).where(eq(locations.city, city));
    }
    if (district) {
      return db.select().from(locations).where(eq(locations.district, district));
    }
    return db.select().from(locations);
  }

  async getCities(): Promise<string[]> {
    const results = await db.select({ city: locations.city }).from(locations).groupBy(locations.city);
    return results.map(r => r.city).sort();
  }

  async getDistricts(city: string): Promise<string[]> {
    const results = await db.select({ district: locations.district }).from(locations)
      .where(eq(locations.city, city))
      .groupBy(locations.district);
    return results.map(r => r.district).sort();
  }

  async getNeighborhoods(city: string, district: string): Promise<Location[]> {
    return await db.select().from(locations)
      .where(and(eq(locations.city, city), eq(locations.district, district)))
      .orderBy(locations.neighborhood);
  }

  async getStreets(city: string, district: string, neighborhood: string): Promise<Array<{ street: string; type: string }>> {
    const rows = await db
      .select({ street: locations.street, type: locations.type })
      .from(locations)
      .where(
        and(
          eq(locations.city, city),
          eq(locations.district, district),
          eq(locations.neighborhood, neighborhood),
          isNotNull(locations.street)
        )
      )
      .groupBy(locations.street, locations.type)
      .orderBy(locations.street);

    return rows
      .filter((row): row is { street: string; type: string } => !!row.street)
      .map((row) => ({ street: row.street, type: row.type }));
  }
}

export const storage = new DatabaseStorage();
