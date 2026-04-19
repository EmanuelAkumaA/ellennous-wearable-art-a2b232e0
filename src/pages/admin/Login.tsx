import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

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
    document.title = "Admin · Ellennous";
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
    <main className="min-h-screen flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <p className="font-accent text-xs tracking-[0.4em] text-primary-glow/80 uppercase mb-3">Admin</p>
          <h1 className="font-display text-3xl md:text-4xl">Acesso restrito</h1>
        </div>
        <form onSubmit={onSubmit} className="space-y-5 border border-border/50 bg-card p-8">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <Button type="submit" disabled={submitting} className="w-full font-accent tracking-[0.2em] uppercase rounded-none h-12">
            {submitting ? "Aguarde…" : mode === "signin" ? "Entrar" : "Criar conta"}
          </Button>
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
            <button type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="hover:text-foreground transition-colors">
              {mode === "signin" ? "Criar primeira conta admin" : "Já tenho conta"}
            </button>
            <Link to="/" className="hover:text-foreground transition-colors">← Voltar</Link>
          </div>
        </form>
      </div>
    </main>
  );
};

export default AdminLogin;
