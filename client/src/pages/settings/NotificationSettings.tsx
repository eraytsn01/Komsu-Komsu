import { Link } from "wouter";
import { useState } from "react";
import { ArrowLeft, Bell, Siren, MessageCircle } from "lucide-react";
import { MobileContainer } from "@/components/layout/MobileContainer";
import { useNotificationSettings, type NotificationSound } from "@/hooks/use-notification-settings";
import { useSavePushToken } from "@/hooks/use-features";
import { playNotificationSound } from "@/lib/notification-sound";
import { enableFirebasePushNotifications, isFirebaseMessagingAvailable } from "@/lib/firebase-messaging";

export default function NotificationSettings() {
  const { settings, patchSettings } = useNotificationSettings();
  const savePushToken = useSavePushToken();
  const [pushError, setPushError] = useState("");
  const [isEnablingPush, setIsEnablingPush] = useState(false);

  const handleEnablePush = async () => {
    setPushError("");
    setIsEnablingPush(true);

    try {
      const available = await isFirebaseMessagingAvailable();
      if (!available) {
        throw new Error("Firebase yapılandırması veya tarayıcı desteği eksik.");
      }

      const token = await enableFirebasePushNotifications();
      await savePushToken.mutateAsync(token);
      patchSettings({ pushEnabled: true, pushToken: token });
    } catch (error: any) {
      patchSettings({ pushEnabled: false });
      setPushError(error?.message || "Firebase push etkinleştirilemedi.");
    } finally {
      setIsEnablingPush(false);
    }
  };

  const soundOptions: Array<{ value: NotificationSound; label: string }> = [
    { value: "chime", label: "Chime" },
    { value: "bell", label: "Bell" },
    { value: "beep", label: "Beep" },
  ];

  return (
    <MobileContainer>
      <div className="min-h-full bg-gray-50 pb-24">
        <div className="bg-white px-4 pt-10 pb-4 border-b border-gray-100 flex items-center gap-3">
          <Link href="/profile" className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-lg font-bold">Bildirim Ayarları</h1>
            <p className="text-xs text-muted-foreground">Mesaj, acil durum ve duyuru bildirimleri</p>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
            <label className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-medium"><MessageCircle className="w-4 h-4" /> Mesaj Bildirimleri</span>
              <input
                type="checkbox"
                checked={settings.messages}
                onChange={(e) => patchSettings({ messages: e.target.checked })}
                className="w-5 h-5"
              />
            </label>

            <label className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-medium"><Siren className="w-4 h-4" /> Acil Durum Bildirimleri</span>
              <input
                type="checkbox"
                checked={settings.emergencies}
                onChange={(e) => patchSettings({ emergencies: e.target.checked })}
                className="w-5 h-5"
              />
            </label>

            <label className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-medium"><Bell className="w-4 h-4" /> Önemli Duyuru Bildirimleri</span>
              <input
                type="checkbox"
                checked={settings.announcements}
                onChange={(e) => patchSettings({ announcements: e.target.checked })}
                className="w-5 h-5"
              />
            </label>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <h2 className="text-sm font-bold mb-3">Bildirim Sesi</h2>
            <div className="space-y-2">
              {soundOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    patchSettings({ sound: opt.value });
                    playNotificationSound(opt.value);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl border text-sm ${settings.sound === opt.value ? "border-primary bg-primary/10" : "border-gray-200"}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => playNotificationSound(settings.sound)}
              className="mt-3 w-full px-3 py-2 rounded-xl bg-secondary text-white text-sm font-semibold"
            >
              Örnek Sesi Çal
            </button>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
            <div>
              <h2 className="text-sm font-bold">Firebase Push</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Arka planda bildirim almak için Firebase web push etkinleştirilir.
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2 text-xs">
              Durum: <span className="font-bold">{settings.pushEnabled ? "Aktif" : "Pasif"}</span>
            </div>

            {settings.pushToken && (
              <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2">
                <p className="text-[11px] font-semibold text-gray-500 mb-1">Push Token</p>
                <p className="text-[10px] break-all text-gray-700">{settings.pushToken}</p>
              </div>
            )}

            {pushError && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">
                {pushError}
              </div>
            )}

            <button
              type="button"
              onClick={handleEnablePush}
              disabled={isEnablingPush}
              className="w-full px-3 py-3 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-60"
            >
              {isEnablingPush ? "Firebase Push Hazırlanıyor…" : "Firebase Push'ı Etkinleştir"}
            </button>
          </div>

          {"Notification" in window && Notification.permission !== "granted" && (
            <button
              type="button"
              onClick={() => Notification.requestPermission()}
              className="w-full px-3 py-3 rounded-xl bg-primary text-white text-sm font-semibold"
            >
              Sistem Bildirim İzni Ver
            </button>
          )}
        </div>
      </div>
    </MobileContainer>
  );
}
