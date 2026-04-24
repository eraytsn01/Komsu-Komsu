import { MobileContainer } from "@/components/layout/MobileContainer";
import { Link } from "wouter";
import { ArrowLeft, User as UserIcon, Camera, ImagePlus, Loader2, CheckCircle2 } from "lucide-react";
import {
  getCityNames,
  getCityCodes,
  getDistrictsByCityCode,
} from "turkey-neighbourhoods";
import { storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

import React, { useState, useEffect, useRef } from "react";
// Basit hata yakalama için ErrorBoundary yerine try/catch ve fallback UI
function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const [error, setError] = useState<Error | null>(null);
  if (error) {
    return (
      <div style={{ color: 'red', padding: 16 }}>
        <h2>Bir hata oluştu:</h2>
        <pre>{error.message}</pre>
      </div>
    );
  }
  return (
    <React.Fragment>
      {React.Children.map(children, (child) => {
        try {
          return child;
        } catch (err: any) {
          setError(err);
          return null;
        }
      })}
    </React.Fragment>
  );
}


function Register() {
  // Ana form state
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    avatarUrl: "",
    city: "",
    district: "",
    neighborhood: "",
    street: "",
    streetType: "street",
    doorNo: "",
    innerDoorNo: "",
    password: "",
    passwordConfirm: "",
  });
  const [isRegistering, setIsRegistering] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  
  // SMS Doğrulama State'leri
  const [verificationCode, setVerificationCode] = useState("");
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false); // Ana formun kilidini açar
  const [verificationError, setVerificationError] = useState("");
  const [countdown, setCountdown] = useState(0); // 60 Saniyelik sayaç state'i

  const [manualStreet, setManualStreet] = useState(false);
  const [cities, setCities] = useState<string[]>([]);
  const [cityCodes, setCityCodes] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<string[]>([]);
  const [streets, setStreets] = useState<{ street: string; type: string }[]>([]);
  const [isLocationLoading, setIsLocationLoading] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  // Fallbacklar
  const FALLBACK_STREETS: { street: string; type: string }[] = [];

  // Geri sayım sayacı mekanizması
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // Resim seçme fonksiyonu
  function handleImagePicked(file: File | undefined) {
    if (!file) return;
    setSelectedImage(file);
    setFormData((prev) => ({ ...prev, avatarUrl: URL.createObjectURL(file) }));
  }

  // Yardımcı fonksiyonlar
  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  // Telefon numarasını otomatik formatla (+90 5XX XXX XX XX)
  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    let val = e.target.value.replace(/\D/g, ""); // Sadece rakamları al
    if (val.startsWith("90")) val = val.substring(2); // 90 ile başlıyorsa at (zaten ekleyeceğiz)

    let formatted = "+90 ";
    if (val.length > 0) formatted += val.substring(0, 3);
    if (val.length > 3) formatted += " " + val.substring(3, 6);
    if (val.length > 6) formatted += " " + val.substring(6, 8);
    if (val.length > 8) formatted += " " + val.substring(8, 10);

    setFormData((prev) => ({ ...prev, phone: formatted }));
  }

  function streetTypeLabel(type: string) {
    if (type === "avenue") return "Cadde";
    if (type === "boulevard") return "Bulvar";
    return "Sokak";
  }

  // Şehirler ve kodlarını turkey-neighbourhoods ile al
  useEffect(() => {
    setCities(getCityNames());
    setCityCodes(getCityCodes());
  }, []);

  // İl değişince ilçeleri turkey-neighbourhoods ile çek
  useEffect(() => {
    if (!formData.city) {
      setDistricts([]);
      setFormData((prev) => ({ ...prev, district: "" }));
      return;
    }
    const cityIdx = cities.findIndex((c) => c === formData.city);
    const cityCode = cityCodes[cityIdx];
    if (!cityCode) return;
    const ilceler = getDistrictsByCityCode(cityCode) || [];
    setDistricts(ilceler);
    if (!ilceler.includes(formData.district)) {
      setFormData((prev) => ({ ...prev, district: "" }));
    }
  }, [formData.city, cities, cityCodes]);

  // İlçe değişince mahalleleri çek
  useEffect(() => {
    if (!formData.city || !formData.district) {
      setNeighborhoods([]);
      setFormData((prev) => ({ ...prev, neighborhood: "", street: "" }));
      return;
    }
    setIsLocationLoading(true);
    fetch(`/api/locations/neighborhoods?city=${encodeURIComponent(formData.city)}&district=${encodeURIComponent(formData.district)}`)
      .then((res) => res.ok ? res.json() : [])
      .then((data) => {
        setNeighborhoods(data.map((n: any) => n.neighborhood));
      })
      .catch(() => setNeighborhoods([]))
      .finally(() => setIsLocationLoading(false));
  }, [formData.city, formData.district]);

  // Mahalle değişince sokakları çek
  useEffect(() => {
    if (!formData.city || !formData.district || !formData.neighborhood) {
      setStreets(FALLBACK_STREETS);
      setFormData((prev) => ({ ...prev, street: "" }));
      return;
    }
    setIsLocationLoading(true);
    fetch(`/api/locations/streets?city=${encodeURIComponent(formData.city)}&district=${encodeURIComponent(formData.district)}&neighborhood=${encodeURIComponent(formData.neighborhood)}`)
      .then((res) => res.ok ? res.json() : [])
      .then((data) => {
        if (data?.length) {
          setStreets(data);
        } else {
          setStreets(FALLBACK_STREETS);
        }
      })
      .catch(() => setStreets(FALLBACK_STREETS))
      .finally(() => setIsLocationLoading(false));
  }, [formData.city, formData.district, formData.neighborhood]);

  // Telefon inputuna odaklanınca otomatik +90 ekle
  function handlePhoneFocus(e: React.FocusEvent<HTMLInputElement>) {
    if (!formData.phone.startsWith("+90 ")) {
      setFormData((prev) => ({ ...prev, phone: "+90 " }));
    }
  }

  // Apartman olmayan yerler için iç kapı no otomatik 0
  useEffect(() => {
    if (formData.neighborhood && /köy|ev/i.test(formData.neighborhood)) {
      setFormData((prev) => ({ ...prev, innerDoorNo: "0" }));
    }
  }, [formData.neighborhood]);

  // Kayıt submit
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsRegistering(true);
    
    try {
      let finalAvatarUrl = formData.avatarUrl;

      // Eğer kullanıcı fotoğraf seçtiyse önce Firebase Storage'a yükle
      if (selectedImage) {
        const fileExt = selectedImage.name.split('.').pop();
        const imageRef = ref(storage, `avatars/user_${Date.now()}.${fileExt}`);
        await uploadBytes(imageRef, selectedImage);
        finalAvatarUrl = await getDownloadURL(imageRef);
      }

      const res = await fetch(`/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, avatarUrl: finalAvatarUrl || "https://api.dicebear.com/7.x/avataaars/svg?seed=" + formData.firstName }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Kayıt sırasında bir hata oluştu.");
      }
      
      // Başarılı olursa kullanıcıyı yönlendir (Örn: / onay ekranı)
      window.location.href = "/";
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsRegistering(false);
    }
  }

  // SMS Kodu Gönderme
  async function handleSendCode() {
    setVerificationError("");
    setIsVerifying(true);
    try {
      const res = await fetch(`/api/auth/send-sms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: formData.phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Kod gönderilemedi, lütfen tekrar deneyin.");
      
      setIsCodeSent(true);
      setCountdown(60); // 60 saniyelik sayacı başlat

      // TEST ORTAMI: Kodu konsol yerine direkt ekranda göster
      if (data.code) {
        alert(`TEST ORTAMI BİLGİLENDİRMESİ\n\nSMS ile gelen Doğrulama Kodunuz: ${data.code}\n\n(Gerçek bir uygulamada bu size SMS olarak gelirdi)`);
      }
    } catch (err: any) {
      setVerificationError(err.message);
    } finally {
      setIsVerifying(false);
    }
  }

  // SMS Kodu Doğrulama
  async function handleVerifyCode() {
    setVerificationError("");
    setIsVerifying(true);
    try {
      const res = await fetch(`/api/auth/verify-sms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: formData.phone, code: verificationCode }),
      });
      if (!res.ok) throw new Error("Doğrulama kodu yanlış veya süresi dolmuş.");
      setPhoneVerified(true); // Başarılı!
    } catch (err: any) {
      setVerificationError(err.message);
    } finally {
      setIsVerifying(false);
    }
  }

  // JSX


  return (
    <MobileContainer showNav={false}>
      <div className="min-h-full flex flex-col p-6 animate-slide-up bg-white">
        <Link href="/login" className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 mb-6 hover:bg-gray-200 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        
        <h1 className="text-3xl font-bold text-foreground mb-2">Kayıt Ol</h1>
        <p className="text-muted-foreground mb-8">Komşularına katılmak için bilgilerini doldur.</p>

        {!phoneVerified ? (
          <div className="space-y-6 animate-fade-in">
            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
              <h3 className="font-bold text-blue-800 mb-1">Adım 1: Telefon Doğrulama</h3>
              <p className="text-sm text-blue-600">Güvenli bir topluluk için öncelikle telefon numaranızı doğrulamanız gerekmektedir.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase ml-1">Telefon (+90...)</label>
              <input
                name="phone"
                value={formData.phone}
                onChange={handlePhoneChange}
                onFocus={handlePhoneFocus}
                required
                placeholder="+90 5XX XXX XX XX"
                maxLength={17}
                inputMode="numeric"
                type="tel"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                disabled={isCodeSent}
              />
            </div>
            
            {!isCodeSent ? (
              <button onClick={handleSendCode} disabled={isVerifying || formData.phone.replace(/\D/g, "").length < 12} className="w-full py-4 bg-primary text-white font-bold rounded-2xl disabled:opacity-50 flex items-center justify-center">
                {isVerifying ? <Loader2 className="w-5 h-5 animate-spin" /> : "Doğrulama Kodu Gönder"}
              </button>
            ) : (
              <div className="space-y-3 p-4 bg-gray-50 rounded-2xl border border-gray-200 mt-4">
                <p className="text-sm text-center text-muted-foreground font-medium">Telefonunuza gönderilen 6 haneli kodu girin.</p>
                <input value={verificationCode} onChange={e => setVerificationCode(e.target.value)} maxLength={6} placeholder="XXXXXX" inputMode="numeric" className="w-full text-center tracking-[0.5em] text-2xl font-bold px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20" />
                <button onClick={handleVerifyCode} disabled={isVerifying || verificationCode.length < 6} className="w-full py-4 bg-green-600 text-white font-bold rounded-2xl disabled:opacity-50 flex items-center justify-center shadow-lg shadow-green-500/30 mt-2">
                  {isVerifying ? <Loader2 className="w-5 h-5 animate-spin" /> : "Telefonu Doğrula"}
                </button>
                
                {/* Sayaç ve Tekrar Gönder Alanı */}
                <div className="text-center mt-4 pt-3 border-t border-gray-200/60">
                  {countdown > 0 ? (
                    <p className="text-xs text-gray-500 font-medium">Yeni kod için kalan süre: <span className="font-bold text-primary">{countdown}s</span></p>
                  ) : (
                    <button onClick={handleSendCode} disabled={isVerifying} className="text-xs font-bold text-primary hover:underline hover:text-primary/80 transition-colors">
                      Kodu Tekrar Gönder
                    </button>
                  )}
                </div>
              </div>
            )}
            {verificationError && <p className="text-red-500 text-sm text-center font-medium mt-2">{verificationError}</p>}
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-4 pb-12 animate-fade-in">
          <div className="p-3 bg-green-50 rounded-xl border border-green-100 flex items-center gap-3 mb-2">
            <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-green-800">Telefon Doğrulandı</h3>
              <p className="text-xs text-green-600">{formData.phone}</p>
            </div>
          </div>
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
            {/* DEBUG: districts ve ilce verisi */}
            <pre style={{fontSize:10, background:'#eee', color:'#333', marginTop:4, padding:4, borderRadius:4}}>
              districts: {JSON.stringify(districts, null, 2)}
            </pre>
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
            disabled={!phoneVerified || isRegistering}
            className="w-full py-4 mt-4 bg-secondary text-white font-bold rounded-2xl shadow-lg shadow-secondary/30 hover:-translate-y-0.5 transition-all disabled:opacity-70 flex items-center justify-center"
          >
            {isRegistering ? <Loader2 className="w-5 h-5 animate-spin" /> : "Hesap Oluştur"}
          </button>
        </form>
        )}
      </div>
    </MobileContainer>
  );
}

export default Register;
