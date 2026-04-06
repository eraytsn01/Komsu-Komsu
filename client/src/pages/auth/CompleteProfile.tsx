import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { MobileContainer } from "@/components/layout/MobileContainer";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload } from "lucide-react";

const PROFILE_IMAGES = [
  "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=128&h=128&fit=crop",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=128&h=128&fit=crop",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=128&h=128&fit=crop",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=128&h=128&fit=crop",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=128&h=128&fit=crop",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=128&h=128&fit=crop",
];

export default function CompleteProfile() {
  const { user, updateProfile } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedImage, setSelectedImage] = useState(PROFILE_IMAGES[0]);
  const [customUrl, setCustomUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [useCustom, setUseCustom] = useState(false);

  if (!user || user.avatarUrl) {
    // If user already has avatar or not logged in, redirect
    setLocation("/");
    return null;
  }

  const handleSubmit = async () => {
    if (!selectedImage && !customUrl) {
      toast({ title: "Bir fotoğraf seçiniz", variant: "destructive" });
      return;
    }

    const avatarUrl = useCustom ? customUrl : selectedImage;
    setIsSubmitting(true);

    try {
      await updateProfile({ avatarUrl });
      toast({ title: "Profil başarıyla tamamlandı!" });
      setLocation("/");
    } catch (err: any) {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <MobileContainer showNav={false}>
      <div className="min-h-full flex flex-col p-6 bg-white">
        <h1 className="text-3xl font-bold text-foreground mb-2">Profilini Tamamla</h1>
        <p className="text-muted-foreground mb-8">Bir profil fotoğrafı seç veya URL'den yükle.</p>

        {/* Preview */}
        <div className="w-32 h-32 rounded-full border-4 border-primary mx-auto mb-8 overflow-hidden bg-gray-100">
          <img 
            src={useCustom ? customUrl : selectedImage} 
            alt="Preview" 
            className="w-full h-full object-cover"
            onError={() => setUseCustom(false)}
          />
        </div>

        {/* Preset Options */}
        <div className="mb-8">
          <h2 className="font-bold text-sm mb-4 text-gray-700">Hazır Fotoğraflar</h2>
          <div className="grid grid-cols-3 gap-4">
            {PROFILE_IMAGES.map((img) => (
              <button
                key={img}
                onClick={() => {
                  setSelectedImage(img);
                  setUseCustom(false);
                }}
                className={`w-full aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                  selectedImage === img && !useCustom ? "border-primary" : "border-gray-200"
                }`}
              >
                <img src={img} alt="Option" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        {/* Custom URL */}
        <div className="mb-8">
          <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Ya da Kendi Fotoğrafını Yapıştır</label>
          <input
            value={customUrl}
            onChange={(e) => {
              setCustomUrl(e.target.value);
              setUseCustom(true);
            }}
            placeholder="https://..."
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full py-4 bg-secondary text-white font-bold rounded-2xl shadow-lg shadow-secondary/30 hover:-translate-y-0.5 transition-all disabled:opacity-70 flex items-center justify-center mt-auto"
        >
          {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <>
            <Upload className="w-5 h-5 mr-2" />
            Profili Tamamla
          </>}
        </button>
      </div>
    </MobileContainer>
  );
}
