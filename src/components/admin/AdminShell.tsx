import { ReactNode, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAdminProfile } from "@/hooks/useAdminProfile";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ImageIcon, Tags, BarChart3, UserCog, LogOut, ExternalLink, Menu, Sparkles, Star, Wifi, WifiOff, Wand2 } from "lucide-react";
import { PalettePhoto } from "@/components/admin/PalettePhoto";
import { InstallPrompt } from "@/components/admin/InstallPrompt";
import brandIcon from "@/assets/brand-icon.png";

// PWA registration scoped to /admin — only in production, never in iframes/preview
const registerAdminPWA = () => {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const isInIframe = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();
  const host = window.location.hostname;
  const isPreviewHost =
    host.includes("id-preview--") ||
    host.includes("lovableproject.com") ||
    host.includes("lovable.app") ||
    host === "localhost" ||
    host === "127.0.0.1";

  if (isInIframe || isPreviewHost) {
    // Cleanup any stale SW from prior runs in preview/iframe contexts
    navigator.serviceWorker.getRegistrations?.().then((regs) => {
      regs.forEach((r) => {
        if (r.scope.includes("/admin")) r.unregister();
      });
    });
    return;
  }

  // Inject manifest + iOS PWA meta tags only inside /admin so the public site stays a normal web app
  if (!document.querySelector('link[rel="manifest"][data-admin]')) {
    const link = document.createElement("link");
    link.rel = "manifest";
    link.href = "/admin-manifest.webmanifest";
    link.setAttribute("data-admin", "true");
    document.head.appendChild(link);
  }
  const addOnce = (selector: string, build: () => HTMLElement) => {
    if (!document.head.querySelector(selector)) document.head.appendChild(build());
  };
  addOnce('meta[name="apple-mobile-web-app-capable"][data-admin]', () => {
    const m = document.createElement("meta");
    m.name = "apple-mobile-web-app-capable";
    m.content = "yes";
    m.setAttribute("data-admin", "true");
    return m;
  });
  addOnce('meta[name="apple-mobile-web-app-status-bar-style"][data-admin]', () => {
    const m = document.createElement("meta");
    m.name = "apple-mobile-web-app-status-bar-style";
    m.content = "black-translucent";
    m.setAttribute("data-admin", "true");
    return m;
  });
  addOnce('meta[name="apple-mobile-web-app-title"][data-admin]', () => {
    const m = document.createElement("meta");
    m.name = "apple-mobile-web-app-title";
    m.content = "Ellennous";
    m.setAttribute("data-admin", "true");
    return m;
  });
  addOnce('link[rel="apple-touch-startup-image"][data-admin]', () => {
    const l = document.createElement("link");
    l.rel = "apple-touch-startup-image";
    l.href = "/admin-splash.png";
    l.setAttribute("data-admin", "true");
    return l;
  });

  navigator.serviceWorker
    .register("/admin-sw.js", { scope: "/admin" })
    .catch(() => undefined);
};

export type AdminTab = "pieces" | "categories" | "reviews" | "stats" | "converter" | "user";

interface NavItem {
  key: AdminTab;
  label: string;
  icon: typeof ImageIcon;
  desc: string;
}

const NAV: NavItem[] = [
  { key: "pieces", label: "Obras", icon: ImageIcon, desc: "Catálogo, capas e galeria de cada peça" },
  { key: "categories", label: "Categorias", icon: Tags, desc: "Organização e ordem das coleções" },
  { key: "reviews", label: "Avaliações", icon: Star, desc: "Convites de avaliação e moderação dos depoimentos" },
  { key: "stats", label: "Estatísticas", icon: BarChart3, desc: "Aberturas, conversão e tempo de visita" },
  { key: "converter", label: "Conversor", icon: Wand2, desc: "Conversor de imagens para WebP — gera variantes responsivas no navegador" },
  { key: "user", label: "Conta", icon: UserCog, desc: "Acesso e segurança do administrador" },
];

