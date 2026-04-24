// ...existing code...
// @ts-ignore
import * as turkey from "turkey-neighbourhoods";

import { db } from "./firebase-admin";
import type { Database } from "firebase-admin/database";
// TODO: Gerekli tipleri @shared/schema'dan veya doğrudan burada tanımlayın
export type User = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  avatarUrl?: string;
  isAdmin?: boolean;
  isApproved?: boolean;
  buildingId?: string;
  locationCode?: string;
  doorNo?: string;
  innerDoorNo?: string;
  password?: string;
  fcmToken?: string;
  latitude?: number;
  longitude?: number;
};
export type InsertUser = Omit<User, "id">;

// Haversine Formülü: İki koordinat (enlem ve boylam) arasındaki mesafeyi hesaplar
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Dünya yarıçapı (km)
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Sonucu kilometre cinsinden döndürür
}

export class FirebaseStorage {
  async getAdvertsByBuilding(buildingId: string, lat?: number, lng?: number): Promise<any[]> {
    const snap = await this.db.ref("adverts").get();
    if (!snap.exists()) return [];
    
    const advertsObj = snap.val();
    const adverts: any[] = [];

    for (const [id, data] of Object.entries(advertsObj as Record<string, any> || {})) {
      const ad = data as any;
      // İlan sahibinin güncel konumunu alıyoruz
      const userSnap = await this.db.ref(`users/${ad.userId}`).get();
      const adUser = userSnap.exists() ? { id: ad.userId, ...userSnap.val() } : null;

      let isNearby = false;
      // Kullanıcının ve ilanı verenin koordinatı varsa mesafe hesabı yap (varsayılan 0.5 km = 500m)
      if (lat && lng && adUser?.latitude && adUser?.longitude) {
        const dist = calculateDistance(lat, lng, adUser.latitude, adUser.longitude);
        isNearby = dist <= (ad.visibilityRadius || 0.5); 
      } else {
        // Koordinat eksikse veya izin verilmemişse aynı binadakileri getir
        isNearby = ad.buildingId === buildingId;
      }

      if (isNearby && ad.status !== "closed") {
        adverts.push({ id, ...ad, user: adUser });
      }
    }
    // En yeniler en üstte
    return adverts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }
  async getAdvertCloseStats(buildingId: string): Promise<any> {
    // TODO: Gerçek implementasyon
    return {};
  }
  async closeAdvert(advertId: string, reason: string): Promise<void> {
    // TODO: Gerçek implementasyon
  }

  // --- ROUTES.TS İÇİN TÜM GEREKLİ STUBLAR ---
  async getAnnouncementsByBuilding(buildingId: string): Promise<any[]> {
    const snap = await this.db.ref("announcements").get();
    if (!snap.exists()) return [];
    const allObj = snap.val();
    const results: any[] = [];
    for (const [id, data] of Object.entries(allObj as Record<string, any> || {})) {
      const ann = data as any;
      if (ann.buildingId === buildingId) {
        const userSnap = await this.db.ref(`users/${ann.userId}`).get();
        const user = userSnap.exists() ? { id: ann.userId, ...userSnap.val() } : null;
        results.push({ id, ...ann, user });
      }
    }
    // En yeni duyurular en üstte
    return results.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }
  async getAnnouncementInteractionSummary(id: string, userId: string): Promise<any> {
    const snap = await this.db.ref(`announcement_rsvps/${id}`).get();
    const rsvps = snap.exists() ? snap.val() : {};
    
    const attending: any[] = [];
    const notAttending: any[] = [];
    let userResponse = null;

    for (const [uid, response] of Object.entries(rsvps as Record<string, any> || {})) {
      // Listede göstermek için kullanıcı bilgilerini çekiyoruz
      const uSnap = await this.db.ref(`users/${uid}`).get();
      const uData = uSnap.exists() ? uSnap.val() : null;
      const userInfo = uData ? { id: uid, firstName: uData.firstName, lastName: uData.lastName, avatarUrl: uData.avatarUrl } : { id: uid };

      if (response === "attending") attending.push(userInfo);
      if (response === "not_attending") notAttending.push(userInfo);
      if (uid === userId) userResponse = response; // İşlemi yapan kullanıcının kendi cevabı
    }

    return { attendingCount: attending.length, notAttendingCount: notAttending.length, attending, notAttending, userResponse };
  }
  async setAnnouncementRsvp(id: string, userId: string, response: string): Promise<any> {
    // Kullanıcının cevabını Firebase'e kaydet
    await this.db.ref(`announcement_rsvps/${id}/${userId}`).set(response);
    return this.getAnnouncementInteractionSummary(id, userId); // Güncel listeyi döndür
  }
  async setAnnouncementReaction(id: string, userId: string, type: string): Promise<any> { return {}; }
  async getMessagesByBuilding(buildingId: string): Promise<any[]> { return []; }
  async getActiveAds(): Promise<any[]> { return []; }
  async updateUser(userId: string, data: any): Promise<any> {
    await this.db.ref(`users/${userId}`).update(data);
    const snap = await this.db.ref(`users/${userId}`).get();
    return { id: userId, ...snap.val() };
  }
  async searchUsers(q: string): Promise<any[]> { return []; }
  
