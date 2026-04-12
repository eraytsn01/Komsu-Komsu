import { useEffect, useState } from "react";

export default function PendingStreets() {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPending = async () => {
    setLoading(true);
    const res = await fetch((import.meta.env.VITE_API_BASE_URL || "") + "/api/streets/pending-list");
    const data = await res.json();
    setPending(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleApprove = async (id: string) => {
    await fetch((import.meta.env.VITE_API_BASE_URL || "") + `/api/streets/pending-approve/${id}`, { method: "POST" });
    fetchPending();
  };
  const handleReject = async (id: string) => {
    await fetch((import.meta.env.VITE_API_BASE_URL || "") + `/api/streets/pending-reject/${id}`, { method: "POST" });
    fetchPending();
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Onay Bekleyen Sokak/Cadde/Bulvarlar</h1>
      {loading ? (
        <div>Yükleniyor...</div>
      ) : pending.length === 0 ? (
        <div>Onay bekleyen kayıt yok.</div>
      ) : (
        <ul className="space-y-4">
          {pending.map((item: any) => (
            <li key={item.id} className="border rounded-xl p-4 flex flex-col gap-2">
              <div><b>İl:</b> {item.city}</div>
              <div><b>İlçe:</b> {item.district}</div>
              <div><b>Mahalle:</b> {item.neighborhood}</div>
              <div><b>Ad:</b> {item.street}</div>
              <div><b>Tür:</b> {item.type}</div>
              <div className="flex gap-2 mt-2">
                <button onClick={() => handleApprove(item.id)} className="px-3 py-1 bg-green-500 text-white rounded">Onayla</button>
                <button onClick={() => handleReject(item.id)} className="px-3 py-1 bg-red-500 text-white rounded">Reddet</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
