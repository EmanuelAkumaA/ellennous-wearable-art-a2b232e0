import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground font-accent text-sm tracking-[0.2em] uppercase">
        Carregando…
      </div>
    );
  }

  if (!user) return <Navigate to="/admin/login" replace />;
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="font-display text-2xl">Acesso restrito</p>
        <p className="text-muted-foreground text-sm">Sua conta não tem permissão de administrador.</p>
      </div>
    );
  }

  return <>{children}</>;
};