  async getNearbyUsers(lat: number, lon: number, radius: number): Promise<any[]> {
    const snap = await this.db.ref("users").get();
    if (!snap.exists()) return [];
    const usersObj = snap.val();
    const nearby: any[] = [];
    for (const [id, data] of Object.entries(usersObj as Record<string, any> || {})) {
      const user = data as User;
      if (user.latitude && user.longitude) {
        const dist = calculateDistance(lat, lon, user.latitude, user.longitude);
        if (dist <= radius) nearby.push({ id, ...user, distance: dist });
      }
    }
    return nearby.sort((a, b) => a.distance - b.distance);
  }
  async blockUser(userId: string, targetId: string | number): Promise<void> { }
  async reportUser(userId: string, targetId: string | number, reason: string): Promise<void> { }
  async getConversations(userId: string): Promise<any[]> { return []; }
  async getPrivateMessages(userId: string, otherId: string | number): Promise<any[]> { return []; }
  async getActiveEmergencyAlerts(locationCode: string): Promise<any[]> { return []; }
  async getActiveEmergencyAlertByUser(userId: string): Promise<any> { return null; }
  async resolveEmergencyAlert(alertId: string, status: string): Promise<void> { }

  // STUB EKLENEN METOTLAR (routes.ts ile uyumlu olacak şekilde)
  async getAllUsersInBuilding(buildingId: string): Promise<User[]> {
    const snap = await this.db.ref("users").get();
    if (!snap.exists()) return [];
    const users = snap.val();
    const result: User[] = [];
    for (const [id, user] of Object.entries(users as Record<string, any> || {})) {
      if ((user as User).buildingId === buildingId) {
        result.push({ id, ...(user as User) });
      }
    }
    return result;
  }
  async getStreets(city: string, district: string, neighborhood: string): Promise<any[]> {
    const snap = await this.db.ref(`streets/${city}/${district}/${neighborhood}`).get();
    if (!snap.exists()) return [];
    return Object.values(snap.val() as Record<string, any> || {});
  }
  async getBuildingByLocationCode(locationCode: string): Promise<any> {
    const snap = await this.db.ref("buildings").get();
    if (!snap.exists()) return null;
    const buildings = snap.val();
    for (const [id, b] of Object.entries(buildings as Record<string, any> || {})) {
      if ((b as any).locationCode === locationCode) {
        return { id, ...(b as any) };
      }
    }
    return null;
  }
  async createBuilding(data: any): Promise<any> {
    const ref = this.db.ref("buildings").push();
    const buildingData = { ...data, createdAt: Date.now() };
    await ref.set(buildingData);
    return { id: ref.key, ...buildingData };
  }
  async updateBuildingAdmin(buildingId: string, userId: string): Promise<void> {
    await this.db.ref(`buildings/${buildingId}`).update({ adminId: userId });
  }
  async getPendingUsersForBuilding(buildingId: string): Promise<any[]> {
    const users = await this.getAllUsersInBuilding(buildingId);
    return users.filter(u => !u.isApproved);
  }
  async approveUser(userId: string): Promise<void> {
    await this.db.ref(`users/${userId}`).update({ isApproved: true });
  }
  async getStatuses(): Promise<any[]> {
    const snap = await this.db.ref("statuses").get();
    if (!snap.exists()) return [];
    const statusesObj = snap.val();
    const statuses: any[] = [];
    
    for (const [id, data] of Object.entries(statusesObj as Record<string, any> || {})) {
      const s = data as any;
      const userSnap = await this.db.ref(`users/${s.userId}`).get();
      if (userSnap.exists()) s.user = { id: s.userId, ...userSnap.val() };
      statuses.push({ id, ...s });
    }
    // En yeni durumları üste sırala
    return statuses.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }
  async recordStatusView(statusId: string, userId: string): Promise<void> {
    // TODO: Gerçek implementasyon
  }
  async getStatusViewers(statusId: string): Promise<any[]> {
    // TODO: Gerçek implementasyon
    return [];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const snap = await this.db.ref("users").get();
    if (!snap.exists()) return undefined;
    const users = snap.val();
    for (const [id, user] of Object.entries(users as Record<string, any> || {})) {
      if (user.email === email) {
        return { id, ...user };
      }
    }
    return undefined;
  }

    // Şehirler
    async getCities(): Promise<string[]> {
      // Her zaman güncel şehir listesi döndür
      return turkey.getCities().map((c: any) => c.name);
    }

    // İlçeler
    async getDistricts(city: string): Promise<string[]> {
      const cityObj = turkey.getCities().find((c: any) => c.name === city);
      if (!cityObj) return [];
      return turkey.getDistrictsByCityCode(cityObj.code);
    }

