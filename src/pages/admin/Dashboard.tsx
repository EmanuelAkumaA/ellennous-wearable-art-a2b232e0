import { useEffect, useState } from "react";
import { AdminShell, type AdminTab } from "@/components/admin/AdminShell";
import { CategoriesManager } from "./CategoriesManager";
import { PiecesManager } from "./PiecesManager";
import { UserSettings } from "./UserSettings";
import { StatsManager } from "./StatsManager";
import { ReviewsManager } from "./ReviewsManager";
import { ImageConverter } from "./ImageConverter";
import { useAdminBackNavigation } from "@/hooks/useAdminBackNavigation";

const ROOT_TAB: AdminTab = "pieces";
const STORAGE_KEY = "ellennous:admin:lastTab";
const VALID_TABS: AdminTab[] = ["pieces", "categories", "reviews", "stats", "converter", "user"];

const readStoredTab = (): AdminTab => {
  if (typeof window === "undefined") return ROOT_TAB;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && (VALID_TABS as string[]).includes(stored)) {
      return stored as AdminTab;
    }
  } catch {
    /* ignore storage errors (private mode, etc.) */
  }
  return ROOT_TAB;
};

const AdminDashboard = () => {
  const [tab, setTab] = useState<AdminTab>(readStoredTab);
  const { selectTab } = useAdminBackNavigation<AdminTab>({
    active: tab,
    onChange: setTab,
    rootTab: ROOT_TAB,
  });

  useEffect(() => {
    document.title = "Atelier · Ellennous Admin";
  }, []);

  // Persist last active tab so the admin reopens on the same section.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, tab);
    } catch {
      /* ignore */
    }
  }, [tab]);

  return (
    <AdminShell active={tab} onSelect={selectTab}>
      {tab === "pieces" && <PiecesManager />}
      {tab === "categories" && <CategoriesManager />}
      {tab === "reviews" && <ReviewsManager />}
      {tab === "stats" && <StatsManager />}
      {tab === "converter" && <ImageConverter />}
      {tab === "user" && <UserSettings />}
    </AdminShell>
  );
};

export default AdminDashboard;
