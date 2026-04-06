import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, XCircle, CheckCircle, ChevronsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { EmergencyAlert, User } from "@shared/schema";
import { clsx } from "clsx";

const DRAWER_HEIGHT = 160;

export function EmergencyButton() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [pullDistance, setPullDistance] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [screenHeight, setScreenHeight] = useState(typeof window !== "undefined" ? window.innerHeight : 800);
  const startYRef = useRef(0);
  const drawerRef = useRef<HTMLDivElement>(null);
  const activatingRef = useRef(false);
  const draggingRef = useRef(false);

  const { data: alerts } = useQuery<(EmergencyAlert & { user: User })[]>({
    queryKey: ["/api/emergency"],
    refetchInterval: 5000,
  });

  const hasOwnActiveAlert = !!alerts?.some((a) => a.userId === user?.id);

  const activationThreshold = useMemo(() => Math.max(170, Math.min(screenHeight / 2 - 118, 280)), [screenHeight]);

  useEffect(() => {
    const handleResize = () => setScreenHeight(window.innerHeight);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const resetDrawer = () => {
    draggingRef.current = false;
    setDragging(false);
    setPullDistance(0);
  };

  const handleTrigger = async () => {
    if (activatingRef.current) return;
    if (hasOwnActiveAlert) {
      toast({
        title: "Bilgi",
        description: "Zaten aktif bir acil durum kaydınız var. Çözülmeden tekrar gönderemezsiniz.",
      });
      resetDrawer();
      return;
    }

    activatingRef.current = true;
    try {
      const res = await apiRequest("POST", "/api/emergency");
      const data = await res.json();
      if (data?.alreadyActive) {
        toast({
          title: "Bilgi",
          description: "Zaten aktif bir acil durum kaydınız var. Çözülmesini bekleyin.",
        });
      } else {
        toast({
          title: "🚨 ACİL DURUM",
          description: "Acil durum sinyali çevredeki komşularınıza gönderildi.",
          variant: "destructive",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/emergency"] });
    } catch {
      toast({ title: "Hata", description: "Acil durum sinyali gönderilemedi.", variant: "destructive" });
    } finally {
      activatingRef.current = false;
      resetDrawer();
    }
  };

  const handleResolve = async (id: number, status: "resolved" | "false_alarm") => {
    try {
      await apiRequest("POST", `/api/emergency/${id}/resolve`, { status });
      toast({
        title: "Bilgi",
        description: status === "resolved" ? "Acil durum çözüldü." : "Acil durum mesajı geri çekildi.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/emergency"] });
    } catch {
      toast({ title: "Hata", description: "İşlem gerçekleştirilemedi.", variant: "destructive" });
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    startYRef.current = e.clientY;
    draggingRef.current = true;
    setDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const delta = Math.max(0, startYRef.current - e.clientY);
    setPullDistance(Math.min(delta, activationThreshold + 36));
  };

  const handlePointerUp = async () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    if (pullDistance >= activationThreshold) {
      await handleTrigger();
      return;
    }
    resetDrawer();
  };

  const progress = Math.min((pullDistance / activationThreshold) * 100, 100);
  const reachedThreshold = progress >= 100;

  return (
    <>
      {/* Acil durum uyarı bantları */}
      {alerts && alerts.length > 0 && (
        <div className="absolute top-10 left-0 right-0 z-50 px-3 flex flex-col gap-2 pointer-events-auto">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="bg-destructive text-destructive-foreground p-3 rounded-2xl shadow-xl border-2 border-white animate-pulse"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold text-xs">ACİL DURUM BİLDİRİMİ</p>
                  <p className="text-[10px] opacity-90">
                    {alert.user.firstName} {alert.user.lastName} yardıma ihtiyacı var!
                  </p>
                  {user?.isAdmin && (
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="secondary" className="h-7 text-[9px] flex-1"
                        onClick={() => handleResolve(alert.id, "resolved")}>
                        <CheckCircle className="w-3 h-3 mr-1" /> Çözüldü
                      </Button>
                      <Button size="sm" variant="secondary" className="h-7 text-[9px] flex-1"
                        onClick={() => handleResolve(alert.id, "false_alarm")}>
                        <XCircle className="w-3 h-3 mr-1" /> Geri Çek
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sol alt çekmece tipi acil durum tetikleyici */}
      <div
        ref={drawerRef}
        className="absolute left-0 bottom-24 z-40 pointer-events-none"
      >
        <div
          className="pointer-events-auto touch-none"
          style={{ transform: `translateY(-${pullDistance}px)` }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div
            className={clsx(
              "relative ml-0 flex h-32 w-9 items-center justify-center rounded-r-xl border-y border-r border-white/70 shadow-xl transition-all duration-150",
              reachedThreshold
                ? "bg-red-600 shadow-red-500/40"
                : hasOwnActiveAlert
                ? "bg-amber-500 shadow-amber-400/40"
                : "bg-gradient-to-b from-red-500 to-red-700 shadow-red-500/30",
              dragging && "scale-[1.02]",
            )}
          >
            <div className="absolute inset-y-3 right-1 w-0.5 rounded-full bg-white/20" />
            <div className="flex flex-col items-center gap-1.5">
              <div className="rounded-full bg-white/15 p-0.5 shadow-sm">
                <ChevronsUp className="h-4 w-4 animate-pulse text-white" />
              </div>
              <AlertTriangle className="h-4 w-4 text-white" />
              <span className="text-[8.5px] font-black tracking-[0.16em] text-white [writing-mode:vertical-rl] rotate-180">
                ACİL DURUM
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
