import { useState, useRef } from "react";
import { MobileContainer } from "@/components/layout/MobileContainer";
import { useAdverts, useCreateAdvert, useCloseAdvert, useAdvertCloseStats } from "@/hooks/use-features";
import { useAuth } from "@/hooks/use-auth";
import {
  Plus, X, Tag, Clock, User as UserIcon,
  Radio, Check, Camera, ImageIcon, Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { clsx } from "clsx";

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

const RADIUS_OPTIONS = [
  { value: 250,  label: "250 m",    desc: "Sadece yakın çevre" },
  { value: 500,  label: "500 m",    desc: "Mahalle içi" },
  { value: 1000, label: "1 km",     desc: "Geniş çevre" },
  { value: 2000, label: "2 km",     desc: "Bölge geneli" },
  { value: 5000, label: "5 km",     desc: "İlçe geneli" },
];

const CURRENCIES = ["₺", "$", "€"];

const CATEGORIES = [
  "Elektronik", "Mobilya", "Giyim", "Araç/Vasıta", "Ev Eşyası",
  "Kitap", "Spor", "Bahçe", "Çocuk", "Diğer",
];

function formatAdvertPrice(price: string | number | null | undefined) {
  if (price === null || price === undefined || price === "") return "";

  const normalized = String(price).replace(/\./g, "").replace(",", ".").trim();
  const numeric = Number(normalized);

  if (!Number.isFinite(numeric)) return String(price);

  return new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: 2,
  }).format(numeric);
}

function RadiusSelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-gray-600 flex items-center gap-1.5">
        <Radio className="w-3.5 h-3.5 text-primary" />
        Görünürlük Mesafesi
      </label>
      <div className="grid grid-cols-5 gap-1">
        {RADIUS_OPTIONS.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={clsx(
              "flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl border-2 transition-all text-center",
              value === opt.value
                ? "border-primary bg-primary/10 text-primary"
                : "border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200"
            )}
          >
            <span className="text-[10px] font-black leading-none">{opt.label}</span>
            {value === opt.value && <Check className="w-2.5 h-2.5" />}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-gray-400">
        {RADIUS_OPTIONS.find(o => o.value === value)?.desc} — yalnızca bu mesafedeki komşular görebilir
      </p>
    </div>
  );
}

