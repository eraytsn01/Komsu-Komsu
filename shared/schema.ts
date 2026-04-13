
// Bu dosya sadece tip ve frontend/backend ortak veri şemaları için kullanılacak.

// Ortak tipler (örnek)
export interface User {
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
}

export interface Building {
  id: string;
  addressDetails: string;
  locationCode: string;
  adminId?: string;
}

export interface Status {
  id: string;
  userId: string;
  content?: string;
  imageUrl?: string;
  createdAt: number;
  expiresAt: number;
}

export interface Advert {
  id: string;
  userId: string;
  buildingId: string;
  title: string;
  description: string;
  price?: string;
  currency?: string;
  imageUrl?: string;
  visibilityRadius?: number;
  status?: string;
  closedReason?: string;
  closedAt?: number;
  createdAt: number;
}

export interface Announcement {
  id: string;
  userId: string;
  buildingId: string;
  title: string;
  content: string;
  imageUrl?: string;
  eventDate?: number;
  createdAt: number;
}

export interface Message {
  id: string;
  senderId: string;
  buildingId: string;
  content: string;
  createdAt: number;
}

export interface EmergencyAlert {
  id: string;
  userId: string;
  buildingId: string;
  locationCode: string;
  status: string;
  createdAt: number;
  resolvedAt?: number;
}
