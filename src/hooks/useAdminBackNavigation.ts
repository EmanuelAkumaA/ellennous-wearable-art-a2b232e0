import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

const isStandalone = () => {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  // @ts-expect-error iOS Safari
  if (window.navigator.standalone === true) return true;
  return false;
};

const SENTINEL_KEY = "__adminNav";

interface Options<T extends string> {
  active: T;
  onChange: (tab: T) => void;
  rootTab: T;
}

/**
 * Smart back-button handling for the admin PWA.
 *
 * - Tracks an internal stack of visited tabs.
 * - Device back button pops the stack (returns to previous tab) without exiting.
 * - When the stack is at the root, shows a toast + haptic vibration asking
 *   for a second press to actually exit the app.
 * - Only active in PWA standalone mode; in a normal browser, behaves natively.
 */
export const useAdminBackNavigation = <T extends string>({
  active,
  onChange,
  rootTab,
}: Options<T>) => {
  const stackRef = useRef<T[]>([rootTab]);
  const pendingExitRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastIdRef = useRef<string | number | null>(null);
  const enabledRef = useRef(false);
  const onChangeRef = useRef(onChange);
  const programmaticRef = useRef(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const resetPendingExit = useCallback(() => {
    pendingExitRef.current = false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (toastIdRef.current !== null) {
      toast.dismiss(toastIdRef.current);
      toastIdRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isStandalone()) return;

    enabledRef.current = true;

    // Seed sentinel for the root tab.
    window.history.pushState({ [SENTINEL_KEY]: rootTab }, "", window.location.href);

    const handlePopState = () => {
      const stack = stackRef.current;

      if (stack.length > 1) {
        // Pop the current tab and switch to the previous one.
        stack.pop();
        const previous = stack[stack.length - 1];
        resetPendingExit();
        programmaticRef.current = true;
        onChangeRef.current(previous);
        // Repose sentinel so the next back press is also intercepted.
        window.history.pushState({ [SENTINEL_KEY]: previous }, "", window.location.href);
        return;
      }

      // At root — handle exit confirmation.
      if (pendingExitRef.current) {
        resetPendingExit();
        try {
          window.close();
        } catch {
          /* noop */
        }
        window.history.go(-1);
        return;
      }

      pendingExitRef.current = true;
      try {
        navigator.vibrate?.(40);
      } catch {
        /* noop */
      }
      toastIdRef.current = toast("Aperte voltar novamente para sair do aplicativo", {
        duration: 2000,
        position: "bottom-center",
      });
      window.history.pushState({ [SENTINEL_KEY]: rootTab }, "", window.location.href);
      timerRef.current = setTimeout(() => {
        pendingExitRef.current = false;
        timerRef.current = null;
        toastIdRef.current = null;
      }, 2000);
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      enabledRef.current = false;
      window.removeEventListener("popstate", handlePopState);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (toastIdRef.current !== null) toast.dismiss(toastIdRef.current);
    };
  }, [rootTab, resetPendingExit]);

  /**
   * Wraps the tab setter: pushes the new tab onto the stack and adds a
   * sentinel history entry so the device back button can pop it.
   */
  const selectTab = useCallback(
    (tab: T) => {
      if (tab === active) return;

      // Reset any pending exit confirmation when the user navigates via UI.
      if (pendingExitRef.current) resetPendingExit();

      onChangeRef.current(tab);

      if (!enabledRef.current) return;
      if (programmaticRef.current) {
        // Triggered by popstate — don't push, stack already updated.
        programmaticRef.current = false;
        return;
      }

      const stack = stackRef.current;
      // Avoid stacking duplicates if the same tab is somehow reselected.
      if (stack[stack.length - 1] !== tab) {
        stack.push(tab);
        window.history.pushState({ [SENTINEL_KEY]: tab }, "", window.location.href);
      }
    },
    [active, resetPendingExit]
  );

  return { selectTab };
};