export default function Adverts() {
  const { user } = useAuth();
  const { data: adverts = [], isLoading } = useAdverts();
  const { data: closeStats } = useAdvertCloseStats();
  const createAdvert = useCreateAdvert();
  const closeAdvert = useCloseAdvert();

  const [isAdding, setIsAdding] = useState(false);
  const [selectedAd, setSelectedAd] = useState<any>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    currency: "₺",
    imageUrl: "",
    category: "Diğer",
    visibilityRadius: 500,
  });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [error, setError] = useState("");
  const [closeReason, setCloseReason] = useState<"sold" | "rented" | "withdrawn">("sold");
  const [closeError, setCloseError] = useState("");

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const handleImageFile = async (file: File | null | undefined) => {
    if (!file) return;
    setImageLoading(true);
    try {
      const dataUrl = await compressImage(file);
      setImagePreview(dataUrl);
      setForm(f => ({ ...f, imageUrl: dataUrl }));
    } catch {
      setError("Görsel yüklenemedi.");
    } finally {
      setImageLoading(false);
    }
  };

  const removeImage = () => {
    setImagePreview(null);
    setForm(f => ({ ...f, imageUrl: "" }));
    if (cameraRef.current) cameraRef.current.value = "";
    if (galleryRef.current) galleryRef.current.value = "";
  };

  const resetForm = () => {
    setForm({ title: "", description: "", price: "", currency: "₺", imageUrl: "", category: "Diğer", visibilityRadius: 500 });
    setImagePreview(null);
    setError("");
  };

  const handleAdd = async () => {
    if (!form.title.trim()) { setError("Başlık zorunludur."); return; }
    if (!form.description.trim()) { setError("Açıklama zorunludur."); return; }
    try {
      await createAdvert.mutateAsync({
        title: form.title,
        description: form.description,
        price: form.price || undefined,
        currency: form.currency,
        imageUrl: form.imageUrl || undefined,
        visibilityRadius: form.visibilityRadius,
      });
      setIsAdding(false);
      resetForm();
    } catch (e: any) {
      setError(e?.message || "İlan yayınlanamadı. Lütfen tekrar deneyin.");
    }
  };

  const handleCloseAdvert = async () => {
    if (!selectedAd?.id) return;
    setCloseError("");
    try {
      await closeAdvert.mutateAsync({ id: selectedAd.id, reason: closeReason });
      setSelectedAd(null);
    } catch (e: any) {
      setCloseError(e?.message || "İlan kapatılamadı. Lütfen tekrar deneyin.");
    }
  };

  return (
    <MobileContainer>
      <div className="flex flex-col min-h-full pb-24">

        {/* Header */}
        <div className="bg-emerald-500 px-6 pt-10 pb-8 rounded-b-[2rem] shadow-md mb-4 relative overflow-hidden">
          <div className="absolute -right-8 -bottom-6 w-36 h-36 bg-white/10 rounded-full" />
          <div className="absolute right-10 -top-6 w-20 h-20 bg-white/10 rounded-full blur-xl" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-11 h-11 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
              <Tag className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">İlanlar</h1>
              <p className="text-emerald-100/90 text-sm">Al, sat, kirala, paylaş</p>
            </div>
          </div>
        </div>

        {closeStats && (
          <div className="px-4 mb-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-3 grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-emerald-50 px-2 py-2 text-center">
                <p className="text-[10px] text-emerald-600 font-bold">Satıldı</p>
                <p className="text-sm font-black text-emerald-700">{closeStats.sold}</p>
              </div>
              <div className="rounded-xl bg-blue-50 px-2 py-2 text-center">
                <p className="text-[10px] text-blue-600 font-bold">Kiralandı</p>
                <p className="text-sm font-black text-blue-700">{closeStats.rented}</p>
              </div>
              <div className="rounded-xl bg-amber-50 px-2 py-2 text-center">
                <p className="text-[10px] text-amber-600 font-bold">Vazgeçildi</p>
                <p className="text-sm font-black text-amber-700">{closeStats.withdrawn}</p>
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="px-4 grid grid-cols-2 gap-3">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-52 bg-white rounded-3xl animate-pulse border border-gray-100" />
            ))}
          </div>
        )}

        {/* Empty */}
        {!isLoading && (adverts as any[]).length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 px-8 text-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center">
              <Tag className="w-8 h-8 text-emerald-500" />
            </div>
            <p className="text-sm font-bold text-gray-500">Henüz ilan yok</p>
            <p className="text-xs text-gray-400">İlk ilanını paylaşmak için aşağıdaki + butonuna dokun.</p>
          </div>
        )}

        {/* Grid */}
        {!isLoading && (adverts as any[]).length > 0 && (
          <div className="px-4 grid grid-cols-2 gap-3">
            {(adverts as any[]).map((ad: any) => (
              <button
                key={ad.id}
                onClick={() => {
                  setSelectedAd(ad);
                  setCloseReason("sold");
                  setCloseError("");
                }}
                className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 flex flex-col text-left hover:shadow-md active:scale-[0.98] transition-all"
              >
                {/* Image */}
                <div className="h-32 bg-gradient-to-br from-gray-100 to-gray-50 relative overflow-hidden">
                  {ad.imageUrl ? (
                    <img src={ad.imageUrl} alt={ad.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Tag className="w-8 h-8 text-gray-200" />
                    </div>
                  )}
                  {ad.price && (
                    <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm text-white text-[11px] font-black px-2 py-0.5 rounded-lg">
                      {formatAdvertPrice(ad.price)} {ad.currency || "₺"}
                    </div>
                  )}
                  <div className="absolute top-2 right-2 bg-white/90 text-[8px] font-bold text-primary px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                    <Radio className="w-2 h-2" />
                    {ad.visibilityRadius >= 1000 ? `${ad.visibilityRadius / 1000} km` : `${ad.visibilityRadius} m`}
                  </div>
                </div>

                {/* Info */}
                <div className="p-3 flex-1 flex flex-col gap-1">
                  <h3 className="text-xs font-black text-foreground line-clamp-1">{ad.title}</h3>
                  <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">{ad.description}</p>
                  <div className="mt-auto pt-2 flex items-center justify-between">
                    <div className="flex items-center gap-1 text-[9px] text-gray-400">
                      <UserIcon className="w-2.5 h-2.5" />
                      <span className="font-semibold text-primary">{ad.user?.firstName || "Komşu"}</span>
                    </div>
                    <span className="text-[9px] text-gray-300">
                      {format(new Date(ad.createdAt), "d MMM", { locale: tr })}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* FAB */}
        <button
          onClick={() => setIsAdding(true)}
          className="absolute bottom-6 right-6 w-14 h-14 bg-emerald-500 text-white rounded-2xl shadow-xl shadow-emerald-400/50 flex items-center justify-center hover:-translate-y-1 active:scale-95 transition-all z-30"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* ── Ad Detail Modal ── */}
      {selectedAd && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 flex flex-col justify-end">
          <div className="bg-white rounded-t-[2rem] max-h-[85vh] overflow-y-auto">
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <h2 className="text-lg font-black text-foreground flex-1 pr-3">{selectedAd.title}</h2>
                <button onClick={() => setSelectedAd(null)} className="p-2 bg-gray-100 rounded-full shrink-0">
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              {selectedAd.imageUrl && (
                <div className="h-44 bg-gray-100 rounded-2xl overflow-hidden mb-4">
                  <img src={selectedAd.imageUrl} className="w-full h-full object-cover" />
                </div>
              )}

              {selectedAd.price && (
                <div className="bg-primary/10 rounded-2xl px-4 py-3 mb-4 inline-flex items-center gap-2">
                  <span className="text-2xl font-black text-primary">{formatAdvertPrice(selectedAd.price)} {selectedAd.currency || "₺"}</span>
                </div>
              )}

              <p className="text-sm text-gray-600 leading-relaxed mb-4">{selectedAd.description}</p>

              <div className="flex items-center gap-4 text-[10px] text-gray-400">
                <span className="flex items-center gap-1">
                  <UserIcon className="w-3 h-3" />
                  {selectedAd.user?.firstName} {selectedAd.user?.lastName}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {format(new Date(selectedAd.createdAt), "d MMMM yyyy", { locale: tr })}
                </span>
                <span className="flex items-center gap-1 text-primary font-bold">
                  <Radio className="w-3 h-3" />
                  {selectedAd.visibilityRadius >= 1000 ? `${selectedAd.visibilityRadius / 1000} km` : `${selectedAd.visibilityRadius} m`}
                </span>
              </div>

              <button className="mt-5 w-full bg-primary text-white py-3 rounded-2xl font-bold text-sm hover:bg-primary/90 active:scale-[0.98] transition-all">
                İlan Sahibiyle İletişime Geç
              </button>

              {user?.id === selectedAd.userId && (
                <div className="mt-4 border border-gray-200 rounded-2xl p-3 bg-gray-50 space-y-2.5">
                  <p className="text-xs font-black text-gray-700">İlanı Kaldırma Sekmesi</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCloseReason("sold")}
                      className={clsx(
                        "text-[10px] font-bold rounded-xl py-2 border",
                        closeReason === "sold" ? "bg-emerald-500 text-white border-emerald-500" : "bg-white text-gray-600 border-gray-200"
                      )}
                    >
                      Satıldı
                    </button>
                    <button
                      type="button"
                      onClick={() => setCloseReason("rented")}
                      className={clsx(
                        "text-[10px] font-bold rounded-xl py-2 border",
                        closeReason === "rented" ? "bg-blue-500 text-white border-blue-500" : "bg-white text-gray-600 border-gray-200"
                      )}
                    >
                      Kiralandı
                    </button>
                    <button
                      type="button"
                      onClick={() => setCloseReason("withdrawn")}
                      className={clsx(
                        "text-[10px] font-bold rounded-xl py-2 border",
                        closeReason === "withdrawn" ? "bg-amber-500 text-white border-amber-500" : "bg-white text-gray-600 border-gray-200"
                      )}
                    >
                      Vazgeçtim
                    </button>
                  </div>

                  {closeError && (
                    <div className="bg-red-50 border border-red-200 text-red-600 text-[11px] rounded-xl px-2.5 py-1.5 font-medium">
                      {closeError}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleCloseAdvert}
                    disabled={closeAdvert.isPending}
                    className="w-full py-2.5 rounded-xl bg-gray-900 text-white text-xs font-black hover:bg-black active:scale-[0.99] transition-all disabled:opacity-60"
                  >
                    {closeAdvert.isPending ? "Gönderiliyor…" : "İlanı Kaldır ve İstatistik Gönder"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Add Modal ── */}
      {isAdding && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 flex flex-col justify-end">
          <div className="bg-white rounded-t-[2rem] max-h-[92vh] overflow-y-auto">
            <div className="p-5 space-y-4">
              {/* Handle bar */}
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto -mt-1 mb-2" />

              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black">Yeni İlan Ver</h3>
                <button onClick={() => { setIsAdding(false); resetForm(); }} className="p-2 bg-gray-100 rounded-full">
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl px-3 py-2 font-medium">
                  {error}
                </div>
              )}

              {/* Title */}
              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">Başlık *</label>
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="İlanınızın başlığı…"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
                  maxLength={80}
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">Açıklama *</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="İlanınızı detaylı açıklayın…"
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary resize-none"
                  maxLength={2000}
                />
              </div>

              {/* Price + Currency */}
              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">Fiyat (opsiyonel)</label>
                <div className="flex gap-2">
                  <input
                    value={form.price}
                    onChange={e => {
                      let val = e.target.value.replace(/[^0-9,]/g, "");
                      const parts = val.split(',');
                      if (parts.length > 2) val = parts[0] + ',' + parts.slice(1).join('');
                      if (parts.length > 1) {
                        val = Number(parts[0] || 0).toLocaleString('tr-TR') + ',' + parts[1].slice(0,2);
                      } else if (val) {
                        val = Number(val).toLocaleString('tr-TR');
                      }
                      setForm(f => ({ ...f, price: val }));
                    }}
                    placeholder="0,00"
                    type="text"
                    inputMode="decimal"
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
                  />
                  <div className="flex gap-1">
                    {CURRENCIES.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, currency: c }))}
                        className={clsx(
                          "w-10 h-10 rounded-xl font-bold text-sm border-2 transition-all",
                          form.currency === c ? "border-primary bg-primary text-white" : "border-gray-200 text-gray-500"
                        )}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Image picker */}
              <div>
                <label className="text-xs font-bold text-gray-600 mb-1.5 block">Görsel (opsiyonel)</label>

                {/* Hidden file inputs */}
                <input
                  ref={cameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={e => handleImageFiles(e.target.files)}
                />
                <input
                  ref={galleryRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={e => handleImageFiles(e.target.files)}
                />

                {imagePreviews.length > 0 ? (
                  /* Preview */
                  <div className="space-y-2">
                    <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
                      {imagePreviews.map((img, idx) => (
                        <div key={idx} className="relative rounded-2xl overflow-hidden bg-gray-100 h-24 w-24 shrink-0">
                          <img src={img} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeImage(idx)}
                            className="absolute top-1 right-1 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      {imagePreviews.length < 20 && (
                        <button
                          type="button"
                          onClick={() => galleryRef.current?.click()}
                          className="h-24 w-24 shrink-0 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 text-gray-400 flex flex-col items-center justify-center gap-1 hover:bg-primary/5 hover:text-primary transition-colors"
                        >
                          <Plus className="w-5 h-5" />
                          <span className="text-[10px] font-bold">Ekle</span>
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => cameraRef.current?.click()}
                        className="flex-1 py-2 bg-black/50 text-white text-[11px] font-bold flex items-center justify-center gap-1 rounded-xl hover:bg-black/70 transition-colors"
                      >
                        <Camera className="w-4 h-4" /> Kamera
                      </button>
                      <button
                        type="button"
                        onClick={() => galleryRef.current?.click()}
                        className="flex-1 py-2 bg-black/50 text-white text-[11px] font-bold flex items-center justify-center gap-1 rounded-xl hover:bg-black/70 transition-colors"
                      >
                        <ImageIcon className="w-4 h-4" /> Galeri
                      </button>
                    </div>
                    {imageLoading && <p className="text-xs text-primary font-medium animate-pulse">Yükleniyor...</p>}
                  </div>
                ) : (
                  /* Picker buttons */
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => cameraRef.current?.click()}
                      disabled={imageLoading}
                      className="flex-1 flex flex-col items-center gap-2 py-4 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 text-gray-400 hover:border-primary/40 hover:bg-primary/5 hover:text-primary active:scale-[0.97] transition-all disabled:opacity-50"
                    >
                      {imageLoading ? (
                        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Camera className="w-6 h-6" />
                      )}
                      <span className="text-[11px] font-bold">Kamera</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => galleryRef.current?.click()}
                      disabled={imageLoading}
                      className="flex-1 flex flex-col items-center gap-2 py-4 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 text-gray-400 hover:border-primary/40 hover:bg-primary/5 hover:text-primary active:scale-[0.97] transition-all disabled:opacity-50"
                    >
                      {imageLoading ? (
                        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <ImageIcon className="w-6 h-6" />
                      )}
                      <span className="text-[11px] font-bold">Galeriden Seç</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Visibility Radius */}
              <RadiusSelector value={form.visibilityRadius} onChange={v => setForm(f => ({ ...f, visibilityRadius: v }))} />

              {/* Submit */}
              <button
                onClick={handleAdd}
                disabled={createAdvert.isPending}
                className="w-full bg-primary text-white py-3.5 rounded-2xl font-black text-sm shadow-lg shadow-primary/30 hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {createAdvert.isPending ? "Yayınlanıyor…" : "İlanı Yayınla"}
              </button>
            </div>
          </div>
        </div>
      )}
    </MobileContainer>
  );
}
