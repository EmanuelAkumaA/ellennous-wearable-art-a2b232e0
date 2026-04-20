import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, X, Share, Plus } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "admin_install_dismissed";
const DISMISS_DAYS = 7;

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  // @ts-expect-error iOS Safari
  window.navigator.standalone === true;

const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) && !/CriOS|FxiOS/i.test(navigator.userAgent);

const wasRecentlyDismissed = () => {
  const ts = localStorage.getItem(DISMISS_KEY);
  if (!ts) return false;
  const ageMs = Date.now() - Number(ts);
  return ageMs < DISMISS_DAYS * 24 * 60 * 60 * 1000;
};

export const InstallPrompt = () => {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOS, setShowIOS] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (isStandalone() || wasRecentlyDismissed()) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setHidden(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    // iOS Safari fallback (no beforeinstallprompt)
    if (isIOS()) {
      const t = setTimeout(() => {
        setShowIOS(true);
        setHidden(false);
      }, 1500);
      return () => {
        clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      };
    }

    // Android/Chrome diagnostic: warn if beforeinstallprompt never fires
    const diag = setTimeout(() => {
      if (!deferred) {
        console.info(
          "[Ellennous PWA] beforeinstallprompt não disparou. Verifique: 1) HTTPS ativo, 2) manifest válido em /admin-manifest.webmanifest, 3) service worker registrado em /admin, 4) navegador suporta instalação (Chrome/Edge Android/Desktop)."
        );
      }
    }, 5000);

    return () => {
      clearTimeout(diag);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setHidden(true);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") {
      setHidden(true);
    } else {
      dismiss();
    }
    setDeferred(null);
  };

  if (hidden) return null;

  return (
    <div className="sticky top-0 z-50 bg-gradient-purple-wine/95 backdrop-blur-xl border-b border-primary-glow/30 shadow-glow animate-fade-up">
      <div className="flex items-center gap-3 px-4 py-2.5 max-w-5xl mx-auto">
        <div className="h-8 w-8 rounded-md bg-background/20 flex items-center justify-center flex-shrink-0">
          <Download className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          {showIOS ? (
            <p className="text-[11px] sm:text-xs text-white/95 leading-snug">
              Instale o atelier: toque em <Share className="inline h-3 w-3 mx-0.5" /> Compartilhar → <Plus className="inline h-3 w-3 mx-0.5" /> Adicionar à Tela de Início
            </p>
          ) : (
            <p className="text-[11px] sm:text-xs text-white/95 leading-snug font-accent tracking-wide">
              Instale o Ellennous Atelier no seu celular para acesso rápido
            </p>
          )}
        </div>
        {!showIOS && deferred && (
          <Button
            onClick={install}
            size="sm"
            className="h-8 px-3 bg-white text-primary hover:bg-white/90 rounded-none font-accent tracking-[0.15em] uppercase text-[10px] flex-shrink-0"
          >
            Instalar
          </Button>
        )}
        <button
          onClick={dismiss}
          aria-label="Fechar"
          className="h-8 w-8 flex items-center justify-center text-white/70 hover:text-white transition-colors flex-shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
