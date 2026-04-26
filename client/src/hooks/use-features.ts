import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";

// --- STATUSES ---
export function useStatuses() {
  return useQuery({
    queryKey: [api.statuses.list.path],
    queryFn: async () => {
      const res = await fetch(api.statuses.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch statuses");
      return res.json();
    },
  });
}

export function useCreateStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { content?: string; imageUrl?: string }) => {
      const res = await fetch(api.statuses.create.path, {
        method: api.statuses.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create status");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.statuses.list.path] }),
  });
}

export function useDeleteStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/statuses/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete status");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.statuses.list.path] }),
  });
}

// --- ADVERTS ---
export function useAdverts() {
  return useQuery({
    queryKey: [api.adverts.list.path],
    queryFn: async () => {
      const res = await fetch(api.adverts.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch adverts");
      return res.json();
    },
  });
}

export function useCreateAdvert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(api.adverts.create.path, {
        method: api.adverts.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create advert");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.adverts.list.path] }),
  });
}

export function useUpdateAdvert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await fetch(`/api/adverts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), credentials: "include" });
      if (!res.ok) throw new Error("Failed to update advert");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.adverts.list.path] }),
  });
}

export function useDeleteAdvert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/adverts/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete advert");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.adverts.list.path] }),
  });
}

export function useCloseAdvert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: "sold" | "rented" | "withdrawn" }) => {
      const res = await fetch(`/api/adverts/${id}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to close advert");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.adverts.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.adverts.closeStats.path] });
    },
  });
}

export function useAdvertCloseStats() {
  return useQuery({
    queryKey: [api.adverts.closeStats.path],
    queryFn: async () => {
      const res = await fetch(api.adverts.closeStats.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch advert close stats");
      return res.json();
    },
  });
}

// --- ANNOUNCEMENTS ---
export function useAnnouncements() {
  return useQuery({
    queryKey: [api.announcements.list.path],
    queryFn: async () => {
      const res = await fetch(api.announcements.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch announcements");
      return res.json();
    },
  });
}

export function useCreateAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(api.announcements.create.path, {
        method: api.announcements.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create announcement");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.announcements.list.path] }),
  });
}

export function useUpdateAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await fetch(`/api/announcements/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), credentials: "include" });
      if (!res.ok) throw new Error("Failed to update announcement");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.announcements.list.path] }),
  });
}

export function useDeleteAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/announcements/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete announcement");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.announcements.list.path] }),
  });
}

export function useAnnouncementRsvp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, response }: { id: number; response: "attending" | "not_attending" }) => {
      const res = await fetch(`/api/announcements/${id}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to set RSVP");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.announcements.list.path] }),
  });
}

export function useAnnouncementReaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, type }: { id: number; type: "like" | "dislike" }) => {
      const res = await fetch(`/api/announcements/${id}/reaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to set reaction");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.announcements.list.path] }),
  });
}

export function useDeleteGroupMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/messages/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete message");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/messages'] }),
  });
}

export function useDeletePrivateMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, otherId }: { id: number; otherId: number }) => {
      const res = await fetch(`/api/private-messages/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete message");
      return { otherId };
    },
    onSuccess: (_, vars) => queryClient.invalidateQueries({ queryKey: ['/api/private-messages', vars.otherId] }),
  });
}

// --- MESSAGES (Building Chat) ---
export function useMessages(receiverId?: number) {
  return useQuery({
    queryKey: ['/api/private-messages', receiverId],
    queryFn: async () => {
      if (!receiverId) return [];
      const res = await fetch(`https://komsukomsu.online/api/private-messages/${receiverId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json();
    },
    enabled: !!receiverId,
    refetchInterval: 3000,
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { receiverId: number, content: string, fileUrl?: string, fileName?: string, location?: string }) => {
      const res = await fetch('https://komsukomsu.online/api/private-messages', {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to send message");
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/private-messages', variables.receiverId] });
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
    },
  });
}

export function useBuildingMessages() {
  return useQuery({
    queryKey: ['/api/messages'],
    queryFn: async () => {
      const res = await fetch('https://komsukomsu.online/api/messages', { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch group messages");
      return res.json();
    },
    refetchInterval: 3000,
  });
}

export function useSendBuildingMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { content: string }) => {
      const res = await fetch('https://komsukomsu.online/api/messages', {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to send group message");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
    },
  });
}

export function useNearbyUsers(lat: number, lon: number) {
  return useQuery({
    queryKey: ['/api/users/nearby', lat, lon],
    queryFn: async () => {
      const res = await fetch(`/api/users/nearby?lat=${lat}&lon=${lon}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch nearby users");
      return res.json();
    }
  });
}

export function useSavePushToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (token: string) => {
      const res = await fetch(api.users.pushToken.path, {
        method: api.users.pushToken.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to save push token");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.auth.me.path] });
    },
  });
}

export function useSearchUsers(query: string) {
  return useQuery({
    queryKey: ['/api/users/search', query],
    queryFn: async () => {
      if (!query || query.length < 3) return [];
      const res = await fetch(`/api/users/search?q=${query}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to search users");
      return res.json();
    },
    enabled: query.length >= 3
  });
}
