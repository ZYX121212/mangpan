type StorageProvider = () => Pick<Storage, "getItem" | "setItem" | "removeItem">;

const PROBE_KEY = "__blind_trading_storage_probe__";

export function createSafeStorage(provider: StorageProvider) {
  const memory = new Map<string, string>();
  let persistent:
    | Pick<Storage, "getItem" | "setItem" | "removeItem">
    | null
    | undefined;

  const resolvePersistent = () => {
    if (persistent !== undefined) return persistent;
    try {
      const candidate = provider();
      candidate.setItem(PROBE_KEY, "1");
      candidate.removeItem(PROBE_KEY);
      persistent = candidate;
    } catch {
      persistent = null;
    }
    return persistent;
  };

  return {
    getItem(key: string) {
      try {
        const value = resolvePersistent()?.getItem(key) ?? null;
        if (value !== null) memory.set(key, value);
        return value ?? memory.get(key) ?? null;
      } catch {
        persistent = null;
        return memory.get(key) ?? null;
      }
    },
    setItem(key: string, value: string) {
      memory.set(key, value);
      try {
        resolvePersistent()?.setItem(key, value);
      } catch {
        persistent = null;
      }
    },
    removeItem(key: string) {
      memory.delete(key);
      try {
        resolvePersistent()?.removeItem(key);
      } catch {
        persistent = null;
      }
    },
    isPersistent() {
      return Boolean(resolvePersistent());
    },
  };
}

export const safeLocalStorage = createSafeStorage(() => globalThis.localStorage);
