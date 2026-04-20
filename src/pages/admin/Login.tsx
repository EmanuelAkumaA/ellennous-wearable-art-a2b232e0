import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Lock, Mail, ArrowLeft, Sparkles, Eye, EyeOff } from "lucide-react";
import brandIcon from "@/assets/brand-icon.png";

const schema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(6, "Mínimo 6 caracteres").max(72),
});

type Mode = "signin" | "signup";

const REMEMBER_KEY = "ellennous_remember_email";

const AdminLogin = () => {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Acesso · Ellennous Admin";
    const saved = localStorage.getItem(REMEMBER_KEY);
    if (saved) {
      setEmail(saved);
      setRemember(true);
    }
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
      // Persistir email se "lembrar" marcado
      if (remember) {
        localStorage.setItem(REMEMBER_KEY, parsed.data.email);
      } else {
        localStorage.removeItem(REMEMBER_KEY);
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
              src={brandIcon}
              alt="Ellennous"
              className="relative h-20 w-20 object-contain drop-shadow-[0_0_24px_hsl(var(--primary-glow)/0.6)]"
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
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="pl-10 pr-10 bg-secondary/40 border-border/40 focus-visible:border-primary-glow focus-visible:ring-primary/30"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 hover:text-primary-glow transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Checkbox
              id="remember"
              checked={remember}
              onCheckedChange={(v) => setRemember(v === true)}
              className="border-border/60 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
            <Label
              htmlFor="remember"
              className="text-[11px] text-muted-foreground font-accent tracking-[0.15em] uppercase cursor-pointer select-none"
            >
              Lembrar neste dispositivo
            </Label>
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
