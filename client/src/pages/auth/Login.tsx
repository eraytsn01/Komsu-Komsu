import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { MobileContainer } from "@/components/layout/MobileContainer";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Loader2, KeyRound } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login, isLoggingIn } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login({ email, password });
      setLocation("/");
    } catch (err: any) {
      toast({
        title: "Giriş Başarısız",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const handleForgotPassword = () => {
    toast({
      title: "Şifre Sıfırlama",
      description: "Doğrulama kodu telefonunuza gönderildi.",
    });
  };

  return (
    <MobileContainer showNav={false}>
      <div className="min-h-full flex flex-col p-8 animate-fade-in bg-white">
        <div className="flex-1 flex flex-col justify-center max-w-sm w-full mx-auto">
          
          <img src="/logo.png" alt="Komşum Logo" className="w-24 h-24 mb-6 mx-auto rounded-[2rem] shadow-xl border-4 border-white" />
          
          <div className="text-center mb-10">
            <h1 className="text-4xl font-bold text-foreground mb-2">Komşum</h1>
            <p className="text-muted-foreground">Apartmanına hoş geldin</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-foreground ml-1">E-posta</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                placeholder="ornek@mail.com"
                required
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-foreground ml-1">Şifre</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                placeholder="••••••••"
                required
              />
            </div>

            <div className="flex justify-end pt-1">
              <button 
                type="button"
                onClick={handleForgotPassword}
                className="text-sm font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
              >
                <KeyRound className="w-3.5 h-3.5" /> Şifremi Unuttum
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-4 mt-6 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/30 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all disabled:opacity-70 flex items-center justify-center"
            >
              {isLoggingIn ? <Loader2 className="w-5 h-5 animate-spin" /> : "Giriş Yap"}
            </button>
          </form>

          <div className="mt-8 text-center text-sm text-muted-foreground">
            Hesabın yok mu?{" "}
            <Link href="/register" className="font-bold text-secondary hover:underline">
              Kayıt Ol
            </Link>
          </div>
        </div>
      </div>
    </MobileContainer>
  );
}
