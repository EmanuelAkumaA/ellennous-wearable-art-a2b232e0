import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Share, Plus } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  // @ts-expect-error iOS Safari
  window.navigator.standalone === true;

const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) && !/CriOS|FxiOS/i.test(navigator.userAgent);

export const InstallPrompt = () => {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return isStandalone();
  });
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (installed) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };

    const mql = window.matchMedia("(display-mode: standalone)");
    const onDisplayChange = () => {
      if (mql.matches) setInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    mql.addEventListener?.("change", onDisplayChange);

    if (isIOS()) setIosHint(true);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      mql.removeEventListener?.("change", onDisplayChange);
    };
  }, [installed]);

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") {
      setInstalled(true);
    }
    setDeferred(null);
  };

  if (installed) return null;

  return (
    <div className="sticky top-0 z-50 bg-gradient-purple-wine/95 backdrop-blur-xl border-b border-primary-glow/30 shadow-glow animate-fade-up">
      <div className="flex items-center gap-3 px-4 py-2.5 max-w-5xl mx-auto">
        <div className="h-8 w-8 rounded-md bg-background/20 flex items-center justify-center flex-shrink-0">
          <Download className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          {iosHint && !deferred ? (
            <p className="text-[11px] sm:text-xs text-white/95 leading-snug">
              Instale o atelier: toque em <Share className="inline h-3 w-3 mx-0.5" /> Compartilhar → <Plus className="inline h-3 w-3 mx-0.5" /> Adicionar à Tela de Início
            </p>
          ) : (
            <p className="text-[11px] sm:text-xs text-white/95 leading-snug font-accent tracking-wide">
              Instale o Ellennous Atelier no seu celular para acesso rápido
            </p>
          )}
        </div>
        {deferred && (
          <Button
            onClick={install}
            size="sm"
            className="h-8 px-3 bg-white text-primary hover:bg-white/90 rounded-none font-accent tracking-[0.15em] uppercase text-[10px] flex-shrink-0"
          >
            Instalar
          </Button>
        )}
      </div>
    </div>
  );
};
