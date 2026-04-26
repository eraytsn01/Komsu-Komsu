
import { useState, useRef, useEffect } from "react";
import { Paperclip, Smile, MapPin, Send, Plus } from "lucide-react";

export default function Chat() {
  const [messages, setMessages] = useState([
    { id: 1, fromMe: false, text: "Merhaba! Size nasıl yardımcı olabilirim?", time: "09:30" },
    { id: 2, fromMe: true, text: "Merhaba, bir sorum olacaktı.", time: "09:31" },
    { id: 3, fromMe: false, text: "Tabii, buyurun.", time: "09:32" },
  ]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setMessages([...messages, { id: Date.now(), fromMe: true, text: input, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]);
    setInput("");
  };

  return (
    <MobileContainer>
      <div className="flex flex-col bg-white min-h-full h-full">
        {/* Üst bar */}
        <div className="sticky top-0 z-10 bg-sky-500 px-4 pt-8 pb-3 flex items-center gap-3 shadow-md">
          <div className="w-10 h-10 rounded-full bg-white/30 flex items-center justify-center font-bold text-lg text-white">A</div>
          <div className="flex-1">
            <div className="font-bold text-white text-base">Ahmet Yılmaz</div>
            <div className="text-xs text-white/80">Çevrimiçi</div>
          </div>
          <button className="p-2 text-white/80 hover:text-white"><Plus className="w-5 h-5" /></button>
        </div>

        {/* Mesajlar alanı */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-2 bg-gray-50">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.fromMe ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] px-4 py-2 rounded-2xl shadow-sm text-sm ${msg.fromMe ? "bg-sky-500 text-white rounded-br-md" : "bg-white text-gray-900 rounded-bl-md"}`}>
                {msg.text}
                <div className="text-[10px] text-right mt-1 opacity-60">{msg.time}</div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Mesaj yazma alanı */}
        <form onSubmit={handleSend} className="sticky bottom-0 z-20 bg-white p-3 flex items-center gap-2 border-t">
          <button type="button" className="p-2 text-sky-500"><Paperclip className="w-5 h-5" /></button>
          <button type="button" className="p-2 text-sky-500"><Smile className="w-5 h-5" /></button>
          <input
            className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm outline-none border-none"
            placeholder="Mesaj yaz..."
            value={input}
            onChange={e => setInput(e.target.value)}
          />
          <button type="button" className="p-2 text-sky-500"><MapPin className="w-5 h-5" /></button>
          <button type="submit" className="p-2 bg-sky-500 rounded-full text-white hover:bg-sky-600 transition"><Send className="w-5 h-5" /></button>
        </form>

        {/* Sabit + butonu (FAB) */}
        <button
          className="fixed bottom-20 right-6 w-14 h-14 bg-sky-500 text-white rounded-full shadow-xl flex items-center justify-center hover:-translate-y-1 active:scale-95 transition-all z-30"
          aria-label="Yeni sohbet başlat"
        >
          <Plus className="w-7 h-7" />
        </button>
      </div>
    </MobileContainer>
  );
}
import { useState, useRef, useEffect } from "react";
import { MobileContainer } from "@/components/layout/MobileContainer";
import {
  useMessages, useSendMessage, useNearbyUsers, useSearchUsers,
  useBuildingMessages, useSendBuildingMessage,
} from "@/hooks/use-features";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import {
  Send, Paperclip, MapPin, Video, Phone, MoreVertical, Search,
  ShieldAlert, UserX, Image as ImageIcon, MessageCircle, ChevronRight,
  Hash, Users, UserPlus, Mic, MicOff, VideoOff, PhoneOff, Volume2, Plus,
  User as UserIcon,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { clsx } from "clsx";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
  let content;
  if (selectedUser) {
    content = <PrivateChatView selectedUser={selectedUser} onBack={() => setSelectedUser(null)} onStartCall={(t, u) => setActiveCall({ type: t, targetName: `${u.firstName} ${u.lastName}`, targetAvatar: u.avatarUrl, targetId: u.id })} />;
  } else if (showGroupChat) {
    content = <GroupChatView onBack={() => setShowGroupChat(false)} nearbyUsers={neighbors} onStartCall={(t) => setActiveCall({ type: t, targetName: "Bina Grup Araması", groupMembers: neighbors })} />;
  } else {
    content = (
      <div className="flex flex-col bg-white min-h-full pb-16">
        {/* Header */}
        <div className="bg-sky-500 px-6 pt-10 pb-4 rounded-b-[2rem] shadow-md relative overflow-hidden">
          <div className="absolute -right-8 -bottom-6 w-36 h-36 bg-white/10 rounded-full" />
          <div className="absolute right-10 -top-6 w-20 h-20 bg-white/10 rounded-full blur-xl" />
          <div className="flex items-center justify-between relative z-10">
            <h1 className="text-2xl font-extrabold text-white">Mesajlar</h1>
            <button className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
              <Phone className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
        {/* ...diğer sekmeler ve içerik... */}
        <div className="flex-1 overflow-y-auto">
          {/* CONVERSATIONS, NEARBY, SEARCH sekmeleri burada olacak */}
          {/* ...existing code... */}
        </div>
        {/* FAB */}
        <button
          onClick={handleStartNewChat}
          className="fixed bottom-6 right-6 w-14 h-14 bg-sky-500 text-white rounded-2xl shadow-xl shadow-sky-400/50 flex items-center justify-center hover:-translate-y-1 active:scale-95 transition-all z-30"
          aria-label="Yeni sohbet aç"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>
    );
  }
          }

          const peer = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:global.stun.twilio.com:3478" }]
          });
          peerRef.current = peer;

          s.getTracks().forEach(track => peer.addTrack(track, s));

          peer.ontrack = (event) => {
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
          };

          peer.onicecandidate = (event) => {
            if (event.candidate) {
              socket.emit("iceCandidate", { to: targetId, candidate: event.candidate });
            }
          };

          socket.on("callAccepted", (signal) => {
            peer.setRemoteDescription(new RTCSessionDescription(signal));
            setState("connected");
          });

          socket.on("iceCandidate", (candidate) => {
            peer.addIceCandidate(new RTCIceCandidate(candidate));
          });

          if (isReceiving) {
            peer.setRemoteDescription(new RTCSessionDescription(callerSignal)).then(() => {
              peer.createAnswer().then(answer => {
                peer.setLocalDescription(answer);
                socket.emit("answerCall", { to: targetId, signal: answer });
                setState("connected");
              });
            });
          } else {
            peer.createOffer().then(offer => {
              peer.setLocalDescription(offer);
              socket.emit("callUser", { userToCall: targetId, signalData: offer, from: user?.id, name: `${user?.firstName} ${user?.lastName}`, avatar: user?.avatarUrl, type });
            });
          }
        })
        .catch(err => console.log("Medya izni alınamadı:", err));
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
      if (peerRef.current) peerRef.current.close();
      socket.off("callAccepted");
      socket.off("iceCandidate");
    };
  }, [isVideo, camOn]);

  useEffect(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach(t => t.enabled = micOn);
      localStream.getVideoTracks().forEach(t => t.enabled = camOn);
    }
  }, [micOn, camOn, localStream]);

  useEffect(() => {
    if (state !== "connected") return;
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, [state]);

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const hangup = () => {
    setState("ended");
    if (targetId && !isGroup) socket.emit("endCall", { to: targetId });
    setTimeout(onClose, 700);
  };

  useEffect(() => {
    const handleEnd = () => hangup();
    socket.on("callEnded", handleEnd);
    return () => { socket.off("callEnded", handleEnd); };
  }, [onClose]);

  return (
    <div className="absolute inset-0 z-[100] flex flex-col select-none">
      {/* BG */}
      {isVideo ? (
        <div className="absolute inset-0 bg-gray-950 flex items-center justify-center overflow-hidden">
          {state === "connected" ? (
            <div className="w-full h-full relative">
              <img src={targetAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${targetName}`} className="w-full h-full object-cover blur-xl opacity-40 scale-110" />
              <video autoPlay playsInline muted={!speakerOn} ref={remoteVideoRef} className="w-full h-full object-cover" />
            </div>
          ) : camOn ? (
            <div className="text-gray-700 text-xs animate-pulse">Kamera bağlanıyor...</div>
          ) : (
            <VideoOff className="w-12 h-12 text-gray-700" />
          )}
        </div>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-primary to-primary/80" />
      )}

      <div className="relative flex flex-col h-full text-white px-5 py-6">
        {/* Top */}
        <div className="flex items-center justify-between mt-8">
            <span className="text-xs font-semibold opacity-80 bg-white/15 px-3 py-1 rounded-full">
            {isGroup ? "Grup Araması" : isVideo ? "Görüntülü Arama" : "Sesli Arama"}
          </span>
          {state === "connected" && (
            <span className="text-xs font-mono bg-white/20 px-2 py-1 rounded-full">{fmt(elapsed)}</span>
          )}
        </div>

        {/* Avatars */}
        <div className="flex-1 flex flex-col items-center justify-center gap-5">
          {isGroup ? (
            <div className="flex flex-wrap justify-center gap-3 max-w-[220px]">
              {[{ firstName: "Sen", lastName: "", avatarUrl: null }, ...groupMembers].map((m, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div className={clsx(
                    "w-14 h-14 rounded-full border-2 overflow-hidden flex items-center justify-center font-bold text-xl",
                    i === 0 ? "border-white bg-white/25" : "border-white/40 bg-white/15"
                  )}>
                    {m.avatarUrl
                      ? <img src={m.avatarUrl} className="w-full h-full object-cover" />
                      : <span>{m.firstName[0]}</span>}
                  </div>
                  <span className="text-[9px] opacity-70">{m.firstName}</span>
                </div>
              ))}
              <div className="w-14 h-14 rounded-full border-2 border-dashed border-white/30 flex items-center justify-center opacity-50">
                <UserPlus className="w-5 h-5" />
              </div>
            </div>
          ) : (
            <div className="w-24 h-24 rounded-full border-4 border-white/50 overflow-hidden bg-white/20 flex items-center justify-center shadow-2xl">
              <img src={targetAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${targetName}`} className="w-full h-full object-cover" />
            </div>
          )}

          <div className="text-center">
            <h2 className="text-xl font-bold">{targetName}</h2>
            <p className={clsx("text-sm mt-1", state === "connected" ? "text-green-300 font-medium" : "opacity-70 animate-pulse")}>
              {state === "ringing" ? "Çağrılıyor..." : state === "connected" ? "Bağlandı" : "Sonlandırıldı"}
            </p>
          </div>

          {/* PiP */}
          {isVideo && state === "connected" && (
            <div className="absolute top-20 right-4 w-28 h-40 rounded-2xl border-2 border-white/20 bg-gray-800 shadow-2xl flex items-center justify-center overflow-hidden z-50">
              {camOn && localStream ? (
                <video
                  autoPlay
                  playsInline
                  muted
                  ref={(node) => { if (node && node.srcObject !== localStream) node.srcObject = localStream; }}
                  className="w-full h-full object-cover transform scale-x-[-1]"
                />
              ) : (
                <span className="text-gray-500 text-xs font-medium">Sen</span>
              )}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="pb-4 space-y-5">
          <div className="flex justify-center gap-4">
            <CtrlBtn active={micOn} onClick={() => setMicOn(v => !v)} redOff>
              {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </CtrlBtn>
            {isVideo && (
              <CtrlBtn active={camOn} onClick={() => setCamOn(v => !v)} redOff>
                {camOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </CtrlBtn>
            )}
            <CtrlBtn active={speakerOn} onClick={() => setSpeakerOn(v => !v)}>
              <Volume2 className="w-5 h-5" />
            </CtrlBtn>
            {isGroup && (
              <CtrlBtn active={true} onClick={() => {}}>
                <Users className="w-5 h-5" />
              </CtrlBtn>
            )}
          </div>
          <div className="flex justify-center">
            <button
              onClick={hangup}
              className="w-16 h-16 bg-red-500 hover:bg-red-600 active:scale-95 rounded-full flex items-center justify-center shadow-xl transition-all"
            >
              <PhoneOff className="w-7 h-7" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Group Chat View ───────────────────────────────────────────────────────────
function GroupChatView({ onBack, nearbyUsers, onStartCall }: { onBack: () => void; nearbyUsers: any[]; onStartCall: (type: "group-voice" | "group-video") => void }) {
  const { user } = useAuth();
  const { data: messages = [] } = useBuildingMessages();
  const sendMsg = useSendBuildingMessage();
  const [content, setContent] = useState("");
  const [call, setCall] = useState<"group-voice" | "group-video" | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [localMessages, setLocalMessages] = useState<any[]>([]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, localMessages]);

  // Yeni kullanıcıya geçince local mesajları sıfırla
  useEffect(() => { setLocalMessages([]); }, [user?.id]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    // Optimistic update
    const optimisticMsg = {
      id: `local-${Date.now()}`,
      senderId: user?.id,
      sender: user,
      content,
      createdAt: new Date().toISOString(),
    };
    setLocalMessages((prev) => [...prev, optimisticMsg]);
    setContent("");
    try {
      await sendMsg.mutateAsync({ content });
    } catch {
      setLocalMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
    }
  };

  const memberNames = nearbyUsers.map((u: any) => `${u.firstName} ${u.lastName}`).join(", ") || "Komşular";

  return (
    <div className="flex flex-col h-full bg-[#f0f2f5] overflow-hidden" style={{ userSelect: "none" }}>
      {/* Header */}
      <div
        className="bg-white px-3 pb-2.5 border-b flex items-center gap-2 shadow-sm shrink-0"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 16px)" }}
      >
        <button onClick={onBack} className="text-primary font-bold text-sm">← Geri</button>
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Hash className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-sm">Bina Grup Sohbeti</h1>
          <p className="text-[9px] text-gray-400 truncate">{nearbyUsers.length} komşu • {memberNames}</p>
        </div>
        <button
          onClick={() => onStartCall("group-voice")}
          className="p-1.5 text-primary hover:bg-gray-100 rounded-full"
        >
          <Phone className="w-4 h-4" />
        </button>
        <button
          onClick={() => onStartCall("group-video")}
          className="p-1.5 text-primary hover:bg-gray-100 rounded-full"
        >
          <Video className="w-4 h-4" />
        </button>
        <button className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-full">
          <Users className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 flex flex-col">
        <div className="text-center py-3">
          <span className="bg-gray-200 text-gray-500 text-[9px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
            Bina Grup Sohbeti
          </span>
        </div>
        {(messages.length + localMessages.length === 0) && (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-2 py-10">
            <Hash className="w-10 h-10 opacity-20" />
            <p className="text-xs">Henüz mesaj yok. İlk mesajı sen gönder!</p>
          </div>
        )}
        {[...messages, ...localMessages].map((msg: any) => {
          const isMe = (msg.sender?.id ?? msg.senderId) === user?.id;
          const senderName = msg.sender ? `${msg.sender.firstName} ${msg.sender.lastName}` : "Komşu";
          return (
            <div key={msg.id} className={clsx("flex flex-col max-w-[82%]", isMe ? "self-end items-end" : "self-start items-start")}> 
              {!isMe && <span className="text-[9px] text-gray-500 ml-2 mb-0.5 font-semibold">{senderName}</span>}
              <div className={clsx(
                "px-3 py-2 rounded-2xl text-[13px] shadow-sm",
                isMe ? "bg-[#0084ff] text-white rounded-br-sm" : "bg-white text-black rounded-bl-sm"
              )}>
                {msg.content}
              </div>
              <span className="text-[9px] text-gray-400 mt-0.5 mx-1">{format(new Date(msg.createdAt), "HH:mm")}</span>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="bg-white p-2 border-t flex items-center gap-1 shrink-0">
        <button className="p-2 text-primary"><Paperclip className="w-4 h-4" /></button>
        <button className="p-2 text-primary"><ImageIcon className="w-4 h-4" /></button>
        <form onSubmit={handleSend} className="flex-1 flex items-center bg-[#f0f2f5] rounded-full px-3 py-1">
          <input
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Gruba mesaj yaz…"
            className="flex-1 bg-transparent border-none text-sm h-8 focus:ring-0 focus:outline-none"
          />
          <button type="submit" disabled={!content.trim()} className="text-primary disabled:opacity-40">
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Group Call Overlay */}
      {call && (
        <CallOverlay
          type={call}
          targetName="Bina Grup Araması"
          groupMembers={nearbyUsers}
          onClose={() => setCall(null)}
        />
      )}
    </div>
  );
}

// ── Private Chat View ─────────────────────────────────────────────────────────
function PrivateChatView({ selectedUser, onBack, onStartCall }: { selectedUser: any; onBack: () => void; onStartCall: (type: "voice" | "video", u: any) => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: messages = [] } = useMessages(selectedUser.id);
  const sendMessage = useSendMessage();
  const [msgContent, setMsgContent] = useState("");
  const [call, setCall] = useState<"voice" | "video" | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [localMessages, setLocalMessages] = useState<any[]>([]);

  // Mesajlar güncellendikçe localMessages'ı sıfırla
  useEffect(() => {
    setLocalMessages([]);
  }, [selectedUser.id]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, localMessages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msgContent.trim()) return;
    // Optimistic update: Local olarak ekle
    const optimisticMsg = {
      id: `local-${Date.now()}`,
      senderId: user?.id,
      content: msgContent,
      createdAt: new Date().toISOString(),
      fileUrl: undefined,
      fileName: undefined,
      location: undefined,
      // Diğer alanlar gerekirse eklenebilir
    };
    setLocalMessages((prev) => [...prev, optimisticMsg]);
    setMsgContent("");
    try {
      await sendMessage.mutateAsync({ receiverId: selectedUser.id, content: optimisticMsg.content });
      // Sunucudan dönen mesaj zaten 3sn içinde fetch ile gelecek, local mesajı silmeye gerek yok
    } catch {
      // Hata olursa local mesajı kaldır
      setLocalMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      toast({ title: "Mesaj gönderilemedi", variant: "destructive" });
    }
  };

  const handleBlock = async () => {
    try {
      await apiRequest("POST", `/api/users/${selectedUser.id}/block`);
      toast({ title: "Kullanıcı engellendi" });
      onBack();
    } catch { toast({ title: "Hata", variant: "destructive" }); }
  };

  const handleReport = async () => {
    const reason = prompt("Şikayet sebebiniz nedir?");
    if (!reason) return;
    try {
      await apiRequest("POST", `/api/users/${selectedUser.id}/report`, { reason });
      toast({ title: "Şikayetiniz iletildi" });
    } catch { toast({ title: "Hata", variant: "destructive" }); }
  };

  return (
    <div className="flex flex-col h-full bg-[#f0f2f5] overflow-hidden" style={{ userSelect: "none" }}>
      {/* Header */}
      <div
        className="bg-white px-3 pb-2.5 border-b flex items-center gap-2 shadow-sm shrink-0"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 34px)" }}
      >
        <button onClick={onBack} className="text-primary font-bold text-sm">← Geri</button>
        <div className="w-9 h-9 rounded-full bg-gray-200 overflow-hidden border shrink-0">
          {selectedUser.avatarUrl
            ? <img src={selectedUser.avatarUrl} className="w-full h-full object-cover" />
            : <UserIcon className="w-4 h-4 m-2.5 text-gray-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-sm truncate">{selectedUser.firstName} {selectedUser.lastName}</h1>
          <p className="text-[10px] text-green-500 font-medium">Çevrimiçi</p>
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={() => onStartCall("voice", selectedUser)} className="p-1.5 text-primary hover:bg-gray-100 rounded-full">
            <Phone className="w-4 h-4" />
          </button>
          <button onClick={() => onStartCall("video", selectedUser)} className="p-1.5 text-primary hover:bg-gray-100 rounded-full">
            <Video className="w-4 h-4" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-full">
                <MoreVertical className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleBlock} className="text-red-600">
                <UserX className="w-4 h-4 mr-2" /> Engelle
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleReport}>
                <ShieldAlert className="w-4 h-4 mr-2" /> Şikayet Et
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 flex flex-col">
        {(messages.length + localMessages.length === 0) && (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-2">
            <MessageCircle className="w-10 h-10 opacity-20" />
            <p className="text-xs">İlk mesajı gönder!</p>
          </div>
        )}
        {[...messages, ...localMessages].map((msg: any) => {
          const isMe = msg.senderId === user?.id;
          return (
            <div key={msg.id} className={clsx("flex flex-col max-w-[82%]", isMe ? "self-end items-end" : "self-start items-start")}> 
              <div className={clsx(
                "px-3 py-2 rounded-2xl text-[13px] shadow-sm",
                isMe ? "bg-[#0084ff] text-white" : "bg-white text-black"
              )}>
                {msg.content}
              </div>
              {msg.fileUrl && (
                <div className="mt-0.5 p-1.5 bg-white rounded-lg border text-[10px] flex items-center gap-1">
                  <Paperclip className="w-2.5 h-2.5" /> {msg.fileName || "Dosya"}
                </div>
              )}
              {msg.location && (
                <div className="mt-0.5 p-1.5 bg-white rounded-lg border text-[10px] flex items-center gap-1 text-primary font-bold">
                  <MapPin className="w-2.5 h-2.5" /> Konum
                </div>
              )}
              <span className="text-[9px] text-gray-400 mt-0.5">{format(new Date(msg.createdAt), "HH:mm")}</span>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Input alanı */}
      <div className="relative bg-white p-2 border-t flex items-center gap-1 shrink-0">
        <button className="p-2 text-primary"><Paperclip className="w-4 h-4" /></button>
        <button className="p-2 text-primary"><ImageIcon className="w-4 h-4" /></button>
        <form onSubmit={handleSend} className="flex-1 flex items-center bg-[#f0f2f5] rounded-full px-3 py-1">
          <input
            value={msgContent}
            onChange={e => setMsgContent(e.target.value)}
            placeholder="Mesaj yazın…"
            className="flex-1 bg-transparent border-none text-sm h-8 focus:ring-0 focus:outline-none"
          />
          <button type="submit" disabled={!msgContent.trim()} className="text-primary disabled:opacity-40">
            <Send className="w-4 h-4" />
          </button>
        </form>
        <button className="p-2 text-primary"><MapPin className="w-4 h-4" /></button>
      </div>

      {/* Call overlay */}
      {call && (
        <CallOverlay
          type={call}
          targetName={`${selectedUser.firstName} ${selectedUser.lastName}`}
          targetAvatar={selectedUser.avatarUrl}
          onClose={() => setCall(null)}
        />
      )}
    </div>
  );
}

// ── Main Chat List Page ───────────────────────────────────────────────────────
export default function Chat() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"conversations" | "group" | "nearby" | "search">("conversations");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showGroupChat, setShowGroupChat] = useState(false);
  const [activeCall, setActiveCall] = useState<any>(null);
  const [incomingCall, setIncomingCall] = useState<any>(null);

  const handleStartNewChat = () => {
    setActiveTab("nearby");
  };

  // Aynı binadaki/adresteki komşuları çekiyoruz
  const { data: buildingUsers = [] } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      return res.ok ? res.json() : [];
    }
  });

  // Sadece mesajlaştığımız kişileri çekiyoruz
  const { data: convUsers = [] } = useQuery({
    queryKey: ["/api/conversations"],
    queryFn: async () => {
      const res = await fetch("/api/conversations");
      return res.ok ? res.json() : [];
    }
  });

  const { data: searchResults = [] } = useSearchUsers(searchQuery);
  const { data: groupMessages = [] } = useBuildingMessages();

  // Yakındakiler sekmesi için kendimizi listeden çıkarıyoruz
  const neighbors = (buildingUsers as any[]).filter((u: any) => u.id !== user?.id);

  const { toast } = useToast();
  useEffect(() => {
    if (user) {
      socket.connect();
      socket.emit("join", user.id);

      const handleIncoming = (data: any) => {
        setActiveCall((prev: any) => {
          if (!prev) setIncomingCall(data);
          return prev;
        });
        // Arama bildirimi (toast ve sistem bildirimi)
        toast({ title: "Gelen arama", description: `${data.name} sizi arıyor!` });
        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
          new Notification("Gelen arama", { body: `${data.name} sizi arıyor!` });
        }
      };

      const handleEnd = () => setIncomingCall(null);

      socket.on("incomingCall", handleIncoming);
      socket.on("callEnded", handleEnd);

      return () => {
        socket.off("incomingCall", handleIncoming);
        socket.off("callEnded", handleEnd);
        socket.disconnect();
      };
    }
  }, [user, toast]);

  const acceptCall = () => {
    setActiveCall({
      type: incomingCall.type,
      targetName: incomingCall.name,
      targetAvatar: incomingCall.avatar,
      targetId: incomingCall.from,
      isReceiving: true,
      callerSignal: incomingCall.signal
    });
    setIncomingCall(null);
  };

  const rejectCall = () => {
    socket.emit("endCall", { to: incomingCall.from });
    setIncomingCall(null);
  };

  const content = selectedUser ? (
    <PrivateChatView selectedUser={selectedUser} onBack={() => setSelectedUser(null)} onStartCall={(t, u) => setActiveCall({ type: t, targetName: `${u.firstName} ${u.lastName}`, targetAvatar: u.avatarUrl, targetId: u.id })} />
  ) : showGroupChat ? (
    <GroupChatView onBack={() => setShowGroupChat(false)} nearbyUsers={neighbors} onStartCall={(t) => setActiveCall({ type: t, targetName: "Bina Grup Araması", groupMembers: neighbors })} />
  ) : (
    <div className="flex flex-col bg-white min-h-full pb-16">

      {/* Header */}
      <div className="bg-sky-500 px-6 pt-10 pb-4 rounded-b-[2rem] shadow-md relative overflow-hidden">
        <div className="absolute -right-8 -bottom-6 w-36 h-36 bg-white/10 rounded-full" />
        <div className="absolute right-10 -top-6 w-20 h-20 bg-white/10 rounded-full blur-xl" />
        <div className="flex items-center justify-between relative z-10">
          <h1 className="text-2xl font-extrabold text-white">Mesajlar</h1>
          <button className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
            <Phone className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Input alanı */}
        <div className="relative bg-white p-2 border-t flex items-center gap-1 shrink-0">
          <button className="p-2 text-primary"><Paperclip className="w-4 h-4" /></button>
          <button className="p-2 text-primary"><ImageIcon className="w-4 h-4" /></button>
          <form onSubmit={handleSend} className="flex-1 flex items-center bg-[#f0f2f5] rounded-full px-3 py-1">
            <input
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Gruba mesaj yaz…"
              className="flex-1 bg-transparent border-none text-sm h-8 focus:ring-0 focus:outline-none"
            />
            <button type="submit" disabled={!content.trim()} className="text-primary disabled:opacity-40">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
              {tab.label}
            return (
              <MobileContainer showNav={!selectedUser && !showGroupChat && !activeCall && !incomingCall}>
                {content}
                {/* Sabit + butonu */}
                <button
                  className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center shadow-lg hover:bg-primary/90 transition-all"
                  style={{ boxShadow: "0 4px 16px 0 rgba(0,0,0,0.12)" }}
                  aria-label="Yeni mesaj veya ekle"
                >
                  <Plus className="w-7 h-7" />
                </button>
                {activeCall && (
                  <CallOverlay {...activeCall} onClose={() => setActiveCall(null)} />
                )}

                {incomingCall && !activeCall && (
                  <div className="absolute inset-0 z-[200] bg-gray-900 flex flex-col items-center justify-center text-white p-6 animate-in slide-in-from-bottom">
                    <div className="w-28 h-28 rounded-full bg-white/10 mb-6 overflow-hidden border-4 border-white/20 shadow-2xl">
                      <img src={incomingCall.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${incomingCall.name}`} className="w-full h-full object-cover" />
                    </div>
                    <h2 className="text-3xl font-bold mb-2">{incomingCall.name}</h2>
                    <p className="text-gray-400 mb-12 text-lg animate-pulse">{incomingCall.type === 'video' ? 'Görüntülü Arıyor...' : 'Sesli Arıyor...'}</p>
                    <div className="flex gap-10">
                      <button onClick={rejectCall} className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center shadow-lg shadow-red-500/50 hover:bg-red-600 active:scale-95 transition-all">
                        <PhoneOff className="w-7 h-7" />
                      </button>
                      <button onClick={acceptCall} className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/50 hover:bg-green-600 active:scale-95 transition-all animate-bounce">
                        <Phone className="w-7 h-7" />
                      </button>
                    </div>
                  </div>
                )}
              </MobileContainer>
            );
            {(convUsers as any[]).length === 0 ? (
              <div className="p-4 space-y-4">
                <Empty
                  icon={<MessageCircle className="w-8 h-8 text-sky-500" />}
                  title="Henüz sohbet yok"
                  sub="Aşağıdaki listeden komşularına hemen mesaj gönderebilirsin."
                  tone="sky"
                />
                {neighbors.length > 0 && (
                  <div className="bg-white rounded-2xl border overflow-hidden mt-4 shadow-sm">
                    <div className="px-3 py-2.5 bg-gray-50 border-b flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-500 uppercase">Mahallendeki Komşular</span>
                      <span className="text-[10px] text-sky-500 font-bold bg-sky-50 px-2 py-1 rounded-lg">{neighbors.length} Kişi</span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {neighbors.map((u: any) => (
                        <UserRow key={u.id} u={u} onClick={() => setSelectedUser(u)} sub="Aynı mahallede" />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 space-y-4">
                {/* Recent one-on-one chats */}
                {(convUsers as any[]).slice(0).reverse().map((u: any) => {
                  const isActive = selectedUser?.id === u.id;
                  return (
                    <button
                      key={u.id}
                      onClick={() => setSelectedUser(isActive ? null : u)}
                      className={clsx(
                        "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all",
                        isActive ? "bg-primary/10" : "hover:bg-gray-50"
                      )}
                    >
                      <div className="relative shrink-0">
                        <div className="w-12 h-12 rounded-full bg-primary/10 overflow-hidden border">
                          {u.avatarUrl
                            ? <img src={u.avatarUrl} className="w-full h-full object-cover" />
                            : <UserIcon className="w-6 h-6 m-3 text-primary" />}
                        </div>
                        {u.unread > 0 && (
                          <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full text-white text-[10px] font-bold flex items-center justify-center">{u.unread}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-sm text-foreground">{u.firstName} {u.lastName}</h3>
                          {u.lastMessage && (
                            <span className="text-[10px] text-gray-400 shrink-0 ml-2">
                              {formatDistanceToNow(new Date(u.lastMessage.createdAt), { addSuffix: false, locale: tr })}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {u.lastMessage ? u.lastMessage.content || "Dosya gönderildi" : "Mesaj göndermek için dokun"}
                        </p>
                      </div>
                    </button>
                  );
                })}

                {/* Recent group messages preview */}
                <div className="bg-white rounded-2xl border divide-y overflow-hidden">
                  <div className="px-3 py-2 flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Son Mesajlar</span>
                    <span className="text-[10px] text-primary font-bold" onClick={() => setShowGroupChat(true)}>Tümünü Gör</span>
                  </div>
                  {(groupMessages as any[]).length === 0 && (
                    <p className="text-center text-xs text-gray-400 py-6">Henüz mesaj yok.</p>
                  )}
                  {(groupMessages as any[]).slice(-5).reverse().map((msg: any) => (
                    <div key={msg.id} className="px-3 py-2 flex items-start gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary/10 overflow-hidden shrink-0 mt-0.5">
                        {msg.sender?.avatarUrl
                          ? <img src={msg.sender.avatarUrl} className="w-full h-full object-cover" />
                          : <UserIcon className="w-3.5 h-3.5 m-1.5 text-primary" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-gray-700">{msg.sender?.firstName} {msg.sender?.lastName}</p>
                        <p className="text-xs text-gray-500 truncate">{msg.content}</p>
                      </div>
                      <span className="text-[9px] text-gray-400 shrink-0">{format(new Date(msg.createdAt), "HH:mm")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* NEARBY */}
        {activeTab === "nearby" && (
          <div className="divide-y divide-gray-50">
            {neighbors.length === 0 && (
              <Empty icon={<UserIcon className="w-8 h-8 text-primary" />} title="Komşu bulunamadı" sub="Aynı mahallede kayıtlı başka bir komşu yok." tone="primary" />
            )}
            {neighbors.map((u: any) => (
              <UserRow key={u.id} u={u} onClick={() => setSelectedUser(u)} sub="Aynı mahallede" />
            ))}
          </div>
        )}

        {/* SEARCH */}
        {activeTab === "search" && (
          <div className="divide-y divide-gray-50">
            {searchQuery.length < 3 && (
              <p className="text-center text-xs text-gray-400 py-10 px-6">En az 3 karakter girerek arama yapabilirsiniz.</p>
            )}
            {(searchResults as any[]).map((u: any) => (
              <UserRow key={u.id} u={u} onClick={() => setSelectedUser(u)} sub={u.phone || u.email} />
            ))}
          </div>
        )}

      </div>

      {/* FAB */}
      <button
        onClick={handleStartNewChat}
        className="absolute bottom-6 right-6 w-14 h-14 bg-sky-500 text-white rounded-2xl shadow-xl shadow-sky-400/50 flex items-center justify-center hover:-translate-y-1 active:scale-95 transition-all z-30"
        aria-label="Yeni sohbet aç"
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );

  return (
    <MobileContainer showNav={!selectedUser && !showGroupChat && !activeCall && !incomingCall}>
      {content}
      
      {activeCall && (
        <CallOverlay {...activeCall} onClose={() => setActiveCall(null)} />
      )}

      {incomingCall && !activeCall && (
        <div className="absolute inset-0 z-[200] bg-gray-900 flex flex-col items-center justify-center text-white p-6 animate-in slide-in-from-bottom">
          <div className="w-28 h-28 rounded-full bg-white/10 mb-6 overflow-hidden border-4 border-white/20 shadow-2xl">
            <img src={incomingCall.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${incomingCall.name}`} className="w-full h-full object-cover" />
          </div>
          <h2 className="text-3xl font-bold mb-2">{incomingCall.name}</h2>
          <p className="text-gray-400 mb-12 text-lg animate-pulse">{incomingCall.type === 'video' ? 'Görüntülü Arıyor...' : 'Sesli Arıyor...'}</p>
          <div className="flex gap-10">
            <button onClick={rejectCall} className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center shadow-lg shadow-red-500/50 hover:bg-red-600 active:scale-95 transition-all">
              <PhoneOff className="w-7 h-7" />
            </button>
            <button onClick={acceptCall} className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/50 hover:bg-green-600 active:scale-95 transition-all animate-bounce">
              <Phone className="w-7 h-7" />
            </button>
          </div>
        </div>
      )}
    </MobileContainer>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function UserRow({ u, onClick, sub }: { u: any; onClick: () => void; sub?: string }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
      <div className="relative shrink-0">
        <div className="w-12 h-12 rounded-full bg-primary/10 overflow-hidden border">
          {u.avatarUrl
            ? <img src={u.avatarUrl} className="w-full h-full object-cover" />
            : <UserIcon className="w-6 h-6 m-3 text-primary" />}
        </div>
        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-white rounded-full" />
      </div>
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-foreground">{u.firstName} {u.lastName}</h3>
          {u.lastMessage && (
            <span className="text-[10px] text-gray-400 shrink-0 ml-2">
              {formatDistanceToNow(new Date(u.lastMessage.createdAt), { addSuffix: false, locale: tr })}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 truncate mt-0.5">
          {sub ?? (u.lastMessage ? u.lastMessage.content || "Dosya gönderildi" : "Mesaj göndermek için dokun")}
        </p>
      </div>
      {u.unread > 0 && (
        <span className="shrink-0 w-5 h-5 bg-primary rounded-full text-white text-[10px] font-bold flex items-center justify-center">{u.unread}</span>
      )}
      <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
    </button>
  );
}

function Empty({ icon, title, sub, tone = "primary" }: { icon: React.ReactNode; title: string; sub: string; tone?: "sky" | "primary" }) {
  const toneClass = tone === "sky" ? "bg-sky-100" : "bg-primary/10";
  return (
    <div className="flex flex-col items-center justify-center py-20 px-8 text-center gap-3">
      <div className={`w-16 h-16 rounded-2xl ${toneClass} flex items-center justify-center`}>
        {icon}
      </div>
      <p className="text-sm font-bold text-gray-500">{title}</p>
      <p className="text-xs text-gray-400">{sub}</p>
    </div>
  );
}
