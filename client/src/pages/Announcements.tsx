import { useRef, useState } from "react";
import { MobileContainer } from "@/components/layout/MobileContainer";
import { useAnnouncementReaction, useAnnouncementRsvp, useAnnouncements, useCreateAnnouncement, useUpdateAnnouncement, useDeleteAnnouncement } from "@/hooks/use-features";
import { useAuth } from "@/hooks/use-auth";
import { Megaphone, Plus, X, Calendar, Trash2, Pencil, Check, Camera, Image as ImageIcon, ThumbsUp, ThumbsDown, BellRing } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

async function compressImage(file: File, maxDim = 1000, quality = 0.78): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = ev.target!.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function toDateTimeInputValue(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function Announcements() {
  const { data: announcements = [], isLoading } = useAnnouncements();
  const createAnnouncement = useCreateAnnouncement();
  const updateAnnouncement = useUpdateAnnouncement();
  const deleteAnnouncement = useDeleteAnnouncement();
  const rsvpMutation = useAnnouncementRsvp();
  const reactionMutation = useAnnouncementReaction();
  const { user } = useAuth();
  const { toast } = useToast();

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<any>(null);
  const [form, setForm] = useState({ title: "", content: "", imageUrl: "", eventDate: "" });
  const [editForm, setEditForm] = useState({ title: "", content: "", imageUrl: "", eventDate: "" });
  const [imageLoading, setImageLoading] = useState(false);

  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const canManage = (ann: any) => ann.userId === user?.id || user?.isAdmin;

  const handleAdd = async () => {
    if (!form.title || !form.content) return;
    try {
      await createAnnouncement.mutateAsync({
        title: form.title,
        content: form.content,
        imageUrl: form.imageUrl || undefined,
        eventDate: form.eventDate ? new Date(form.eventDate).toISOString() : undefined,
      });
      setIsAdding(false);
      setForm({ title: "", content: "", imageUrl: "", eventDate: "" });
      toast({ title: "Duyuru yayınlandı" });
    } catch { toast({ title: "Hata oluştu", variant: "destructive" }); }
  };

  const startEdit = (ann: any) => {
    setEditingId(ann.id);
    setEditForm({
      title: ann.title,
      content: ann.content,
      imageUrl: ann.imageUrl || "",
      eventDate: toDateTimeInputValue(ann.eventDate),
    });
  };

  const handleUpdate = async (id: number) => {
    try {
      await updateAnnouncement.mutateAsync({
        id,
        data: {
          title: editForm.title,
          content: editForm.content,
          imageUrl: editForm.imageUrl || undefined,
          eventDate: editForm.eventDate ? new Date(editForm.eventDate).toISOString() : null,
        },
      });
      setEditingId(null);
      toast({ title: "Duyuru güncellendi" });
    } catch { toast({ title: "Güncellenemedi", variant: "destructive" }); }
  };

  const handleDelete = async (ann: any) => {
    try {
      await deleteAnnouncement.mutateAsync(ann.id);
      setConfirmDelete(null);
      toast({ title: "Duyuru silindi" });
    } catch { toast({ title: "Silinemedi", variant: "destructive" }); }
  };

  const handleImageFile = async (file?: File | null, forEdit = false) => {
    if (!file) return;
    setImageLoading(true);
    try {
      const imageUrl = await compressImage(file);
      if (forEdit) {
        setEditForm((f) => ({ ...f, imageUrl }));
      } else {
        setForm((f) => ({ ...f, imageUrl }));
      }
      toast({ title: "Görsel eklendi" });
    } catch {
      toast({ title: "Görsel yüklenemedi", variant: "destructive" });
    } finally {
      setImageLoading(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (galleryRef.current) galleryRef.current.value = "";
    }
  };

  const scheduleReminderForAnnouncement = async (ann: any, autoMode = false) => {
    if (!ann?.eventDate) {
      if (!autoMode) toast({ title: "Etkinlik tarihi yok", variant: "destructive" });
      return;
    }

    const eventDate = new Date(ann.eventDate);
    if (Number.isNaN(eventDate.getTime()) || eventDate.getTime() <= Date.now()) {
      if (!autoMode) toast({ title: "Geçerli bir tarih seçin", variant: "destructive" });
      return;
    }

    const schedules = [
      { at: new Date(eventDate.getTime() - 60 * 60 * 1000), suffix: "1 saat kaldı" },
      { at: new Date(eventDate.getTime() - 30 * 60 * 1000), suffix: "30 dk kaldı" },
      { at: eventDate, suffix: "Etkinlik zamanı" },
    ].filter((x) => x.at.getTime() > Date.now());

    if (!Capacitor.isNativePlatform()) {
      if (!autoMode) toast({ title: "Hatırlatıcı yalnızca mobil uygulamada çalışır" });
      return;
    }

    const permission = await LocalNotifications.requestPermissions();
    if (permission.display !== "granted") {
      if (!autoMode) toast({ title: "Bildirim izni gerekli", variant: "destructive" });
      return;
    }

    await LocalNotifications.schedule({
      notifications: schedules.map((s, i) => ({
        id: ann.id * 100 + i + 1,
        title: ann.title,
        body: s.suffix,
        schedule: { at: s.at },
      })),
    });

    toast({
      title: autoMode ? "Katılım hatırlatıcısı kuruldu" : "Hatırlatıcı kuruldu",
      description: `${schedules.length} bildirim planlandı.`,
    });
  };

  const handleRsvp = async (ann: any, response: "attending" | "not_attending") => {
    try {
      const result = await rsvpMutation.mutateAsync({ id: ann.id, response });
      if (response === "attending" && result?.userResponse === "attending") {
        await scheduleReminderForAnnouncement(ann, true);
      }
    } catch {
      toast({ title: "Katılım güncellenemedi", variant: "destructive" });
    }
  };

  const handleReaction = async (id: number, type: "like" | "dislike") => {
    try {
      await reactionMutation.mutateAsync({ id, type });
    } catch {
      toast({ title: "Tepki güncellenemedi", variant: "destructive" });
    }
  };

  const handleRemind = async (ann: any) => {
    await scheduleReminderForAnnouncement(ann, false);
  };

  return (
    <MobileContainer>
      <div className="flex flex-col min-h-full pb-24">
        {/* Header */}
        <div className="bg-orange-500 px-6 pt-10 pb-8 rounded-b-[2rem] shadow-md mb-6 relative overflow-hidden">
          <div className="absolute -right-8 -bottom-6 w-36 h-36 bg-white/10 rounded-full" />
          <div className="absolute right-10 -top-6 w-20 h-20 bg-white/10 rounded-full blur-xl" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-11 h-11 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
              <Megaphone className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Duyurular</h1>
              <p className="text-orange-100/90 text-sm">Bina yönetimi bilgilendirmeleri</p>
            </div>
          </div>
        </div>

        <div className="px-4 space-y-4">
          {isLoading && (
            <div className="space-y-4">{[1,2].map(i => <div key={i} className="h-32 bg-white rounded-3xl animate-pulse" />)}</div>
          )}

          {(announcements as any[]).map((ann: any) => (
            <div key={ann.id} className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex flex-col gap-3">
              {editingId === ann.id ? (
                /* Edit mode */
                <div className="space-y-3">
                  <input
                    value={editForm.title}
                    onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-primary/30 rounded-xl text-sm font-bold focus:outline-none focus:border-primary"
                  />
                  <textarea
                    value={editForm.content}
                    onChange={e => setEditForm(f => ({ ...f, content: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-primary/30 rounded-xl text-sm focus:outline-none focus:border-primary resize-none"
                  />
                  <input
                    type="datetime-local"
                    value={editForm.eventDate}
                    onChange={e => setEditForm(f => ({ ...f, eventDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-primary/30 rounded-xl text-sm focus:outline-none focus:border-primary"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => galleryRef.current?.click()}
                      className="flex-1 py-2 rounded-xl bg-gray-100 text-gray-700 font-bold text-xs flex items-center justify-center gap-1.5"
                    >
                      <ImageIcon className="w-3.5 h-3.5" /> Galeri
                    </button>
                    <button
                      type="button"
                      onClick={() => cameraRef.current?.click()}
                      className="flex-1 py-2 rounded-xl bg-gray-100 text-gray-700 font-bold text-xs flex items-center justify-center gap-1.5"
                    >
                      <Camera className="w-3.5 h-3.5" /> Kamera
                    </button>
                    {editForm.imageUrl && (
                      <button
                        type="button"
                        onClick={() => setEditForm(f => ({ ...f, imageUrl: "" }))}
                        className="px-3 py-2 rounded-xl bg-red-50 text-red-500 font-bold text-xs"
                      >
                        Kaldır
                      </button>
                    )}
                  </div>
                  {editForm.imageUrl && (
                    <div className="w-full h-32 bg-gray-100 rounded-2xl overflow-hidden">
                      <img src={editForm.imageUrl} className="w-full h-full object-cover" alt="" />
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingId(null)}
                      className="flex-1 py-2 rounded-xl bg-gray-100 text-gray-600 font-bold text-xs"
                    >
                      İptal
                    </button>
                    <button
                      onClick={() => handleUpdate(ann.id)}
                      disabled={updateAnnouncement.isPending}
                      className="flex-1 py-2 rounded-xl bg-primary text-white font-bold text-xs flex items-center justify-center gap-1 disabled:opacity-60"
                    >
                      <Check className="w-3 h-3" /> Kaydet
                    </button>
                  </div>
                </div>
              ) : (
                /* View mode */
                <>
                  <div className="flex gap-3 items-start">
                    <div className="w-12 h-12 bg-accent rounded-2xl flex items-center justify-center shrink-0">
                      <Megaphone className="w-6 h-6 text-accent-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-foreground">{ann.title}</h3>
                      <p className="text-sm text-gray-600 mt-1 leading-relaxed">{ann.content}</p>
                    </div>
                    {canManage(ann) && (
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => startEdit(ann)}
                          className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-xl transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(ann)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {ann.imageUrl && (
                    <div className="w-full h-40 bg-gray-100 rounded-2xl overflow-hidden">
                      <img src={ann.imageUrl} className="w-full h-full object-cover" alt="" />
                    </div>
                  )}

                  {ann.eventDate && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-50 text-orange-700 text-[11px] font-bold w-fit">
                      <Calendar className="w-3.5 h-3.5" />
                      {format(new Date(ann.eventDate), "d MMM yyyy HH:mm", { locale: tr })}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleRsvp(ann, "attending")}
                      className={`py-2 rounded-xl text-xs font-bold border transition-colors ${ann.interactions?.userResponse === "attending" ? "bg-green-500 text-white border-green-500" : "bg-green-50 text-green-700 border-green-200"}`}
                    >
                      Katılacağım ({ann.interactions?.attending ?? 0})
                    </button>
                    <button
                      onClick={() => handleRsvp(ann, "not_attending")}
                      className={`py-2 rounded-xl text-xs font-bold border transition-colors ${ann.interactions?.userResponse === "not_attending" ? "bg-red-500 text-white border-red-500" : "bg-red-50 text-red-700 border-red-200"}`}
                    >
                      Katılmıyorum ({ann.interactions?.notAttending ?? 0})
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleReaction(ann.id, "like")}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-1.5 ${ann.interactions?.userType === "like" ? "bg-primary text-white border-primary" : "bg-primary/5 text-primary border-primary/20"}`}
                    >
                      <ThumbsUp className="w-3.5 h-3.5" /> Beğen ({ann.interactions?.likes ?? 0})
                    </button>
                    <button
                      onClick={() => handleReaction(ann.id, "dislike")}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-1.5 ${ann.interactions?.userType === "dislike" ? "bg-gray-700 text-white border-gray-700" : "bg-gray-50 text-gray-700 border-gray-200"}`}
                    >
                      <ThumbsDown className="w-3.5 h-3.5" /> Beğenme ({ann.interactions?.dislikes ?? 0})
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-[10px] text-muted-foreground font-medium">
                      {ann.createdAt ? format(new Date(ann.createdAt), "d MMM yyyy HH:mm", { locale: tr }) : ""}
                    </div>
                    <button
                      onClick={() => handleRemind(ann)}
                      disabled={ann.interactions?.userResponse !== "attending" || !ann.eventDate}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/5 text-primary rounded-xl text-[10px] font-bold hover:bg-primary/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <BellRing className="w-3 h-3" /> Hatırlat
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}

          {(announcements as any[]).length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center py-20 px-8 text-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-orange-100 flex items-center justify-center">
                <Megaphone className="w-8 h-8 text-orange-500" />
              </div>
              <p className="text-sm font-bold text-gray-500">Güncel bir duyuru bulunmuyor</p>
              <p className="text-xs text-gray-400">Yeni duyurular yayınlandığında burada görünecek.</p>
            </div>
          )}
        </div>

        {/* FAB (admin only) */}
        {user?.isAdmin && (
          <button
            onClick={() => setIsAdding(true)}
            className="absolute bottom-6 right-6 w-14 h-14 bg-orange-500 text-white rounded-2xl shadow-xl shadow-orange-400/50 flex items-center justify-center hover:-translate-y-1 transition-all z-30"
          >
            <Plus className="w-6 h-6" />
          </button>
        )}
      </div>

      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={e => handleImageFile(e.target.files?.[0], editingId !== null)} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handleImageFile(e.target.files?.[0], editingId !== null)} />

      {/* Add Modal */}
      {isAdding && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 flex flex-col justify-end">
          <div className="bg-white rounded-t-[2rem] p-6">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold">Yeni Duyuru</h3>
              <button onClick={() => setIsAdding(false)} className="p-2 bg-gray-100 rounded-full text-gray-500"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <input
                placeholder="Başlık *"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none font-bold"
              />
              <textarea
                placeholder="Duyuru metni *"
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                rows={4}
                className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none resize-none leading-relaxed"
              />
              <input
                type="datetime-local"
                value={form.eventDate}
                onChange={e => setForm(f => ({ ...f, eventDate: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => galleryRef.current?.click()}
                  className="py-3 bg-gray-50 rounded-xl text-sm font-bold text-gray-700 flex items-center justify-center gap-2"
                >
                  <ImageIcon className="w-4 h-4" /> Galeri
                </button>
                <button
                  type="button"
                  onClick={() => cameraRef.current?.click()}
                  className="py-3 bg-gray-50 rounded-xl text-sm font-bold text-gray-700 flex items-center justify-center gap-2"
                >
                  <Camera className="w-4 h-4" /> Kamera
                </button>
              </div>
              {(imageLoading || form.imageUrl) && (
                <div className="w-full h-36 bg-gray-100 rounded-2xl overflow-hidden flex items-center justify-center">
                  {imageLoading ? <span className="text-xs text-gray-400">Yükleniyor…</span> : <img src={form.imageUrl} className="w-full h-full object-cover" alt="" />}
                </div>
              )}
              <button
                onClick={handleAdd}
                disabled={createAnnouncement.isPending || !form.title || !form.content}
                className="w-full py-4 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/30 disabled:opacity-50"
              >
                {createAnnouncement.isPending ? "Yayınlanıyor…" : "Yayınla"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete */}
      {confirmDelete && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-bold text-lg mb-2">Duyuruyu Sil</h3>
            <p className="text-sm text-gray-500 mb-1 font-medium truncate">"{confirmDelete.title}"</p>
            <p className="text-sm text-gray-400 mb-6">Bu duyuru kalıcı olarak silinecek.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-600 font-bold text-sm">İptal</button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                disabled={deleteAnnouncement.isPending}
                className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 disabled:opacity-60"
              >
                {deleteAnnouncement.isPending ? "Siliniyor…" : "Sil"}
              </button>
            </div>
          </div>
        </div>
      )}
    </MobileContainer>
  );
}
