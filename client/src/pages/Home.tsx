import { MobileContainer } from "@/components/layout/MobileContainer";
import { Download, Smartphone, ShieldCheck, Users, LogIn } from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  return (
    <MobileContainer>
      <div className="flex flex-col min-h-screen bg-white">
        {/* Hero Bölümü (Giriş) */}
        <div className="bg-gradient-to-b from-violet-600 to-indigo-700 px-6 pt-16 pb-20 rounded-b-[3rem] text-center text-white shadow-xl">
          <div className="w-20 h-20 bg-white/20 rounded-3xl flex items-center justify-center mx-auto mb-6 backdrop-blur-sm border border-white/30">
            <Users className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-extrabold mb-4 tracking-tight">Komşu Komşu</h1>
          <p className="text-violet-100 text-lg opacity-90 mb-8 leading-relaxed">
            Mahallendeki yardımlaşmanın dijital hali. Artık komşularınla bir tıkla iletişimdesin!
          </p>
          {/* O meşhur İndir Butonu */}
        <div className="flex flex-col gap-3">
          <a 
            href="/app-debug.apk" 
            download="KomsuKomsu.apk"
            className="inline-flex items-center justify-center gap-3 bg-white text-indigo-700 px-8 py-4 rounded-2xl font-bold text-lg shadow-2xl hover:bg-indigo-50 transition-all active:scale-95"
          >
            <Download className="w-6 h-6" />
            Uygulamayı İndir
          </a>
          <Link 
            href="/login" 
            className="inline-flex items-center justify-center gap-2 bg-indigo-800/40 text-white border border-white/20 px-8 py-4 rounded-2xl font-bold text-sm hover:bg-indigo-800/60 transition-all active:scale-95"
          >
            <LogIn className="w-5 h-5" />
            Web'den Giriş Yap
          </Link>
        </div>
        </div>

        {/* Özellikler Bölümü */}
        <div className="px-6 -mt-10 space-y-4 pb-20">
          <div className="bg-white p-6 rounded-3xl shadow-lg border border-gray-100 flex items-start gap-4">
            <div className="p-3 bg-blue-100 rounded-2xl text-blue-600">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800">Güvenli Topluluk</h3>
              <p className="text-sm text-gray-500">Sadece gerçek komşularınızla iletişim kurun.</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-lg border border-gray-100 flex items-start gap-4">
            <div className="p-3 bg-green-100 rounded-2xl text-green-600">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800">Hızlı Durum Paylaşımı</h3>
              <p className="text-sm text-gray-500">Mahallenizde olup bitenleri anında görün.</p>
            </div>
          </div>
          {/* Güvenlik Notu */}
          <div className="text-center p-6 mt-4">
             <p className="text-xs text-gray-400 italic">
               * Uygulamamız güvenlidir. Android kurulumunda "Bilinmeyen Kaynaklara İzin Ver" seçeneğini aktif etmeyi unutmayın.
             </p>
          </div>
        </div>
      </div>
    </MobileContainer>
  );
}
