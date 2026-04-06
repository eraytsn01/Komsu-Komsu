import { MobileContainer } from "@/components/layout/MobileContainer";
import { useAuth } from "@/hooks/use-auth";
import { Hourglass, LogOut } from "lucide-react";

export default function PendingApproval() {
  const { logout } = useAuth();

  return (
    <MobileContainer showNav={false}>
      <div className="min-h-full flex flex-col items-center justify-center p-8 text-center bg-white">
        <div className="w-24 h-24 bg-secondary/10 rounded-[2rem] flex items-center justify-center mb-8 shadow-inner animate-pulse">
          <Hourglass className="w-10 h-10 text-secondary" />
        </div>
        
        <h1 className="text-2xl font-bold text-foreground mb-4">Onay Bekleniyor</h1>
        <p className="text-muted-foreground leading-relaxed mb-12">
          Apartman yöneticiniz henüz hesabınızı onaylamadı. Lütfen onaylanana kadar bekleyin veya yöneticinizle iletişime geçin.
        </p>

        <button 
          onClick={() => logout()}
          className="px-6 py-3 flex items-center gap-2 text-sm font-semibold text-gray-600 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Çıkış Yap
        </button>
      </div>
    </MobileContainer>
  );
}
