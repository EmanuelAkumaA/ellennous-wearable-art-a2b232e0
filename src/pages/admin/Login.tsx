import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Lock, Mail, ArrowLeft, Sparkles } from "lucide-react";
import logo from "@/assets/logo-ellennous.svg";

const schema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(6, "Mínimo 6 caracteres").max(72),
});

type Mode = "signin" | "signup";

const AdminLogin = () => {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Acesso · Ellennous Admin";
  }, []);

  useEffect(() => {
    if (!loading && user && isAdmin) navigate("/admin", { replace: true });
  }, [loading, user, isAdmin, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      toast({ title: "Dados inválidos", description: parsed.error.issues[0].message, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "signup") {
        const redirectUrl = `${window.location.origin}/admin`;
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: { emailRedirectTo: redirectUrl },
        });
        if (error) throw error;
        toast({ title: "Conta criada", description: "Verifique seu e-mail caso confirmação esteja ativada." });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) throw error;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast({ title: "Falha na autenticação", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen relative flex items-center justify-center px-6 py-16 overflow-hidden">
      {/* Atmosphere */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 admin-bg-grid opacity-40" />
        <div className="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-primary/20 blur-[140px] animate-orb-drift" />
        <div
          className="absolute bottom-[-15%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-brand-red/15 blur-[140px] animate-orb-drift"
          style={{ animationDelay: "-6s" }}
        />
        <div className="absolute inset-0 grain opacity-40" />
      </div>

      <div className="w-full max-w-md relative">
        {/* Logo + tag */}
        <div className="flex flex-col items-center mb-10 animate-fade-up">
          <div className="relative mb-5">
            <div className="absolute inset-0 rounded-full bg-primary/40 blur-2xl animate-pulse-glow" />
            <img
              src={logo}
              alt="Ellennous"
              className="relative h-16 w-16 rounded-full ring-1 ring-primary/40 shadow-glow"
            />
          </div>
          <p className="font-accent text-[10px] tracking-[0.5em] text-primary-glow/80 uppercase mb-3 flex items-center gap-2">
            <Sparkles className="h-3 w-3" /> Atelier interno
          </p>
          <h1 className="font-display text-3xl md:text-4xl text-center text-gradient-light">Acesso restrito</h1>
          <p className="text-xs text-muted-foreground mt-2 text-center max-w-xs">
            Painel administrativo da galeria Ellennous
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="glass-panel p-8 space-y-5 shadow-elegant animate-fade-up"
          style={{ animationDelay: "0.15s" }}
        >
          <div className="space-y-2">
            <Label htmlFor="email" className="font-accent text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
              E-mail
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 pointer-events-none" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="pl-10 bg-secondary/40 border-border/40 focus-visible:border-primary-glow focus-visible:ring-primary/30"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="password"
              className="font-accent text-[10px] tracking-[0.3em] uppercase text-muted-foreground"
            >
              Senha
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 pointer-events-none" />
              <Input
                id="password"
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="pl-10 bg-secondary/40 border-border/40 focus-visible:border-primary-glow focus-visible:ring-primary/30"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full font-accent tracking-[0.25em] uppercase rounded-none h-12 bg-gradient-purple-wine hover:opacity-90 shadow-glow transition-opacity"
          >
            {submitting ? "Aguarde…" : mode === "signin" ? "Entrar" : "Criar conta"}
          </Button>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-3 border-t border-border/30">
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="hover:text-primary-glow transition-colors font-accent tracking-[0.15em] uppercase"
            >
              {mode === "signin" ? "Criar primeira conta" : "Já tenho conta"}
            </button>
            <Link
              to="/"
              className="hover:text-primary-glow transition-colors flex items-center gap-1 font-accent tracking-[0.15em] uppercase"
            >
              <ArrowLeft className="h-3 w-3" /> Voltar
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
};

export default AdminLogin;
