import { MobileContainer } from "@/components/layout/MobileContainer";
import { usePendingUsers, useApproveUser } from "@/hooks/use-admin";
import { ArrowLeft, UserCheck, Clock } from "lucide-react";
import { Link } from "wouter";

export default function Approvals() {
  const { data: pendingUsers = [], isLoading } = usePendingUsers();
  const approveUser = useApproveUser();

  return (
    <MobileContainer showNav={false}>
      <div className="flex flex-col min-h-full bg-gray-50">
        <div className="bg-white px-4 pt-6 pb-4 border-b border-border flex items-center gap-3 sticky top-0 z-20">
          <Link href="/profile" className="p-2 bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-lg font-bold">Bekleyen Kayıtlar</h1>
        </div>

        <div className="p-4 space-y-4">
          {isLoading && (
            <div className="text-center py-10 text-gray-400">Yükleniyor...</div>
          )}

          {!isLoading && pendingUsers.length === 0 && (
            <div className="text-center py-16 flex flex-col items-center">
              <UserCheck className="w-16 h-16 text-gray-300 mb-4" />
              <h3 className="text-lg font-bold text-gray-500">Tümü Onaylandı</h3>
              <p className="text-sm text-gray-400 mt-1">Bekleyen hiçbir kullanıcı kaydı yok.</p>
            </div>
          )}

          {pendingUsers.map((pUser: any) => (
            <div key={pUser.id} className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-bold text-foreground">{pUser.firstName} {pUser.lastName}</h3>
                  <p className="text-xs text-gray-500">{pUser.phone}</p>
                </div>
                <div className="bg-orange-100 text-orange-600 p-1.5 rounded-lg">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xs text-muted-foreground mb-4">
                <strong>E-posta:</strong> {pUser.email}
              </div>
              <button
                onClick={() => approveUser.mutate(pUser.id)}
                disabled={approveUser.isPending}
                className="w-full py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl shadow-md transition-colors disabled:opacity-50"
              >
                Onayla ve Binaya Ekle
              </button>
            </div>
          ))}
        </div>
      </div>
    </MobileContainer>
  );
}
