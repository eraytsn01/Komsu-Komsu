import { pgTable, text, serial, integer, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const buildings = pgTable("buildings", {
  id: serial("id").primaryKey(),
  locationCode: text("location_code").notNull().unique(),
  addressDetails: text("address_details").notNull(),
  adminId: integer("admin_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  locationCode: text("location_code").notNull(),
  buildingId: integer("building_id").references(() => buildings.id),
  avatarUrl: text("avatar_url"),
  latitude: text("latitude"),
  longitude: text("longitude"),
  fcmToken: text("fcm_token"),
  isAdmin: boolean("is_admin").default(false),
  isApproved: boolean("is_approved").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const privateMessages = pgTable("private_messages", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").notNull().references(() => users.id),
  receiverId: integer("receiver_id").notNull().references(() => users.id),
  content: text("content"),
  fileUrl: text("file_url"),
  fileName: text("file_name"),
  location: text("location"), // JSON string or lat,lng
  createdAt: timestamp("created_at").defaultNow(),
});

export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  reporterId: integer("reporter_id").notNull().references(() => users.id),
  reportedId: integer("reported_id").notNull().references(() => users.id),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const blocks = pgTable("blocks", {
  id: serial("id").primaryKey(),
  blockerId: integer("blocker_id").notNull().references(() => users.id),
  blockedId: integer("blocked_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const ads = pgTable("ads", {
  id: serial("id").primaryKey(),
  imageUrl: text("image_url").notNull(),
  linkUrl: text("link_url"),
  position: text("position").default("bottom"), // top, bottom, middle
  isActive: boolean("is_active").default(true),
});

export const locations = pgTable("locations", {
  id: serial("id").primaryKey(),
  city: text("city").notNull(), // İstanbul, Ankara, İzmir...
  district: text("district").notNull(), // Beyoğlu, Çankaya, Konak...
  neighborhood: text("neighborhood").notNull(), // Mahalle
  street: text("street"), // Sokak/Cadde/Bulvar
  type: text("type").notNull().default("neighborhood"), // neighborhood, street, avenue, boulevard
  latitude: text("latitude"),
  longitude: text("longitude"),
});

export const statuses = pgTable("statuses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  content: text("content"),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const statusViews = pgTable("status_views", {
  id: serial("id").primaryKey(),
  statusId: integer("status_id").notNull().references(() => statuses.id),
  viewerId: integer("viewer_id").notNull().references(() => users.id),
  viewedAt: timestamp("viewed_at").defaultNow(),
});

export const adverts = pgTable("adverts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  buildingId: integer("building_id").notNull().references(() => buildings.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  price: text("price"),
  currency: text("currency").default("₺"),
  imageUrl: text("image_url"),
  visibilityRadius: integer("visibility_radius").notNull().default(500),
  status: text("status").notNull().default("active"), // active | sold | rented | withdrawn
  closedReason: text("closed_reason"), // sold | rented | withdrawn
  closedAt: timestamp("closed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const announcements = pgTable("announcements", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  buildingId: integer("building_id").notNull().references(() => buildings.id),
  title: text("title").notNull(),
  content: text("content").notNull(),
  imageUrl: text("image_url"),
  eventDate: timestamp("event_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const announcementRsvps = pgTable("announcement_rsvps", {
  id: serial("id").primaryKey(),
  announcementId: integer("announcement_id").notNull().references(() => announcements.id),
  userId: integer("user_id").notNull().references(() => users.id),
  response: text("response").notNull(), // attending | not_attending
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  announcementUserUnique: uniqueIndex("announcement_rsvps_announcement_user_unique").on(table.announcementId, table.userId),
}));

export const announcementLikes = pgTable("announcement_likes", {
  id: serial("id").primaryKey(),
  announcementId: integer("announcement_id").notNull().references(() => announcements.id),
  userId: integer("user_id").notNull().references(() => users.id),
  type: text("type").notNull(), // like | dislike
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  announcementUserUnique: uniqueIndex("announcement_likes_announcement_user_unique").on(table.announcementId, table.userId),
}));

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").notNull().references(() => users.id),
  buildingId: integer("building_id").notNull().references(() => buildings.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const emergencyAlerts = pgTable("emergency_alerts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  buildingId: integer("building_id").notNull().references(() => buildings.id),
  locationCode: text("location_code").notNull(),
  status: text("status").notNull().default("active"), // active, resolved, false_alarm
  createdAt: timestamp("created_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

export const usersRelations = relations(users, ({ one, many }) => ({
  building: one(buildings, {
    fields: [users.buildingId],
    references: [buildings.id],
  }),
  statuses: many(statuses),
  adverts: many(adverts),
  announcements: many(announcements),
  messages: many(messages),
  emergencyAlerts: many(emergencyAlerts),
  sentPrivateMessages: many(privateMessages, { relationName: "sender" }),
  receivedPrivateMessages: many(privateMessages, { relationName: "receiver" }),
}));

export const buildingsRelations = relations(buildings, ({ many }) => ({
  users: many(users),
  adverts: many(adverts),
  announcements: many(announcements),
  messages: many(messages),
  emergencyAlerts: many(emergencyAlerts),
  sentPrivateMessages: many(privateMessages, { relationName: "sender" }),
  receivedPrivateMessages: many(privateMessages, { relationName: "receiver" }),
}));

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, isAdmin: true, isApproved: true, buildingId: true });
export const insertBuildingSchema = createInsertSchema(buildings).omit({ id: true, createdAt: true, adminId: true });
export const insertStatusSchema = createInsertSchema(statuses).omit({ id: true, createdAt: true, expiresAt: true, userId: true });
export const insertAdvertSchema = createInsertSchema(adverts).omit({ id: true, createdAt: true, userId: true, buildingId: true });
export const insertAnnouncementSchema = createInsertSchema(announcements).omit({ id: true, createdAt: true, userId: true, buildingId: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true, senderId: true, buildingId: true });
export const insertEmergencyAlertSchema = createInsertSchema(emergencyAlerts).omit({ id: true, createdAt: true, resolvedAt: true });
export const insertPrivateMessageSchema = createInsertSchema(privateMessages).omit({ id: true, createdAt: true, senderId: true });
export const insertAdSchema = createInsertSchema(ads).omit({ id: true });

export type User = typeof users.$inferSelect;
export type Building = typeof buildings.$inferSelect;
export type Status = typeof statuses.$inferSelect;
export type StatusView = typeof statusViews.$inferSelect;
export type Advert = typeof adverts.$inferSelect;
export type Announcement = typeof announcements.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type EmergencyAlert = typeof emergencyAlerts.$inferSelect;
export type PrivateMessage = typeof privateMessages.$inferSelect;
export type Ad = typeof ads.$inferSelect;
export type Location = typeof locations.$inferSelect;
export type AnnouncementRsvp = typeof announcementRsvps.$inferSelect;
export type AnnouncementLike = typeof announcementLikes.$inferSelect;

export type InsertUser = typeof users.$inferInsert;
export type InsertBuilding = typeof buildings.$inferInsert;
export type InsertStatus = typeof statuses.$inferInsert;
export type InsertAdvert = typeof adverts.$inferInsert;
export type InsertAnnouncement = typeof announcements.$inferInsert;
export type InsertMessage = typeof messages.$inferInsert;
export type InsertEmergencyAlert = typeof emergencyAlerts.$inferInsert;
export type InsertPrivateMessage = typeof privateMessages.$inferInsert;
export type InsertAd = typeof ads.$inferInsert;
