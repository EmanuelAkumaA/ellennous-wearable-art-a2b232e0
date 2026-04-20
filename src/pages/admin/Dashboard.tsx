import { useEffect, useState } from "react";
import { AdminShell, type AdminTab } from "@/components/admin/AdminShell";
import { CategoriesManager } from "./CategoriesManager";
import { PiecesManager } from "./PiecesManager";
import { UserSettings } from "./UserSettings";
import { StatsManager } from "./StatsManager";
import { ReviewsManager } from "./ReviewsManager";

const AdminDashboard = () => {
  const [tab, setTab] = useState<AdminTab>("pieces");

  useEffect(() => {
    document.title = "Atelier · Ellennous Admin";
  }, []);

  return (
    <AdminShell active={tab} onSelect={setTab}>
      {tab === "pieces" && <PiecesManager />}
      {tab === "categories" && <CategoriesManager />}
      {tab === "reviews" && <ReviewsManager />}
      {tab === "stats" && <StatsManager />}
      {tab === "user" && <UserSettings />}
    </AdminShell>
  );
};

export default AdminDashboard;