const Atmosphere = () => (
  <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
    <div className="absolute inset-0 admin-bg-grid opacity-40" />
    <div className="absolute top-[-15%] left-[-10%] w-[55vw] h-[55vw] rounded-full bg-primary/15 blur-[140px] animate-orb-drift" />
    <div
      className="absolute bottom-[-20%] right-[-15%] w-[50vw] h-[50vw] rounded-full bg-brand-red/10 blur-[150px] animate-orb-drift"
      style={{ animationDelay: "-5s" }}
    />
    <div
      className="absolute top-[40%] left-[60%] w-[28vw] h-[28vw] rounded-full bg-brand-deepblue/25 blur-[120px] animate-orb-drift"
      style={{ animationDelay: "-9s" }}
    />
    <div className="absolute inset-0 grain opacity-30" />
  </div>
);

const NavList = ({
  active,
  onSelect,
}: {
  active: AdminTab;
  onSelect: (k: AdminTab) => void;
}) => (
  <nav className="flex flex-col gap-1">
    {NAV.map((item) => {
      const Icon = item.icon;
      const isActive = active === item.key;
      return (
        <button
          key={item.key}
          onClick={() => onSelect(item.key)}
          className={`group relative flex items-center gap-3 px-4 py-3 text-left transition-all duration-300 overflow-hidden ${
            isActive
              ? "bg-primary/10 text-primary-glow"
              : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
          }`}
        >
          <span
            className={`absolute left-0 top-0 bottom-0 w-[2px] transition-all ${
              isActive ? "bg-primary shadow-[0_0_12px_hsl(var(--primary-glow))]" : "bg-transparent"
            }`}
          />
          <Icon className={`h-4 w-4 transition-transform ${isActive ? "scale-110" : "group-hover:scale-105"}`} />
          <span className="font-accent text-sm tracking-[0.2em] uppercase">{item.label}</span>
          {isActive && (
            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary-glow shadow-[0_0_8px_hsl(var(--primary-glow))]" />
          )}
        </button>
      );
    })}
  </nav>
);

const SidebarBody = ({
  active,
  onSelect,
  email,
  displayName,
  avatarUrl,
  paletteColors,
  onSignOut,
}: {
  active: AdminTab;
  onSelect: (k: AdminTab) => void;
  email?: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  paletteColors?: string[] | null;
  onSignOut: () => void;
}) => {
  const fallback = displayName?.trim() || "Ellennous";
  const initials = (displayName?.trim() || email || "EL").slice(0, 2).toUpperCase();
  return (
  <div className="flex flex-col h-full">
    <div className="px-6 pt-8 pb-6 border-b border-border/40">
      <div className="flex items-center gap-3">
        <PalettePhoto size="sm" src={avatarUrl ?? undefined} initials={initials} colors={paletteColors} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg leading-none text-gradient-light truncate" title={fallback}>{fallback}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <img src={brandIcon} alt="" className="h-3.5 w-3.5 object-contain opacity-90" />
            <p className="font-accent text-[10px] tracking-[0.4em] text-primary-glow/70 uppercase">Atelier · Ellennous</p>
          </div>
        </div>
      </div>
    </div>

    <div className="flex-1 px-3 py-6 overflow-y-auto">
      <p className="px-4 mb-3 font-accent text-[10px] tracking-[0.4em] text-muted-foreground uppercase">Navegação</p>
      <NavList active={active} onSelect={onSelect} />
    </div>

    <div className="px-4 py-5 border-t border-border/40 space-y-3">
      <div className="px-2">
        <p className="font-accent text-[10px] tracking-[0.3em] text-muted-foreground uppercase mb-1">Sessão</p>
        <p className="text-xs text-foreground/80 truncate" title={email}>
          {email ?? "—"}
        </p>
      </div>
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="w-full justify-start rounded-none font-accent tracking-[0.2em] uppercase text-[10px] hover:bg-secondary/60"
      >
        <a
          href="https://ellennous-wearable-art-a2b232e0.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLink className="h-3.5 w-3.5 mr-2" /> Ver site público
        </a>
      </Button>
      <Button
        onClick={onSignOut}
        variant="ghost"
        size="sm"
        className="w-full justify-start rounded-none font-accent tracking-[0.2em] uppercase text-[10px] text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        <LogOut className="h-3.5 w-3.5 mr-2" /> Sair
      </Button>
    </div>
  </div>
  );
};

