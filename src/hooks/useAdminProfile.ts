import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface AdminProfile {
  display_name: string | null;
  avatar_url: string | null;
  avatar_storage_path: string | null;
  palette_colors: string[] | null;
}

const EMPTY: AdminProfile = {
  display_name: null,
  avatar_url: null,
  avatar_storage_path: null,
  palette_colors: null,
};

// ---- Singleton store (shared across all consumers) ----
let state: AdminProfile = EMPTY;
let currentUserId: string | null = null;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
const getSnapshot = () => state;

const fetchProfile = async (userId: string | null) => {
  currentUserId = userId;
  if (!userId) {
    state = EMPTY;
    emit();
    return;
  }
  const { data } = await supabase
    .from("admin_profile")
    .select("display_name, avatar_url, avatar_storage_path, palette_colors")
    .eq("user_id", userId)
    .maybeSingle();

  const colors = (data?.palette_colors as unknown as string[] | null) ?? null;
  state = data
    ? {
        display_name: data.display_name,
        avatar_url: data.avatar_url,
        avatar_storage_path: data.avatar_storage_path,
        palette_colors: Array.isArray(colors) && colors.length === 5 ? colors : null,
      }
    : EMPTY;
  emit();
};

export const useAdminProfile = () => {
  const { user } = useAuth();
  const profile = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    const uid = user?.id ?? null;
    if (uid !== currentUserId) {
      inflight = fetchProfile(uid);
    } else if (uid && state === EMPTY && !inflight) {
      inflight = fetchProfile(uid);
    }
    inflight?.finally(() => {
      inflight = null;
    });
  }, [user?.id]);

  const refresh = async () => {
    await fetchProfile(user?.id ?? null);
  };

  return { profile, refresh };
};
