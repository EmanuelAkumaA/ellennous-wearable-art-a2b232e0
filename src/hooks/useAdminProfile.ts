import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface AdminProfile {
  display_name: string | null;
  avatar_url: string | null;
  avatar_storage_path: string | null;
}

const EMPTY: AdminProfile = { display_name: null, avatar_url: null, avatar_storage_path: null };

export const useAdminProfile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<AdminProfile>(EMPTY);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setProfile(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("admin_profile")
      .select("display_name, avatar_url, avatar_storage_path")
      .eq("user_id", user.id)
      .maybeSingle();
    setProfile(data ?? EMPTY);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { profile, loading, refresh };
};