interface AdminShellProps {
  active: AdminTab;
  onSelect: (k: AdminTab) => void;
  headerAction?: ReactNode;
  children: ReactNode;
}

export const AdminShell = ({ active, onSelect, headerAction, children }: AdminShellProps) => {
  const { user, signOut } = useAuth();
  const { profile } = useAdminProfile();
  const online = useOnlineStatus();
  const [mobileOpen, setMobileOpen] = useState(false);
  const current = NAV.find((n) => n.key === active) ?? NAV[0];
  const Icon = current.icon;

  useEffect(() => {
    registerAdminPWA();
  }, []);

  const handleSelect = (k: AdminTab) => {
    onSelect(k);
    setMobileOpen(false);
  };

  return (
    <div className="min-h-screen relative text-foreground">
      <Atmosphere />
      <InstallPrompt />

      <div className="lg:grid lg:grid-cols-[280px_1fr] min-h-screen">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block sticky top-0 h-screen border-r border-border/40 bg-card/40 backdrop-blur-xl">
          <SidebarBody active={active} onSelect={handleSelect} email={user?.email} displayName={profile.display_name} avatarUrl={profile.avatar_url} paletteColors={profile.palette_colors} onSignOut={signOut} />
        </aside>

        <div className="flex flex-col min-w-0">
          {/* Sticky header */}
          <header className="sticky top-0 z-40 border-b border-border/40 bg-background/60 backdrop-blur-xl">
            <div className="flex items-center gap-3 px-5 lg:px-10 py-4">
              {/* Mobile menu */}
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="lg:hidden -ml-2">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-[280px] bg-card/95 backdrop-blur-xl border-border/40">
                  <SidebarBody active={active} onSelect={handleSelect} email={user?.email} displayName={profile.display_name} avatarUrl={profile.avatar_url} paletteColors={profile.palette_colors} onSignOut={signOut} />
                </SheetContent>
              </Sheet>

              <div className="hidden sm:flex items-center gap-2 text-[10px] font-accent tracking-[0.3em] uppercase text-muted-foreground">
                <Sparkles className="h-3 w-3 text-primary-glow" />
                <span>Atelier</span>
                <span className="text-border">/</span>
                <span className="text-primary-glow">{current.label}</span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 lg:hidden">
                  <Icon className="h-4 w-4 text-primary-glow" />
                  <p className="font-display text-base truncate">{current.label}</p>
                </div>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-accent tracking-[0.25em] uppercase transition-colors ${
                    online
                      ? "border-primary/30 bg-primary/10 text-primary-glow"
                      : "border-amber-500/40 bg-amber-500/10 text-amber-300"
                  }`}
                  title={online ? "Conectado" : "Sem conexão — exibindo dados em cache local"}
                >
                  {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                  <span className="hidden sm:inline">{online ? "Online" : "Offline · cache"}</span>
                </span>
                {headerAction}
              </div>
            </div>

            {/* Page hero */}
            <div className="hidden lg:flex items-end justify-between gap-6 px-10 pb-6 pt-2">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-md bg-gradient-purple-wine flex items-center justify-center shadow-glow">
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <h1 className="font-display text-3xl text-gradient-light">{current.label}</h1>
                </div>
                <p className="text-sm text-muted-foreground max-w-xl">{current.desc}</p>
              </div>
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 px-5 lg:px-10 py-8 lg:py-10">
            <div key={active} className="animate-fade-up">
              {children}
            </div>
          </main>

          <footer className="px-5 lg:px-10 py-6 text-[10px] font-accent tracking-[0.3em] uppercase text-muted-foreground/60 border-t border-border/30">
            Ellennous · Atelier interno
          </footer>
        </div>
      </div>
    </div>
  );
};
