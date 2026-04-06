# Komşum - Neighborhood/Apartment Community App

## Project Overview
A mobile-first neighborhood community application (web/Android/iOS) built with React, Express, and PostgreSQL. Enables neighbors to connect via location codes, share status updates, place classified ads, make announcements, chat, send SOS alerts, and more.

## Current Implementation Status

### ✅ Completed Features

#### Authentication & User Management
- Email/password registration with location code verification
- First user at location becomes admin automatically
- Pending approval system for non-first users
- Admin approval workflow
- Session-based authentication with 30-day cookies
- Profile completion page with avatar selection/upload
- Mandatory profile photo on registration

#### Core Neighborhood Features
- **Status Updates (Durum)**: 24-hour expiry, gallery/camera simulation, viewer tracking (who viewed, when)
- **Classified Ads (İlanlar)**: Currency selector (₺/$/€), simulated image upload
- **Announcements (Duyuru)**: Admin-only, image upload support, "Hatırlat" (Remind) button
- **Building Chat (Sohbet)**: Group building-wide chat with sender identification
- **Admin Panel**: Pending user approval dashboard with user management

#### Emergency & Safety
- **SOS Emergency Button**: 3-second press activation, sends alert to all same-location neighbors
- **Alert Status Management**: Admins can mark alerts as "resolved" or "false alarm"
- Active alert tracking by location code

#### Private Messaging & User Discovery
- Instagram DM-style private direct messaging
- Nearby user discovery (500m radius using Haversine formula)
- User search by name, email, or phone number
- Message file/location sharing placeholders (UI ready)
- User blocking system
- User reporting/complaint system

#### Location System
- Locations table with Turkish city, district, neighborhood, and street data
- 34+ major Turkish locations with hierarchical structure (city → district → neighborhood)
- API endpoints for city, district, and neighborhood lookups

#### UI/UX
- Mobile-first design with bottom navigation (Durum, İlanlar, Duyuru, Sohbet, Profil)
- Notch simulator for mobile preview
- Admin badge (Shield icon) displayed on admin profiles
- Ad banner placeholder in Profile page (bottom)
- Facebook-style chat interface with active status indicators
- Message timestamps and read receipts UI structure

### 🚧 Partially Implemented / MVP Features
- Image uploads are simulated (use Unsplash URLs)
- File/location sharing in private messages (UI buttons exist, backend ready, no actual file service)
- Video/audio call buttons (icons present, non-functional)
- Location sharing (icon present, stores location JSON, no map integration)

### 📋 Not Yet Implemented
- Real file upload service integration
- Video/audio call functionality (would need WebRTC or external service)
- Voice/video chat features
- Map integration for location sharing
- Push notifications
- Real-time message updates (currently uses 3-second polling)
- Screenshot prevention (web limitation)
- Settings/privacy controls

## Database Schema

### Core Tables
- **users**: ID, firstName, lastName, phone, email, password, locationCode, buildingId, avatarUrl, latitude, longitude, isAdmin, isApproved, createdAt
- **buildings**: ID, locationCode, addressDetails, adminId, createdAt
- **locations**: ID, city, district, neighborhood, street, type, latitude, longitude
- **privateMessages**: ID, senderId, receiverId, content, fileUrl, fileName, location, createdAt
- **statuses**: ID, userId, content, imageUrl, createdAt, expiresAt
- **statusViews**: ID, statusId, viewerId, viewedAt
- **adverts**: ID, userId, buildingId, title, description, price, currency, imageUrl, createdAt
- **announcements**: ID, userId, buildingId, title, content, imageUrl, createdAt
- **messages**: ID, senderId, buildingId, content, createdAt (building-wide chat)
- **emergencyAlerts**: ID, userId, buildingId, locationCode, status, createdAt, resolvedAt
- **ads**: ID, imageUrl, linkUrl, position, isActive (ad banner system)
- **reports**: ID, reporterId, reportedId, reason, createdAt
- **blocks**: ID, blockerId, blockedId, createdAt

## Tech Stack
- **Frontend**: React 18, Vite, Wouter (routing), TanStack Query (data fetching), Shadcn/UI, Tailwind CSS, Lucide icons, date-fns
- **Backend**: Express.js, PostgreSQL, Drizzle ORM, Zod (validation), express-session
- **Deployment**: Replit
- **Database**: PostgreSQL with session store

## Key Design Decisions

### Security Notes (MVP Only)
- Passwords stored in plain text (must use bcrypt in production)
- Session-based auth with cookie storage
- CORS credentials included for cross-origin requests

### Architecture
- Thin API routes with storage interface pattern
- Shared schema/types between frontend and backend using `shared/` directory
- TanStack Query for caching and state management
- Zod for runtime validation

### Turkish Localization
- All UI text in Turkish
- Supports Turkish location data (Il, İlçe, Mahalle structure)
- Placeholder data for 30+ major Turkish cities/districts

## File Structure
```
shared/
  schema.ts          # Database schema with Drizzle ORM
  routes.ts          # API route definitions and Zod schemas

server/
  routes.ts          # Express route implementations
  storage.ts         # Database storage layer (IStorage interface)
  db.ts              # Database connection

client/
  src/
    pages/
      auth/          # Login, Register, PendingApproval, CompleteProfile
      admin/         # Approvals management
      Statuses.tsx
      Adverts.tsx
      Announcements.tsx
      Chat.tsx       # Private messaging interface
      Profile.tsx    # User profile with admin badge
    hooks/
      use-auth.ts    # Auth state and mutations
      use-features.ts # Feature hooks (statuses, messages, etc.)
    components/      # Shadcn UI components
    lib/            # Query client setup
```

## Current Limitations & Next Steps

### For Production:
1. Implement real file upload service (S3, Cloudinary, etc.)
2. Add bcrypt password hashing
3. Implement WebSocket for real-time messaging (replace polling)
4. Add WebRTC for video/audio calls
5. Add map integration (Google Maps, Mapbox)
6. Implement push notifications
7. Add comprehensive error handling and logging
8. Rate limiting on API endpoints
9. Implement proper CORS configuration

### For Enhanced UX:
1. Infinite scroll for feeds
2. Image gallery component for status/advert uploads
3. User search with debouncing
4. Message search and filtering
5. Notification badge system
6. User typing indicators in chat
7. Message reactions/emojis

## Notes
- Passwords are plain text (MVP only) - upgrade to bcrypt before production
- Image uploads currently use Unsplash URLs as placeholders
- File/location sharing UI ready but backend service integration needed
- Some features have disabled dragging/selection (prevent screenshot of private messages)
