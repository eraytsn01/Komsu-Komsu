import { Link, useLocation } from "wouter";
import { CircleDashed, Tag, Bell, MessageCircle, User } from "lucide-react";
import { clsx } from "clsx";

export function BottomNav() {
  const [location] = useLocation();

  const navItems = [
    { href: "/",             icon: CircleDashed,  label: "Durum",  bg: "bg-violet-100",  text: "text-violet-500" },
    { href: "/adverts",      icon: Tag,           label: "İlanlar", bg: "bg-emerald-100", text: "text-emerald-500" },
    { href: "/announcements",icon: Bell,          label: "Duyuru", bg: "bg-orange-100",  text: "text-orange-500" },
    { href: "/chat",         icon: MessageCircle, label: "Sohbet", bg: "bg-sky-100",     text: "text-sky-500" },
    { href: "/profile",      icon: User,          label: "Profil", bg: "bg-primary/10",  text: "text-primary" },
  ];

  return (
    <nav className="h-20 bg-background border-t border-border/60 px-4 pb-4 pt-2 flex items-center justify-between shrink-0 z-40 relative">
      {navItems.map((item) => {
        const isActive = location === item.href;
        const Icon = item.icon;
        
        return (
          <Link 
            key={item.href} 
            href={item.href}
            className="flex-1 flex flex-col items-center justify-center gap-1 group outline-none"
          >
            <div className={clsx(
              "p-1.5 rounded-xl transition-all duration-300 ease-out",
              isActive 
                ? `${item.bg} ${item.text} scale-110`
                : "text-muted-foreground group-hover:bg-muted group-hover:text-foreground"
            )}>
              <Icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
            </div>
            <span className={clsx(
              "text-[10px] font-medium transition-colors",
              isActive ? item.text : "text-muted-foreground"
            )}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
