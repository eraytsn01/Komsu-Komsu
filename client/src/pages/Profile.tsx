import { MobileContainer } from "@/components/layout/MobileContainer";
import { useAuth } from "@/hooks/use-auth";
import { LogOut, ShieldCheck, MapPin, User as UserIcon, Settings, ChevronRight } from "lucide-react";
import { Link } from "wouter";

export default function Profile() {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <MobileContainer>
      <div className="flex flex-col min-h-full pb-24 bg-gray-50">
        
        {/* Profile Header */}
        <div className="bg-white pt-12 pb-8 px-6 flex flex-col items-center rounded-b-[2.5rem] shadow-sm relative z-10">
          <div className="w-24 h-24 rounded-full bg-primary/10 border-4 border-white shadow-lg flex items-center justify-center text-primary mb-4 relative">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="Profil" className="w-full h-full object-cover rounded-full" />
            ) : (
              <UserIcon className="w-10 h-10" />
            )}
            {user.isAdmin && (
              <div className="absolute -bottom-2 -right-2 bg-secondary text-white p-1.5 rounded-full shadow-md">
                <ShieldCheck className="w-4 h-4" />
              </div>
            )}
          </div>
          <h1 className="text-xl font-bold text-foreground">
            {user.firstName} {user.lastName}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{user.email}</p>
          <div className="mt-4 inline-flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-full text-xs font-semibold text-gray-600">
            <MapPin className="w-3.5 h-3.5" />
            {user.locationCode}
          </div>
        </div>

        {/* Menu Items */}
        <div className="px-4 mt-6 space-y-3">
          
          {user.isAdmin && (
            <Link href="/admin/approvals" className="block">
              <div className="bg-white p-4 rounded-2xl shadow-sm flex items-center justify-between border border-primary/20 hover:border-primary/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-foreground">Yönetici Paneli</h3>
                    <p className="text-[10px] text-muted-foreground">Bekleyen kayıtları onayla</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300" />
              </div>
            </Link>
          )}

          <Link href="/settings/notifications" className="block">
            <div className="bg-white p-4 rounded-2xl shadow-sm flex items-center justify-between border border-gray-100 hover:border-primary/40 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-gray-500">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-foreground">Bildirim Ayarları</h3>
                  <p className="text-[10px] text-muted-foreground">Mesaj, acil durum ve duyuru sesleri</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300" />
            </div>
          </Link>

          <button 
            onClick={() => logout()}
            className="w-full bg-white p-4 rounded-2xl shadow-sm flex items-center justify-between border border-red-50 hover:bg-red-50/50 transition-colors mt-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center text-red-500">
                <LogOut className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-red-600">Çıkış Yap</h3>
            </div>
          </button>
          
          {/* Ad Banner Space */}
          <div className="mt-8 mb-4">
            <div className="w-full aspect-[4/1] bg-gray-100 rounded-2xl flex items-center justify-center text-gray-400 text-xs border border-dashed border-gray-300">
              Reklam Alanı
            </div>
          </div>
          
        </div>
      </div>
    </MobileContainer>
  );
}
