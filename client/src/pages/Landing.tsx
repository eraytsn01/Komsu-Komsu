import React from "react";

export default function Landing() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}>
      <h1 style={{ fontSize: 36, fontWeight: 900, color: "#2563eb", marginBottom: 16 }}>Komşu Komşu Yayında!</h1>
      <p style={{ fontSize: 18, marginBottom: 24, color: "#22223b" }}>
        Mahallendeki yardımlaşmaya katılmak için hemen indir.
      </p>
      <a href="/app-debug.apk" download="KomsuKomsu.apk">
        <button style={{ background: "#2563eb", color: "white", padding: "18px 40px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 22, fontWeight: 800, marginBottom: 18, boxShadow: "0 2px 8px #2563eb22" }}>
          Android APK İndir
        </button>
      </a>
      <div style={{ marginTop: 10, color: '#b91c1c', fontSize: 15, fontWeight: 600, textAlign: 'center' }}>
        Not: Android telefonlar Play Store dışı indirmelerde uyarı verebilir.<br />
        "Uygulamamız güvenlidir, kurulum için bilinmeyen kaynaklara izin veriniz."
      </div>
    </div>
  );
}
