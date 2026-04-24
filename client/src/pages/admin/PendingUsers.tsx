import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { MobileContainer } from "@/components/layout/MobileContainer";
import { Check, Loader2, UserCheck } from "lucide-react";

export default function PendingUsers() {
  const queryClient = useQueryClient();

  // Backend'den onay bekleyen kullanıcıları çeker
  const { data: pendingUsers, isLoading } = useQuery({
    queryKey: ["/api/admin/pending-users"],
  });

  // Kullanıcıyı onaylama (Approve) isteği atar
  const approveMutation = useMutation({
    mutationFn: async (userId: string | number) => {
      await apiRequest("POST", `/api/admin/users/${userId}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-users"] });
    },
  });

  return (
    <MobileContainer showNav={true}>
      <div className="p-6 animate-fade-in bg-white min-h-full">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-primary/10 rounded-2xl">
            <UserCheck className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Onay Bekleyenler</h1>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : pendingUsers?.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            <p className="text-gray-500 font-medium">Şu an onay bekleyen komşu yok.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingUsers?.map((user: any) => (
              <div key={user.id} className="p-4 bg-white border border-gray-100 shadow-sm rounded-2xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-foreground">{user.firstName} {user.lastName}</div>
                  <div className="text-xs text-muted-foreground mt-1">Kapı No: {user.doorNo} | İç Kapı: {user.innerDoorNo}</div>
                </div>
                <button
                  onClick={() => approveMutation.mutate(user.id)}
                  disabled={approveMutation.isPending}
                  className="p-3 bg-green-100 text-green-600 rounded-xl hover:bg-green-200 transition-colors disabled:opacity-50 shadow-sm"
                >
                  {approveMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </MobileContainer>
  );
}