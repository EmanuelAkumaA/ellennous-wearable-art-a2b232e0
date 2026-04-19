import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { CategoriesManager } from "./CategoriesManager";
import { PiecesManager } from "./PiecesManager";

const AdminDashboard = () => {
  const { user, signOut } = useAuth();

  useEffect(() => {
    document.title = "Admin Galeria · Ellennous";
  }, []);

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-wrap items-center justify-between gap-4 mb-10">
          <div>
            <p className="font-accent text-xs tracking-[0.4em] text-primary-glow/80 uppercase mb-2">Admin</p>
            <h1 className="font-display text-3xl">Galeria</h1>
            <p className="text-xs text-muted-foreground mt-1">{user?.email}</p>
          </div>
          <div className="flex gap-3">
            <Button asChild variant="outline" className="rounded-none font-accent tracking-[0.15em] uppercase text-xs">
              <Link to="/">Ver site</Link>
            </Button>
            <Button onClick={signOut} variant="ghost" className="rounded-none font-accent tracking-[0.15em] uppercase text-xs">
              Sair
            </Button>
          </div>
        </header>

        <Tabs defaultValue="pieces" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 rounded-none">
            <TabsTrigger value="pieces" className="rounded-none font-accent tracking-[0.15em] uppercase text-xs">Obras</TabsTrigger>
            <TabsTrigger value="categories" className="rounded-none font-accent tracking-[0.15em] uppercase text-xs">Categorias</TabsTrigger>
          </TabsList>
          <TabsContent value="pieces" className="mt-8">
            <PiecesManager />
          </TabsContent>
          <TabsContent value="categories" className="mt-8">
            <CategoriesManager />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
};

export default AdminDashboard;
