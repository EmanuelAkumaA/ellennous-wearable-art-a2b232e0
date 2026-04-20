import { useEffect, useRef } from "react";
import { toast } from "sonner";

const isStandalone = () => {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  // @ts-expect-error iOS Safari
  if (window.navigator.standalone === true) return true;
  return false;
};

/**
 * In a PWA (standalone), intercepts the device back button on the root admin
 * page and asks the user to press back a second time to exit the app.
 */
export const useBackButtonExitConfirm = () => {
  const pendingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastIdRef = useRef<string | number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isStandalone()) return;

    // Push a sentinel state so the first back press fires popstate without leaving the app.
    window.history.pushState({ __exitSentinel: true }, "", window.location.href);

    const resetPending = () => {
      pendingRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (toastIdRef.current !== null) {
        toast.dismiss(toastIdRef.current);
        toastIdRef.current = null;
      }
    };

    const handlePopState = () => {
      if (pendingRef.current) {
        // Second back press within window — exit the app.
        resetPending();
        try {
          window.close();
        } catch {
          /* noop */
        }
        // Fallback: navigate back beyond our sentinel to leave the PWA scope.
        window.history.go(-1);
        return;
      }

      pendingRef.current = true;
      toastIdRef.current = toast("Aperte voltar novamente para sair do aplicativo", {
        duration: 2000,
        position: "bottom-center",
      });

      // Re-add the sentinel so the next back press is also intercepted.
      window.history.pushState({ __exitSentinel: true }, "", window.location.href);

      timerRef.current = setTimeout(() => {
        pendingRef.current = false;
        timerRef.current = null;
        toastIdRef.current = null;
      }, 2000);
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (toastIdRef.current !== null) toast.dismiss(toastIdRef.current);
    };
  }, []);
};
