import { ReactNode, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAdminProfile } from "@/hooks/useAdminProfile";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ImageIcon, Tags, BarChart3, UserCog, LogOut, ExternalLink, Menu, Sparkles } from "lucide-react";
import { PalettePhoto } from "@/components/admin/PalettePhoto";

export type AdminTab = "pieces" | "categories" | "stats" | "user";

interface NavItem {
  key: AdminTab;
  label: string;
  icon: typeof ImageIcon;
  desc: string;
}

const NAV: NavItem[] = [
  { key: "pieces", label: "Obras", icon: ImageIcon, desc: "Catálogo, capas e galeria de cada peça" },
  { key: "categories", label: "Categorias", icon: Tags, desc: "Organização e ordem das coleções" },
  { key: "stats", label: "Estatísticas", icon: BarChart3, desc: "Aberturas, conversão e tempo de visita" },
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
        <div className="min-w-0">
          <p className="font-display text-lg leading-none text-gradient-light truncate" title={fallback}>{fallback}</p>
          <p className="font-accent text-[10px] tracking-[0.4em] text-primary-glow/70 uppercase mt-1">Atelier · Ellennous</p>
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
          href="https://ellennous-wearable-art.vercel.app/"
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const current = NAV.find((n) => n.key === active) ?? NAV[0];
  const Icon = current.icon;

  const handleSelect = (k: AdminTab) => {
    onSelect(k);
    setMobileOpen(false);
  };

  return (
    <div className="min-h-screen relative text-foreground">
      <Atmosphere />

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

              {headerAction && <div className="ml-auto">{headerAction}</div>}
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
