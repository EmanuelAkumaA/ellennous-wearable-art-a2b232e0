import { ImageIcon, Tags, BarChart3, UserCog, Wand2, Star, MoreHorizontal } from "lucide-react";
import type { AdminTab } from "./AdminShell";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useState } from "react";

interface NavEntry {
  key: AdminTab;
  label: string;
  icon: typeof ImageIcon;
}

const PRIMARY: NavEntry[] = [
  { key: "pieces", label: "Obras", icon: ImageIcon },
  { key: "categories", label: "Cat.", icon: Tags },
  { key: "converter", label: "Conv.", icon: Wand2 },
  { key: "reviews", label: "Aval.", icon: Star },
  { key: "user", label: "Conta", icon: UserCog },
];

const SECONDARY: NavEntry[] = [
  { key: "stats", label: "Estatísticas", icon: BarChart3 },
];

interface Props {
  active: AdminTab;
  onSelect: (k: AdminTab) => void;
}

export const AdminBottomNav = ({ active, onSelect }: Props) => {
  const [moreOpen, setMoreOpen] = useState(false);
  const isMoreActive = SECONDARY.some((s) => s.key === active);

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-50 pointer-events-none"
      aria-label="Navegação principal"
    >
      <div className="pointer-events-auto mx-3 mb-3 rounded-2xl bg-card/85 backdrop-blur-xl border border-primary/20 shadow-[0_-8px_30px_-8px_hsl(var(--primary)/0.4)] pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-stretch justify-around px-1 py-1.5">
          {PRIMARY.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.key;
            return (
              <button
                key={item.key}
                onClick={() => onSelect(item.key)}
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
                className="group relative flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 transition-all duration-300"
              >
                <span
                  className={`flex items-center justify-center h-10 w-10 rounded-xl transition-all duration-300 ${
                    isActive
                      ? "bg-gradient-purple-wine shadow-[0_0_20px_-4px_hsl(var(--primary-glow)/0.7)] -translate-y-2"
                      : "bg-transparent group-hover:bg-secondary/40"
                  }`}
                >
                  <Icon
                    className={`h-[18px] w-[18px] transition-colors ${
                      isActive ? "text-white" : "text-muted-foreground group-hover:text-foreground"
                    }`}
                  />
                </span>
                <span
                  className={`font-accent text-[9px] tracking-[0.2em] uppercase transition-all duration-300 ${
                    isActive
                      ? "text-primary-glow -translate-y-1"
                      : "text-muted-foreground/70"
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}

          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger asChild>
              <button
                aria-label="Mais"
                className="group relative flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 transition-all duration-300"
              >
                <span
                  className={`flex items-center justify-center h-10 w-10 rounded-xl transition-all duration-300 ${
                    isMoreActive
                      ? "bg-gradient-purple-wine shadow-[0_0_20px_-4px_hsl(var(--primary-glow)/0.7)] -translate-y-2"
                      : "bg-transparent group-hover:bg-secondary/40"
                  }`}
                >
                  <MoreHorizontal
                    className={`h-[18px] w-[18px] transition-colors ${
                      isMoreActive ? "text-white" : "text-muted-foreground group-hover:text-foreground"
                    }`}
                  />
                </span>
                <span
                  className={`font-accent text-[9px] tracking-[0.2em] uppercase transition-all duration-300 ${
                    isMoreActive ? "text-primary-glow -translate-y-1" : "text-muted-foreground/70"
                  }`}
                >
                  Mais
                </span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="bg-card/95 backdrop-blur-xl border-border/40 rounded-t-2xl">
              <SheetHeader>
                <SheetTitle className="font-display text-left">Mais</SheetTitle>
              </SheetHeader>
              <div className="mt-4 grid grid-cols-2 gap-2 pb-[env(safe-area-inset-bottom)]">
                {SECONDARY.map((item) => {
                  const Icon = item.icon;
                  const isActive = active === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => {
                        onSelect(item.key);
                        setMoreOpen(false);
                      }}
                      className={`flex flex-col items-start gap-2 p-4 rounded-xl border transition-colors ${
                        isActive
                          ? "border-primary/40 bg-primary/10 text-primary-glow"
                          : "border-border/40 hover:border-primary/30 hover:bg-secondary/40"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="font-accent text-[11px] tracking-[0.25em] uppercase">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
};
