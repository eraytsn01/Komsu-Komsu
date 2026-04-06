import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";

export function usePendingUsers() {
  return useQuery({
    queryKey: [api.admin.pendingUsers.path],
    queryFn: async () => {
      const res = await fetch(api.admin.pendingUsers.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch pending users");
      return res.json();
    },
  });
}

export function useApproveUser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (userId: number) => {
      const url = buildUrl(api.admin.approveUser.path, { id: userId });
      const res = await fetch(url, {
        method: api.admin.approveUser.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to approve user");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.admin.pendingUsers.path] });
    },
  });
}
