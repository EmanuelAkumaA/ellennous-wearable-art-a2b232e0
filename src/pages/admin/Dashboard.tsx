import { useEffect, useState } from "react";
import { AdminShell, type AdminTab } from "@/components/admin/AdminShell";
import { CategoriesManager } from "./CategoriesManager";
import { PiecesManager } from "./PiecesManager";
import { UserSettings } from "./UserSettings";
import { StatsManager } from "./StatsManager";
import { ReviewsManager } from "./ReviewsManager";
import { useAdminBackNavigation } from "@/hooks/useAdminBackNavigation";

const ROOT_TAB: AdminTab = "pieces";

const AdminDashboard = () => {
  const [tab, setTab] = useState<AdminTab>(ROOT_TAB);
  const { selectTab } = useAdminBackNavigation<AdminTab>({
    active: tab,
    onChange: setTab,
    rootTab: ROOT_TAB,
  });

  useEffect(() => {
    document.title = "Atelier · Ellennous Admin";
  }, []);

  return (
    <AdminShell active={tab} onSelect={selectTab}>
      {tab === "pieces" && <PiecesManager />}
      {tab === "categories" && <CategoriesManager />}
      {tab === "reviews" && <ReviewsManager />}
      {tab === "stats" && <StatsManager />}
      {tab === "user" && <UserSettings />}
    </AdminShell>
  );
};

export default AdminDashboard;
