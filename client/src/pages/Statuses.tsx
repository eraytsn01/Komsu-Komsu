import { useState, useRef } from "react";
import { MobileContainer } from "@/components/layout/MobileContainer";
import { useStatuses, useCreateStatus, useDeleteStatus } from "@/hooks/use-features";
import { Plus, Camera, X, Image as ImageIcon, Trash2, CircleDashed, ChevronRight } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

async function compressImage(file: File, maxDim = 800, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
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

export default function Statuses() {
  const { data: statuses = [], isLoading } = useStatuses();
  const { user } = useAuth();
  const { toast } = useToast();
  const createStatus = useCreateStatus();
  const deleteStatus = useDeleteStatus();
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const [isAdding, setIsAdding] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [viewingStatus, setViewingStatus] = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState<any>(null);

  const handleImageFile = async (file: File | null | undefined) => {
    if (!file) return;
    setImageLoading(true);
    try {
      const url = await compressImage(file);
      setImagePreview(url);
    } catch { toast({ title: "Görsel yüklenemedi", variant: "destructive" }); }
    finally { setImageLoading(false); }
  };

  const handleAdd = async () => {
    if (!newContent && !imagePreview) return;
    await createStatus.mutateAsync({ content: newContent, imageUrl: imagePreview || "" });
    setIsAdding(false);
    setNewContent("");
    setImagePreview(null);
  };

  const handleDelete = async (status: any) => {
    try {
      await deleteStatus.mutateAsync(status.id);
      setConfirmDelete(null);
      if (viewingStatus?.id === status.id) setViewingStatus(null);
      toast({ title: "Durum silindi" });
    } catch { toast({ title: "Silinemedi", variant: "destructive" }); }
  };

  const canManage = (status: any) => status.userId === user?.id || user?.isAdmin;

  const sortedStatuses = [...(statuses as any[])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const groupedByUser = sortedStatuses.reduce((acc: Record<string, any>, status: any) => {
    const key = String(status.userId);
    if (!acc[key]) {
      acc[key] = {
        userId: status.userId,
        user: status.user,
        items: [],
      };
    }
    acc[key].items.push(status);
    return acc;
  }, {});

  const groupedStatuses = Object.values(groupedByUser) as Array<{ userId: number; user: any; items: any[] }>;
  const myGroup = groupedStatuses.find((g) => g.userId === user?.id);
  const otherGroups = groupedStatuses.filter((g) => g.userId !== user?.id);

  const openStatus = (status: any) => {
    setViewingStatus(status);
    if (status.userId !== user?.id) {
      apiRequest("POST", `/api/statuses/${status.id}/view`);
    }
  };

  return (
    <MobileContainer>
      <div className="flex flex-col min-h-full pb-24">
        <div className="bg-violet-500 px-6 pt-10 pb-8 rounded-b-[2rem] shadow-md mb-4 relative overflow-hidden">
          <div className="absolute -right-8 -bottom-6 w-36 h-36 bg-white/10 rounded-full" />
          <div className="absolute right-10 -top-6 w-20 h-20 bg-white/10 rounded-full blur-xl" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-11 h-11 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
              <CircleDashed className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Durumlar</h1>
              <p className="text-violet-100/90 text-sm">Komşularının 24 saatlik halleri</p>
            </div>
          </div>
        </div>

        {/* WhatsApp-style status list */}
        <div className="px-4 space-y-4">
          <button
            onClick={() => setIsAdding(true)}
            className="w-full bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3 hover:bg-gray-50 transition-colors"
          >
            <div className="w-14 h-14 rounded-full bg-primary/10 border-2 border-dashed border-primary flex items-center justify-center text-primary shrink-0">
              <Plus className="w-6 h-6" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-bold text-foreground">Durumum</p>
              <p className="text-xs text-muted-foreground truncate">
                {myGroup?.items?.length
                  ? `Son güncelleme ${formatDistanceToNow(new Date(myGroup.items[0].createdAt), { addSuffix: true, locale: tr })}`
                  : "Durum eklemek için dokun"}
              </p>
            </div>
            {myGroup?.items?.length ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openStatus(myGroup.items[0]);
                }}
                className="p-2 text-violet-500 hover:bg-violet-50 rounded-xl transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            ) : null}
          </button>

          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-2">Güncellemeler</p>

            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-white rounded-2xl animate-pulse border border-gray-100" />
                ))}
              </div>
            ) : otherGroups.length > 0 ? (
              <div className="space-y-2">
                {otherGroups.map((group) => {
                  const latest = group.items[0];
                  const previewText = latest.content?.trim()
                    ? latest.content
                    : latest.imageUrl
                      ? "Fotoğraf paylaştı"
                      : "Durum paylaştı";

                  return (
                    <button
                      key={group.userId}
                      onClick={() => openStatus(latest)}
                      className="w-full bg-white rounded-2xl p-3 border border-gray-100 shadow-sm flex items-center gap-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-violet-500 to-fuchsia-500 p-[2px] shrink-0">
                        <div className="w-full h-full bg-white rounded-full p-[2px]">
                          <div className="w-full h-full rounded-full bg-gray-100 overflow-hidden flex items-center justify-center text-violet-600 font-bold">
                            {latest.imageUrl ? (
                              <img src={latest.imageUrl} className="w-full h-full object-cover" alt="status" />
                            ) : group.user?.avatarUrl ? (
                              <img src={group.user.avatarUrl} className="w-full h-full object-cover" alt="avatar" />
                            ) : (
                              group.user?.firstName?.[0] || "?"
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex-1 text-left min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{group.user?.firstName} {group.user?.lastName}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {previewText} · {formatDistanceToNow(new Date(latest.createdAt), { addSuffix: true, locale: tr })}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {group.items.length > 1 && (
                          <span className="text-[10px] font-bold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
                            +{group.items.length - 1}
                          </span>
                        )}
                        <ChevronRight className="w-4 h-4 text-gray-300" />
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-8 text-center border border-gray-100 text-muted-foreground text-sm">
                Henüz komşularından yeni durum yok.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Status Modal */}
      {isAdding && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col items-center justify-end p-4">
          <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl border border-border">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold">Yeni Durum</h3>
              <button onClick={() => { setIsAdding(false); setImagePreview(null); setNewContent(""); }} className="p-2 bg-gray-100 rounded-full text-gray-500"><X className="w-4 h-4" /></button>
            </div>

            <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={e => handleImageFile(e.target.files?.[0])} />
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handleImageFile(e.target.files?.[0])} />

            {imagePreview ? (
              <div className="relative h-40 rounded-2xl overflow-hidden mb-4">
                <img src={imagePreview} className="w-full h-full object-cover" />
                <button onClick={() => setImagePreview(null)} className="absolute top-2 right-2 w-7 h-7 bg-black/60 text-white rounded-full flex items-center justify-center">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex gap-3 mb-4">
                <button onClick={() => galleryRef.current?.click()} className="flex-1 flex flex-col items-center gap-2 p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors">
                  <ImageIcon className="w-6 h-6 text-primary" />
                  <span className="text-xs font-medium">Galeriden Seç</span>
                </button>
                <button onClick={() => cameraRef.current?.click()} className="flex-1 flex flex-col items-center gap-2 p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors">
                  <Camera className="w-6 h-6 text-primary" />
                  <span className="text-xs font-medium">Kamera</span>
                </button>
              </div>
            )}

            {imageLoading && <div className="text-center text-xs text-gray-400 mb-3">Yükleniyor…</div>}

            <textarea
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              placeholder="Ne düşünüyorsun?"
              rows={3}
              className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none resize-none mb-4"
            />
            <button
              onClick={handleAdd}
              disabled={(!newContent && !imagePreview) || createStatus.isPending}
              className="w-full py-3.5 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/30 disabled:opacity-50"
            >
              {createStatus.isPending ? "Paylaşılıyor…" : "Paylaş"}
            </button>
          </div>
        </div>
      )}

      {/* Status viewer */}
      {viewingStatus && (
        <div className="absolute inset-0 bg-black z-50 flex flex-col" onClick={() => setViewingStatus(null)}>
          <div className="flex items-center gap-3 p-4 absolute top-0 inset-x-0 z-10 bg-gradient-to-b from-black/70">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-bold text-white text-sm">
              {viewingStatus.user?.firstName?.[0]}
            </div>
            <div className="flex-1">
              <p className="text-white font-bold text-sm">{viewingStatus.user?.firstName} {viewingStatus.user?.lastName}</p>
              <p className="text-white/60 text-[10px]">{format(new Date(viewingStatus.createdAt), "HH:mm")}</p>
            </div>
            {canManage(viewingStatus) && (
              <button onClick={e => { e.stopPropagation(); setConfirmDelete(viewingStatus); setViewingStatus(null); }} className="p-2 text-white hover:text-red-400">
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button onClick={() => setViewingStatus(null)} className="p-2 text-white"><X className="w-5 h-5" /></button>
          </div>
          {viewingStatus.imageUrl ? (
            <img src={viewingStatus.imageUrl} className="w-full h-full object-cover" />
          ) : (
            <div className="flex-1 flex items-center justify-center p-8">
              <p className="text-white text-2xl font-bold text-center leading-relaxed">{viewingStatus.content}</p>
            </div>
          )}
          {viewingStatus.content && viewingStatus.imageUrl && (
            <div className="absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-black/70">
              <p className="text-white text-sm">{viewingStatus.content}</p>
            </div>
          )}
        </div>
      )}

      {/* Confirm Delete */}
      {confirmDelete && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-bold text-lg mb-2">Durumu Sil</h3>
            <p className="text-sm text-gray-500 mb-6">Bu durum kalıcı olarak silinecek. Emin misiniz?</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-600 font-bold text-sm">İptal</button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                disabled={deleteStatus.isPending}
                className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 disabled:opacity-60"
              >
                {deleteStatus.isPending ? "Siliniyor…" : "Sil"}
              </button>
            </div>
          </div>
        </div>
      )}
    </MobileContainer>
  );
}
