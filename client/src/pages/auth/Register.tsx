import { useState } from "react";
import PhoneVerify from "./PhoneVerify";
import { useEffect } from "react";
import { useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { MobileContainer } from "@/components/layout/MobileContainer";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Camera, ImagePlus, User as UserIcon } from "lucide-react";

const TURKEY_CITIES = [
  "Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Aksaray", "Amasya", "Ankara", "Antalya", "Ardahan", "Artvin",
  "Aydın", "Balıkesir", "Bartın", "Batman", "Bayburt", "Bilecik", "Bingöl", "Bitlis", "Bolu", "Burdur",
  "Bursa", "Çanakkale", "Çankırı", "Çorum", "Denizli", "Diyarbakır", "Düzce", "Edirne", "Elazığ", "Erzincan",
  "Erzurum", "Eskişehir", "Gaziantep", "Giresun", "Gümüşhane", "Hakkari", "Hatay", "Iğdır", "Isparta", "İstanbul",
  "İzmir", "Kahramanmaraş", "Karabük", "Karaman", "Kars", "Kastamonu", "Kayseri", "Kırıkkale", "Kırklareli", "Kırşehir",
  "Kilis", "Kocaeli", "Konya", "Kütahya", "Malatya", "Manisa", "Mardin", "Mersin", "Muğla", "Muş",
  "Nevşehir", "Niğde", "Ordu", "Osmaniye", "Rize", "Sakarya", "Samsun", "Siirt", "Sinop", "Sivas",
  "Şanlıurfa", "Şırnak", "Tekirdağ", "Tokat", "Trabzon", "Tunceli", "Uşak", "Van", "Yalova", "Yozgat", "Zonguldak",
];

const FALLBACK_DISTRICTS = ["Merkez"];
const FALLBACK_NEIGHBORHOODS = ["Merkez Mahallesi"];
const FALLBACK_STREETS: StreetOption[] = [
  { street: "Atatürk", type: "avenue" },
  { street: "Cumhuriyet", type: "street" },
  { street: "İnönü", type: "boulevard" },
];

type StreetOption = { street: string; type: string };

const streetTypeLabel = (type: string) => {
  if (type === "street") return "Sokak";
  if (type === "avenue") return "Cadde";
  if (type === "boulevard") return "Bulvar";
  return type;
};

