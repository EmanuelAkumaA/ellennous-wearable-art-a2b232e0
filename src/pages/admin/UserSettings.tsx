import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Shield, KeyRound, ShieldCheck, ShieldAlert } from "lucide-react";

const scorePassword = (pwd: string): number => {
  if (!pwd) return 0;
  let score = 0;
  if (pwd.length >= 6) score++;
  if (pwd.length >= 10) score++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
  if (/\d/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return Math.min(score, 4);
};

const STRENGTH = [
  { label: "Insegura", color: "bg-destructive", text: "text-destructive" },
  { label: "Fraca", color: "bg-destructive/70", text: "text-destructive" },
  { label: "Média", color: "bg-amber-500", text: "text-amber-400" },
  { label: "Forte", color: "bg-primary", text: "text-primary-glow" },
  { label: "Excelente", color: "bg-primary-glow", text: "text-primary-glow" },
];

export const UserSettings = () => {
  const { user } = useAuth();
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const score = useMemo(() => scorePassword(pwd), [pwd]);
  const strength = STRENGTH[score];
  const initials = useMemo(() => (user?.email ?? "?").slice(0, 2).toUpperCase(), [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.length < 6) {
      return toast({ title: "Senha muito curta", description: "Mínimo 6 caracteres.", variant: "destructive" });
    }
    if (pwd !== confirm) {
      return toast({ title: "Senhas não conferem", variant: "destructive" });
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setSaving(false);
    if (error) {
      return toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
    setPwd("");
    setConfirm("");
    toast({ title: "Senha atualizada" });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Account card */}
      <div className="glass-panel p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-primary/20 blur-[80px] pointer-events-none" />
        <div className="relative flex items-center gap-5">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-gradient-purple-wine blur-md opacity-70" />
            <div className="relative h-16 w-16 rounded-full bg-gradient-purple-wine flex items-center justify-center font-display text-xl text-white shadow-glow">
              {initials}
            </div>
          </div>
          <div className="min-w-0">
            <p className="font-accent text-[10px] tracking-[0.3em] text-primary-glow/80 uppercase mb-1">Administrador</p>
            <h3 className="font-display text-xl truncate">{user?.email}</h3>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
              <Shield className="h-3 w-3 text-primary-glow" /> Acesso completo ao atelier
            </p>
          </div>
        </div>
      </div>

      {/* Password card */}
      <form onSubmit={handleSubmit} className="glass-panel p-6 sm:p-8 space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-border/30">
          <div className="h-9 w-9 rounded-md bg-secondary/60 flex items-center justify-center">
            <KeyRound className="h-4 w-4 text-primary-glow" />
          </div>
          <div>
            <h3 className="font-display text-lg">Alterar senha</h3>
            <p className="text-xs text-muted-foreground">Use ao menos 6 caracteres com letras e números</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="new-pwd" className="font-accent text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
            Nova senha
          </Label>
          <Input
            id="new-pwd"
            type="password"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            minLength={6}
            autoComplete="new-password"
            required
            className="bg-secondary/40 border-border/40 focus-visible:border-primary-glow"
          />

          {pwd && (
            <div className="pt-2 space-y-1.5">
              <div className="flex gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`flex-1 h-1 rounded-full transition-all duration-300 ${
                      i < score ? strength.color : "bg-border/40"
                    }`}
                  />
                ))}
              </div>
              <p className={`text-[11px] font-accent tracking-[0.2em] uppercase flex items-center gap-1.5 ${strength.text}`}>
                {score >= 3 ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
                {strength.label}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm-pwd" className="font-accent text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
            Confirmar nova senha
          </Label>
          <Input
            id="confirm-pwd"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={6}
            autoComplete="new-password"
            required
            className="bg-secondary/40 border-border/40 focus-visible:border-primary-glow"
          />
          {confirm && pwd !== confirm && (
            <p className="text-[11px] text-destructive font-accent tracking-[0.15em] uppercase">As senhas não conferem</p>
          )}
        </div>

        <Button
          type="submit"
          disabled={saving || pwd !== confirm || score < 1}
          className="rounded-none font-accent tracking-[0.2em] uppercase text-xs h-11 px-6 bg-gradient-purple-wine hover:opacity-90 shadow-glow"
        >
          {saving ? "Salvando…" : "Atualizar senha"}
        </Button>
      </form>
    </div>
  );
};
