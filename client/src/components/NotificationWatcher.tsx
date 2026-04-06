import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useNotificationSettings } from "@/hooks/use-notification-settings";
import { playNotificationSound, playEmergencyAlarm } from "@/lib/notification-sound";

const LS_KEYS = {
  messages: "notif_last_msg_id",
  announcements: "notif_last_ann_id",
  emergencies: "notif_last_emg_id",
};

function getStoredId(key: string): number {
  return parseInt(localStorage.getItem(key) ?? "0", 10) || 0;
}

function setStoredId(key: string, id: number) {
  localStorage.setItem(key, String(id));
}

function getLatestId(items: any[]): number {
  return items.reduce((max, item) => Math.max(max, Number(item?.id ?? 0)), 0);
}

function pushSystemNotification(title: string, body: string) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  new Notification(title, { body });
}

/* İlk yükleme sırasında mevcut ID'leri baseline olarak kaydetmek için kullanılır */
const initializedRef = { messages: false, announcements: false, emergencies: false };

export function NotificationWatcher() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { settings } = useNotificationSettings();

  /* Bileşen remount olsa bile localStorage'dan okuyarak son görülen ID korunur */
  const initDone = useRef({ ...initializedRef });

  const { data: messages = [] } = useQuery({
    queryKey: [api.messages.list.path, "notify"],
    queryFn: async () => {
      const res = await fetch(api.messages.list.path, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user && settings.messages,
    refetchInterval: 6000,
  });

  const { data: announcements = [] } = useQuery({
    queryKey: [api.announcements.list.path, "notify"],
    queryFn: async () => {
      const res = await fetch(api.announcements.list.path, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user && settings.announcements,
    refetchInterval: 10000,
  });

  const { data: emergencies = [] } = useQuery({
    queryKey: [api.emergency.list.path, "notify"],
    queryFn: async () => {
      const res = await fetch(api.emergency.list.path, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user && settings.emergencies,
    refetchInterval: 8000,
  });

  /* Mesajlar */
  useEffect(() => {
    if (!user || !settings.messages || messages.length === 0) return;
    const latest = getLatestId(messages);

    if (!initDone.current.messages) {
      initDone.current.messages = true;
      /* Hiç kayıt yoksa mevcut en yüksek ID'yi baseline yap */
      if (getStoredId(LS_KEYS.messages) === 0) setStoredId(LS_KEYS.messages, latest);
      return;
    }

    const stored = getStoredId(LS_KEYS.messages);
    if (latest > stored) {
      setStoredId(LS_KEYS.messages, latest);
      playNotificationSound(settings.sound);
      toast({ title: "Yeni mesaj", description: "Sohbet bölümünde yeni mesaj var." });
      pushSystemNotification("Yeni mesaj", "Sohbet bölümünde yeni mesaj var.");
    }
  }, [messages, settings.messages, settings.sound, toast, user]);

  /* Duyurular */
  useEffect(() => {
    if (!user || !settings.announcements || announcements.length === 0) return;
    const latest = getLatestId(announcements);

    if (!initDone.current.announcements) {
      initDone.current.announcements = true;
      if (getStoredId(LS_KEYS.announcements) === 0) setStoredId(LS_KEYS.announcements, latest);
      return;
    }

    const stored = getStoredId(LS_KEYS.announcements);
    if (latest > stored) {
      setStoredId(LS_KEYS.announcements, latest);
      playNotificationSound(settings.sound);
      toast({ title: "Önemli duyuru", description: "Yeni bir duyuru yayınlandı." });
      pushSystemNotification("Önemli duyuru", "Yeni bir duyuru yayınlandı.");
    }
  }, [announcements, settings.announcements, settings.sound, toast, user]);

  /* Acil durumlar — her unique ID için yalnızca bir kez bildirim */
  useEffect(() => {
    if (!user || !settings.emergencies || emergencies.length === 0) return;
    const latest = getLatestId(emergencies);

    if (!initDone.current.emergencies) {
      initDone.current.emergencies = true;
      /* İlk açılışta mevcut en yüksek ID'yi baseline olarak kaydet, bildirim gösterme */
      if (getStoredId(LS_KEYS.emergencies) === 0) setStoredId(LS_KEYS.emergencies, latest);
      return;
    }

    const stored = getStoredId(LS_KEYS.emergencies);
    if (latest > stored) {
      setStoredId(LS_KEYS.emergencies, latest);

      /* Yeni gelen acil durum kaydının sahibi mevcut kullanıcıysa bildirim gösterme */
      const newAlerts = (emergencies as any[]).filter((a: any) => Number(a.id) > stored);
      const isOwnAlert = newAlerts.every((a: any) => a.userId === user.id);
      if (isOwnAlert) return;

      // Acil durum sesi: sabit, değiştirilemez, sadece başkalarına çalınır
      playEmergencyAlarm();
      toast({
        title: "🚨 Acil Durum",
        description: "Komşunuzdan acil yardım talebi var!",
        variant: "destructive",
      });
      pushSystemNotification("🚨 Acil Durum", "Komşunuzdan acil yardım talebi var!");
    }
  }, [emergencies, settings.emergencies, settings.sound, toast, user]);

  return null;
}