    // Mahalleler
    async getNeighborhoods(city: string, district: string): Promise<any[]> {
      const cityObj = turkey.getCities().find((c: any) => c.name === city);
      if (!cityObj) return [];
      const neighborhoods = turkey.getNeighbourhoodsByCityCodeAndDistrict(cityObj.code, district);
      return neighborhoods.map((name: string) => ({
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
  db: Database;
  constructor(db: Database) {
    this.db = db;
  }

  // Kullanıcı işlemleri
  async getUser(id: string): Promise<User | undefined> {
    const snap = await this.db.ref(`users/${id}`).get();
    return snap.exists() ? { id, ...snap.val() } : undefined;
  }
  async createUser(id: string, user: InsertUser): Promise<User> {
    await this.db.ref(`users/${id}`).set(user);
    return { id, ...user };
  }

  // Durum (status) işlemleri
  async getStatus(id: string): Promise<any | undefined> {
    const snap = await this.db.ref(`statuses/${id}`).get();
    return snap.exists() ? snap.val() : undefined;
  }
  async createStatus(userId: string, status: any): Promise<any> {
    const ref = this.db.ref("statuses").push();
    const newData = { ...status, createdAt: Date.now() };
    await ref.set(newData);
    return { id: ref.key, ...newData };
  }
  async updateStatus(id: string, data: Partial<any>): Promise<any> {
    await this.db.ref(`statuses/${id}`).update(data);
    const snap = await this.db.ref(`statuses/${id}`).get();
    return snap.val();
  }
  async deleteStatus(id: string): Promise<void> {
    await this.db.ref(`statuses/${id}`).remove();
  }

  // Özel mesaj (privateMessage) işlemleri
  async getPrivateMessage(id: string): Promise<any | undefined> {
    const snap = await this.db.ref(`privateMessages/${id}`).get();
    return snap.exists() ? snap.val() : undefined;
  }
  async createPrivateMessage(userId: string, message: any): Promise<any> {
    const ref = this.db.ref("privateMessages").push();
    const newData = { ...message, createdAt: Date.now() };
    await ref.set(newData);
    return { id: ref.key, ...newData };
  }
  async deletePrivateMessage(id: string): Promise<void> {
    await this.db.ref(`privateMessages/${id}`).remove();
  }

  // Acil durum (emergencyAlert) işlemleri
  async getEmergencyAlert(id: string): Promise<any | undefined> {
    const snap = await this.db.ref(`emergencyAlerts/${id}`).get();
    return snap.exists() ? snap.val() : undefined;
  }
  async createEmergencyAlert(userId: string, alert: any): Promise<any> {
    const ref = this.db.ref("emergencyAlerts").push();
    const newData = { ...alert, createdAt: Date.now() };
    await ref.set(newData);
    return { id: ref.key, ...newData };
  }
  async updateEmergencyAlert(id: string, data: Partial<any>): Promise<any> {
    await this.db.ref(`emergencyAlerts/${id}`).update(data);
    const snap = await this.db.ref(`emergencyAlerts/${id}`).get();
    return snap.val();
  }
  async deleteEmergencyAlert(id: string): Promise<void> {
    await this.db.ref(`emergencyAlerts/${id}`).remove();
  }

  // İlan işlemleri
  async getAdvert(id: string): Promise<any | undefined> {
    const snap = await this.db.ref(`adverts/${id}`).get();
    return snap.exists() ? snap.val() : undefined;
  }
  async createAdvert(userId: string, advert: any): Promise<any> {
    const ref = this.db.ref("adverts").push();
    const newData = { ...advert, createdAt: Date.now() };
    await ref.set(newData);
    return { id: ref.key, ...newData };
  }
  async updateAdvert(id: string, data: Partial<any>): Promise<any> {
    await this.db.ref(`adverts/${id}`).update(data);
    const snap = await this.db.ref(`adverts/${id}`).get();
    return snap.val();
  }
  async deleteAdvert(id: string): Promise<void> {
    await this.db.ref(`adverts/${id}`).remove();
  }

  // Duyuru işlemleri
  async getAnnouncement(id: string): Promise<any | undefined> {
    const snap = await this.db.ref(`announcements/${id}`).get();
    return snap.exists() ? snap.val() : undefined;
  }
  async createAnnouncement(userId: string, announcement: any): Promise<any> {
    const ref = this.db.ref("announcements").push();
    const newData = { ...announcement, createdAt: Date.now() };
    await ref.set(newData);
    return { id: ref.key, ...newData };
  }
  async updateAnnouncement(id: string, data: Partial<any>): Promise<any> {
    await this.db.ref(`announcements/${id}`).update(data);
    const snap = await this.db.ref(`announcements/${id}`).get();
    return snap.val();
  }
  async deleteAnnouncement(id: string): Promise<void> {
    await this.db.ref(`announcements/${id}`).remove();
  }

  // Mesaj işlemleri
  async getMessage(id: string): Promise<any | undefined> {
    const snap = await this.db.ref(`messages/${id}`).get();
    return snap.exists() ? snap.val() : undefined;
  }
  async createMessage(userId: string, message: any): Promise<any> {
    const ref = this.db.ref("messages").push();
    const newData = { ...message, createdAt: Date.now() };
    await ref.set(newData);
    return { id: ref.key, ...newData };
  }
  async deleteMessage(id: string): Promise<void> {
    await this.db.ref(`messages/${id}`).remove();
  }
}

// Kullanım
export const storage = new FirebaseStorage(db as Database);
