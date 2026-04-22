/**
 * Cross-tab + cross-click execution lock.
 *
 * Wraps the Web Locks API (`navigator.locks`) with `ifAvailable: true` so the
 * second caller never blocks — it just gets `false` and can show a toast.
 *
 * Falls back to a module-local Set when `navigator.locks` is unavailable
 * (older Safari). The fallback obviously can't coordinate across tabs, but
 * it still prevents same-tab double execution.
 */

type LockName = "optimizer:bulk" | "optimizer:backfill";

const localLocks = new Set<LockName>();

export interface LockResult {
  /** True when we acquired the lock and the work ran. */
  acquired: boolean;
  /** True when the fallback (no `navigator.locks`) was used. */
  fallback: boolean;
}

const hasWebLocks = (): boolean =>
  typeof navigator !== "undefined" &&
  typeof (navigator as Navigator & { locks?: LockManager }).locks?.request === "function";

/**
 * Run `work` while holding `name`. If the lock is already held (any tab),
 * resolves immediately with `{ acquired: false }` without invoking `work`.
 */
export const runWithLock = async (
  name: LockName,
  work: () => Promise<void>,
): Promise<LockResult> => {
  if (hasWebLocks()) {
    let acquired = false;
    await navigator.locks.request(name, { ifAvailable: true }, async (lock) => {
      if (!lock) return;
      acquired = true;
      await work();
    });
    return { acquired, fallback: false };
  }

  // Fallback: same-tab guard only.
  if (localLocks.has(name)) return { acquired: false, fallback: true };
  localLocks.add(name);
  try {
    await work();
    return { acquired: true, fallback: true };
  } finally {
    localLocks.delete(name);
  }
};
