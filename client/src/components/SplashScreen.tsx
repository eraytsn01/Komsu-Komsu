import React from "react";

export default function SplashScreen() {
  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-white">
      <img src="/logo192.png" alt="Uygulama Logo" className="w-32 h-32 mb-6 animate-bounce" />
      <div className="text-xl font-bold text-primary">Yükleniyor...</div>
    </div>
  );
}
