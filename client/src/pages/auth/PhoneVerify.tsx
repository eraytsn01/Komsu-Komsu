import { useState } from "react";

export default function PhoneVerify({ phone, onVerified }: { phone: string; onVerified: () => void }) {
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const sendCode = async () => {
    setError("");
    // Firebase ile SMS gönderme endpointi
    const res = await fetch((import.meta.env.VITE_API_BASE_URL || "") + "/api/auth/send-sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    if (res.ok) setSent(true);
    else setError("Kod gönderilemedi");
  };

  const verifyCode = async () => {
    setError("");
    const res = await fetch((import.meta.env.VITE_API_BASE_URL || "") + "/api/auth/verify-sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, code }),
    });
    if (res.ok) onVerified();
    else setError("Kod yanlış veya süresi doldu");
  };

  return (
    <div className="p-6 flex flex-col gap-4">
      <h2 className="text-xl font-bold">Telefon Doğrulama</h2>
      <p className="text-gray-500">Telefonunuza gelen SMS kodunu girin.</p>
      <button onClick={sendCode} className="bg-primary text-white px-4 py-2 rounded">Kodu Gönder</button>
      {sent && (
        <>
          <input
            value={code}
            onChange={e => setCode(e.target.value)}
            maxLength={6}
            placeholder="6 haneli kod"
            className="border px-4 py-2 rounded"
          />
          <button onClick={verifyCode} className="bg-green-500 text-white px-4 py-2 rounded">Doğrula</button>
        </>
      )}
      {error && <div className="text-red-500">{error}</div>}
    </div>
  );
}
