import { useState, useEffect } from "react";
import { Mic, MicOff, Video, VideoOff, Phone, PhoneOff, Volume2, Users, UserPlus } from "lucide-react";
import { clsx } from "clsx";

type CallType = "voice" | "video" | "group-voice" | "group-video";

interface CallModalProps {
  type: CallType;
  targetName: string;
  targetAvatar?: string | null;
  groupMembers?: { id: number; firstName: string; lastName: string; avatarUrl?: string | null }[];
  onClose: () => void;
}

export function CallModal({ type, targetName, targetAvatar, groupMembers = [], onClose }: CallModalProps) {
  const [callState, setCallState] = useState<"ringing" | "connected" | "ended">("ringing");
  const [elapsed, setElapsed] = useState(0);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(type === "video" || type === "group-video");
  const [speakerOn, setSpeakerOn] = useState(true);

  const isVideo = type === "video" || type === "group-video";
  const isGroup = type === "group-voice" || type === "group-video";

  // Auto-connect after 2s (simulated)
  useEffect(() => {
    const t = setTimeout(() => setCallState("connected"), 2000);
    return () => clearTimeout(t);
  }, []);

  // Timer
  useEffect(() => {
    if (callState !== "connected") return;
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, [callState]);

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const handleHangup = () => {
    setCallState("ended");
    setTimeout(onClose, 800);
  };

  return (
    <div className="absolute inset-0 z-[100] flex flex-col overflow-hidden">
      {/* Background */}
      {isVideo ? (
        <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
          <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-950 flex items-center justify-center">
            {camOn ? (
              <div className="text-gray-600 text-xs">Kamera Önizlemesi</div>
            ) : (
              <VideoOff className="w-12 h-12 text-gray-600" />
            )}
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-primary/80 to-primary" />
      )}

      {/* Content */}
      <div className="relative flex flex-col h-full text-white p-6">
        {/* Top bar */}
        <div className="flex items-center justify-between mt-8">
          <div className="text-sm font-medium opacity-80">
            {isGroup ? "Grup Araması" : isVideo ? "Görüntülü Arama" : "Sesli Arama"}
          </div>
          {callState === "connected" && (
            <div className="text-sm font-mono bg-white/20 px-2 py-0.5 rounded-full">{fmt(elapsed)}</div>
          )}
        </div>

        {/* Center - Avatar / Group */}
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          {isGroup ? (
            <div className="flex flex-wrap justify-center gap-3 max-w-[200px]">
              {[{ firstName: "Sen", lastName: "", avatarUrl: null }, ...groupMembers].map((m, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div className={clsx(
                    "w-14 h-14 rounded-full border-2 overflow-hidden flex items-center justify-center text-white font-bold text-lg",
                    i === 0 ? "border-white bg-white/30" : "border-white/50 bg-white/20"
                  )}>
                    {m.avatarUrl ? (
                      <img src={m.avatarUrl} className="w-full h-full object-cover" />
                    ) : (
                      <span>{m.firstName[0]}</span>
                    )}
                  </div>
                  <span className="text-[9px] opacity-75 font-medium">{m.firstName}</span>
                </div>
              ))}
              <div className="w-14 h-14 rounded-full border-2 border-white/30 bg-white/10 flex items-center justify-center">
                <UserPlus className="w-5 h-5 opacity-60" />
              </div>
            </div>
          ) : (
            <div className="w-24 h-24 rounded-full border-4 border-white/60 overflow-hidden bg-white/20 flex items-center justify-center shadow-2xl">
              {targetAvatar ? (
                <img src={targetAvatar} className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl font-bold">{targetName[0]}</span>
              )}
            </div>
          )}

          <div className="text-center">
            <h2 className="text-xl font-bold">{targetName}</h2>
            <p className={clsx("text-sm mt-1 font-medium", callState === "connected" ? "text-green-300" : "text-white/70 animate-pulse")}>
              {callState === "ringing" ? "Çağrılıyor..." : callState === "connected" ? "Bağlandı" : "Arama Sonlandı"}
            </p>
          </div>

          {/* Small video pip */}
          {isVideo && callState === "connected" && (
            <div className="absolute top-24 right-5 w-20 h-28 rounded-xl border-2 border-white/50 overflow-hidden bg-gray-800 shadow-lg flex items-center justify-center">
              <span className="text-gray-600 text-[8px]">Sen</span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="pb-8">
          {/* Secondary controls */}
          <div className="flex justify-center gap-5 mb-6">
            <button
              onClick={() => setMicOn(v => !v)}
              className={clsx("w-12 h-12 rounded-full flex items-center justify-center transition-all", micOn ? "bg-white/20" : "bg-red-500")}
            >
              {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>

            {isVideo && (
              <button
                onClick={() => setCamOn(v => !v)}
                className={clsx("w-12 h-12 rounded-full flex items-center justify-center transition-all", camOn ? "bg-white/20" : "bg-red-500")}
              >
                {camOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </button>
            )}

            <button
              onClick={() => setSpeakerOn(v => !v)}
              className={clsx("w-12 h-12 rounded-full flex items-center justify-center transition-all", speakerOn ? "bg-white/20" : "bg-white/10")}
            >
              <Volume2 className="w-5 h-5" />
            </button>

            {isGroup && (
              <button className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Hang up */}
          <div className="flex justify-center">
            <button
              onClick={handleHangup}
              className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 active:scale-95 transition-all"
            >
              <PhoneOff className="w-7 h-7 text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