export default function Register() {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "+90 ", // Otomatik +90 ile başlasın
    email: "",
    password: "",
    passwordConfirm: "",
    avatarUrl: "",
    city: "",
    district: "",
    neighborhood: "",
    street: "",
    streetType: "street",
    doorNo: "",
    innerDoorNo: "",
  });

  const [cities, setCities] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<string[]>([]);
  const [streets, setStreets] = useState<StreetOption[]>([]);
  const [isLocationLoading, setIsLocationLoading] = useState(false);
  const [manualStreet, setManualStreet] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);

  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  
  const { register, isRegistering } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.name === "phone") {
      let value = e.target.value;
      // Sadece +90 ile başlasın ve 10 hane girilebilsin, otomatik boşluk ekle
      if (!value.startsWith("+90 ")) value = "+90 ";
      value = value.replace(/[^0-9]/g, "");
      value = value.slice(0, 12); // +90 dahil 12 karakter
      // +90 5XX XXX XX XX formatına otomatik boşluk ekle
      let formatted = "+90 ";
      if (value.length > 2) formatted += value.slice(2, 5);
      if (value.length > 5) formatted += " " + value.slice(5, 8);
      if (value.length > 8) formatted += " " + value.slice(8, 10);
      if (value.length > 10) formatted += " " + value.slice(10, 12);
      setFormData({ ...formData, phone: formatted.trimEnd() });
    } else if (e.target.name === "innerDoorNo") {
      // Sadece sayı girilsin
      let value = e.target.value.replace(/\D/g, "");
      setFormData({ ...formData, innerDoorNo: value });
    } else if (e.target.name === "firstName") {
      // İlk harfi büyük, diğerleri küçük olacak şekilde otomatik düzelt
      let value = e.target.value;
      if (value.length > 0) {
        value = value.charAt(0).toLocaleUpperCase("tr-TR") + value.slice(1).toLocaleLowerCase("tr-TR");
      }
      setFormData({ ...formData, firstName: value });
    } else if (e.target.name === "lastName") {
      // Sadece büyük harf girilebilsin
      let value = e.target.value.replace(/[^A-ZÇĞİÖŞÜ\s]/gi, "").toLocaleUpperCase("tr-TR");
      setFormData({ ...formData, lastName: value });
    } else {
      setFormData({ ...formData, [e.target.name]: e.target.value });
    }
  };

  // Telefon inputuna odaklanınca otomatik +90 ekle
  const handlePhoneFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (!formData.phone.startsWith("+90 ")) {
      setFormData((prev) => ({ ...prev, phone: "+90 " }));
    }
  };
  // Apartman olmayan yerler için iç kapı no otomatik 0
  useEffect(() => {
    if (formData.neighborhood && /köy|ev/i.test(formData.neighborhood)) {
      setFormData((prev) => ({ ...prev, innerDoorNo: "0" }));
    }
  }, [formData.neighborhood]);

  const handleImagePicked = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      setFormData((prev) => ({ ...prev, avatarUrl: dataUrl }));
    };
    reader.readAsDataURL(file);
  };

  const apiBase = import.meta.env.VITE_API_BASE_URL || "";
  useEffect(() => {
    const loadCities = async () => {
      try {
        const res = await fetch(`${apiBase}/api/locations/cities`);
        if (!res.ok) throw new Error("Şehirler alınamadı");
        const data = await res.json();
        setCities(data?.length ? data : TURKEY_CITIES);
      } catch (err) {
        console.error(err);
        setCities(TURKEY_CITIES);
      }
    };
    loadCities();
  }, [apiBase]);

  useEffect(() => {
    if (!formData.city) return;

    setIsLocationLoading(true);
    setDistricts([]);
    setNeighborhoods([]);
    setStreets([]);
    setFormData((prev) => ({ ...prev, district: "", neighborhood: "", street: "", streetType: "street" }));

    fetch(`${apiBase}/api/locations/districts?city=${encodeURIComponent(formData.city)}`)
      .then((res) => {
        if (!res.ok) throw new Error("İlçeler alınamadı");
        return res.json();
      })
      .then((data) => setDistricts(data?.length ? data : FALLBACK_DISTRICTS))
      .catch((err) => console.error(err))
      .finally(() => setIsLocationLoading(false));
  }, [formData.city, apiBase]);

  useEffect(() => {
    if (!formData.city || !formData.district) return;

    setIsLocationLoading(true);
    setNeighborhoods([]);
    setStreets([]);
    setFormData((prev) => ({ ...prev, neighborhood: "", street: "", streetType: "street" }));

    fetch(`${apiBase}/api/locations/neighborhoods?city=${encodeURIComponent(formData.city)}&district=${encodeURIComponent(formData.district)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Mahalleler alınamadı");
        return res.json();
      })
      .then((rows) => {
        const unique = Array.from(new Set((rows as any[]).map((r) => r.neighborhood))).sort();
        setNeighborhoods(unique.length ? unique : FALLBACK_NEIGHBORHOODS);
      })
      .catch((err) => console.error(err))
      .finally(() => setIsLocationLoading(false));
  }, [formData.city, formData.district, apiBase]);

  useEffect(() => {
    if (!formData.city || !formData.district || !formData.neighborhood) return;

    setIsLocationLoading(true);
    setStreets([]);
    setFormData((prev) => ({ ...prev, street: "", streetType: "street" }));

    fetch(`${apiBase}/api/locations/streets?city=${encodeURIComponent(formData.city)}&district=${encodeURIComponent(formData.district)}&neighborhood=${encodeURIComponent(formData.neighborhood)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Sokak/Cadde/Bulvarlar alınamadı");
        return res.json();
      })
      .then((data) => setStreets(data?.length ? data : FALLBACK_STREETS))
      .catch((err) => console.error(err))
      .finally(() => setIsLocationLoading(false));
  }, [formData.city, formData.district, formData.neighborhood, apiBase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneVerified) {
      toast({
        title: "Telefon Doğrulama",
        description: "Telefon numaranızı doğrulamanız gerekmektedir.",
        variant: "destructive",
      });
      return;
    }
    if (formData.password !== formData.passwordConfirm) {
      return toast({
        title: "Hata",
        description: "Şifreler eşleşmiyor.",
        variant: "destructive",
      });
    }
    if (!formData.avatarUrl) {
      return toast({
        title: "Hata",
        description: "Profil fotoğrafı seçmelisiniz.",
        variant: "destructive",
      });
    }
    if (manualStreet && !formData.street.trim()) {
      return toast({
        title: "Hata",
        description: "Sokak/Cadde/Bulvar adını giriniz.",
        variant: "destructive",
      });
    }
    try {
      if (manualStreet && formData.street.trim()) {
        await fetch((import.meta.env.VITE_API_BASE_URL || "") + "/api/streets/pending", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            city: formData.city,
            district: formData.district,
            neighborhood: formData.neighborhood,
            street: formData.street,
            type: formData.streetType,
          }),
        });
      }
      const result = await register(formData);
      toast({
        title: "Başarılı",
        description: result?.isApproved
          ? "Kayıt tamamlandı, ana sayfaya yönlendiriliyorsunuz."
          : "Kaydınız alındı. Yönetici onayı bekleniyor.",
      });
      setLocation(result?.isApproved ? "/" : "/pending-approval");
    } catch (err: any) {
      toast({
        title: "Kayıt Başarısız",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  return (
    <MobileContainer showNav={false}>
      <div className="min-h-full flex flex-col p-6 animate-slide-up bg-white">
        <Link href="/login" className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 mb-6 hover:bg-gray-200 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        
        <h1 className="text-3xl font-bold text-foreground mb-2">Kayıt Ol</h1>
        <p className="text-muted-foreground mb-8">Komşularına katılmak için bilgilerini doldur.</p>

        {!phoneVerified && (
          <PhoneVerify phone={formData.phone} onVerified={() => setPhoneVerified(true)} />
        )}
        <form onSubmit={handleSubmit} className="space-y-4 pb-12">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase ml-1">Ad</label>
              <input name="firstName" value={formData.firstName} onChange={handleChange} required className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20" autoCapitalize="words" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase ml-1">Soyad</label>
              <input name="lastName" value={formData.lastName} onChange={handleChange} required className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20" style={{ textTransform: 'uppercase' }} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase ml-1">Telefon (+90...)</label>
            <input
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              onFocus={handlePhoneFocus}
              required
              placeholder="+90 5XX XXX XX XX"
              maxLength={17}
              pattern="\+90 5[0-9]{2} [0-9]{3} [0-9]{2} [0-9]{2}"
              inputMode="numeric"
              type="tel"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase ml-1">E-posta</label>
            <input name="email" type="email" value={formData.email} onChange={handleChange} required className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase ml-1">Profil Fotoğrafı</label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gray-100 overflow-hidden border border-gray-200 flex items-center justify-center">
                {formData.avatarUrl ? (
                  <img src={formData.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <UserIcon className="w-7 h-7 text-gray-400" />
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="px-3 py-2 rounded-xl bg-primary/10 text-primary text-xs font-semibold flex items-center gap-1"
                >
                  <Camera className="w-4 h-4" /> Kamera
                </button>
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="px-3 py-2 rounded-xl bg-secondary/10 text-secondary text-xs font-semibold flex items-center gap-1"
                >
                  <ImagePlus className="w-4 h-4" /> Galeri
                </button>
              </div>
            </div>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleImagePicked(e.target.files?.[0])}
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleImagePicked(e.target.files?.[0])}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase ml-1">İl</label>
            <select
              required
              value={formData.city}
              onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">İl seçiniz</option>
              {cities.map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase ml-1">İlçe</label>
            <select
              required
              value={formData.district}
              disabled={!formData.city || isLocationLoading}
              onChange={(e) => setFormData((prev) => ({ ...prev, district: e.target.value }))}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
            >
              <option value="">İlçe seçiniz</option>
              {districts.map((district) => (
                <option key={district} value={district}>{district}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase ml-1">Mahalle</label>
            <select
              required
              value={formData.neighborhood}
              disabled={!formData.district || isLocationLoading}
              onChange={(e) => setFormData((prev) => ({ ...prev, neighborhood: e.target.value }))}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
            >
              <option value="">Mahalle seçiniz</option>
              {neighborhoods.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase ml-1">Sokak / Cadde / Bulvar</label>
            <select
              required
              value={formData.street}
              disabled={!formData.neighborhood || isLocationLoading}
              onChange={(e) => {
                if (e.target.value === "__manual__") {
                  setManualStreet(true);
                  setFormData((prev) => ({
                    ...prev,
                    street: "",
                    streetType: "street",
                  }));
                  return;
                }

                setManualStreet(false);
                const selected = streets.find((s) => s.street === e.target.value);
                setFormData((prev) => ({
                  ...prev,
                  street: e.target.value,
                  streetType: selected?.type || "street",
                }));
              }}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
            >
              <option value="">Sokak/Cadde/Bulvar seçiniz</option>
              {streets.map((s) => (
                <option key={`${s.type}-${s.street}`} value={s.street}>
                  {streetTypeLabel(s.type)} {s.street}
                </option>
              ))}
              <option value="__manual__">Listede yok (elle gir)</option>
            </select>
          </div>

          {manualStreet && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase ml-1">Sokak/Cadde/Bulvar Adı</label>
                <input
                  name="street"
                  value={formData.street}
                  onChange={handleChange}
                  required={manualStreet}
                  placeholder="Örn: Atatürk"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase ml-1">Tür</label>
                <select
                  value={formData.streetType}
                  onChange={(e) => setFormData((prev) => ({ ...prev, streetType: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="street">Sokak</option>
                  <option value="avenue">Cadde</option>
                  <option value="boulevard">Bulvar</option>
                </select>
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase ml-1">Kapı Numarası</label>
            <input
              name="doorNo"
              value={formData.doorNo}
              onChange={handleChange}
              required
              placeholder="Örn: 12A"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase ml-1">İç Kapı Numarası</label>
            <input
              name="innerDoorNo"
              value={formData.innerDoorNo}
              onChange={handleChange}
              required
              placeholder="Apartman değilse 0 yazılır"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase ml-1">Şifre</label>
            <input name="password" type="password" value={formData.password} onChange={handleChange} required className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase ml-1">Şifre Tekrar</label>
            <input name="passwordConfirm" type="password" value={formData.passwordConfirm} onChange={handleChange} required className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>

          <button
            type="submit"
            disabled={isRegistering}
            className="w-full py-4 mt-4 bg-secondary text-white font-bold rounded-2xl shadow-lg shadow-secondary/30 hover:-translate-y-0.5 transition-all disabled:opacity-70 flex items-center justify-center"
          >
            {isRegistering ? <Loader2 className="w-5 h-5 animate-spin" /> : "Hesap Oluştur"}
          </button>
        </form>
      </div>
    </MobileContainer>
  );
}
