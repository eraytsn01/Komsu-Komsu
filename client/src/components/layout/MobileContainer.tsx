import { ReactNode, TouchEvent, useRef } from "react";
import { useLocation } from "wouter";
import { BottomNav } from "./BottomNav";
import { EmergencyButton } from "../EmergencyButton";

import { useAuth } from "@/hooks/use-auth";

export function MobileContainer({ children, showNav = true }: { children: ReactNode; showNav?: boolean }) {
  const [location, setLocation] = useLocation();
  const gestureRef = useRef({ startX: 0, startY: 0, startAt: 0, tracking: false });
  const { user } = useAuth();
  const hideEmergencyOnRoutes = ["/login", "/register"];
  const showEmergencyButton = user && !hideEmergencyOnRoutes.includes(location);

  const tabRoutes = ["/", "/adverts", "/announcements", "/chat", "/profile"];

  const isInteractiveTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    return !!target.closest("input, textarea, select, [contenteditable='true'], [data-no-swipe='true']");
  };

  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    if (!showNav) return;
    if (isInteractiveTarget(e.target)) return;

    const t = e.touches[0];
    if (!t) return;

    gestureRef.current = {
      startX: t.clientX,
      startY: t.clientY,
      startAt: Date.now(),
      tracking: true,
    };
  };

  const handleTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    const g = gestureRef.current;
    gestureRef.current.tracking = false;

    if (!showNav || !g.tracking) return;

    const t = e.changedTouches[0];
    if (!t) return;

    const elapsed = Date.now() - g.startAt;
    const dx = t.clientX - g.startX;
    const dy = t.clientY - g.startY;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    // Yatay, hızlı ve anlamlı bir kaydırma olmalı
    if (elapsed > 700) return;
    if (absX < 55) return;
    if (absX <= absY * 1.15) return;

    const currentIndex = tabRoutes.indexOf(location);
    if (currentIndex === -1) return;

    if (dx < 0 && currentIndex < tabRoutes.length - 1) {
      setLocation(tabRoutes[currentIndex + 1]);
      return;
    }

    if (dx > 0 && currentIndex > 0) {
      setLocation(tabRoutes[currentIndex - 1]);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 sm:py-8 flex items-center justify-center font-sans selection:bg-primary/20">
      <div className="w-full h-screen sm:h-[850px] sm:max-w-[400px] bg-background sm:rounded-[2.5rem] sm:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] overflow-hidden relative flex flex-col sm:border-8 border-gray-900 ring-1 ring-border/50">
        {/* Dynamic Island / Notch illusion on desktop simulator */}
        <div className="hidden sm:block absolute top-0 inset-x-0 h-7 bg-gray-900 rounded-b-3xl w-40 mx-auto z-50"></div>
        {/* Main scrollable content area */}
        <div
          className="flex-1 overflow-y-auto hide-scrollbar relative bg-slate-50/50 flex flex-col"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="flex-1">
            {children}
          </div>
        </div>
        {showEmergencyButton && <EmergencyButton />}
        {/* Alt menü sadece giriş yapan kullanıcıya gösterilsin */}
        {showNav && user && <BottomNav />}
      </div>
    </div>
  );
}
