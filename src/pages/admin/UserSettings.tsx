import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

export const UserSettings = () => {
  const { user } = useAuth();
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

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
    <div className="space-y-8 max-w-xl">
      <div className="border border-border/50 bg-card p-6 space-y-2">
        <p className="font-accent text-xs tracking-[0.4em] text-primary-glow/80 uppercase">Conta</p>
        <h3 className="font-display text-xl">{user?.email}</h3>
      </div>

      <form onSubmit={handleSubmit} className="border border-border/50 bg-card p-6 space-y-4">
        <h3 className="font-display text-xl">Alterar senha</h3>
        <div className="space-y-2">
          <Label htmlFor="new-pwd" className="text-xs uppercase tracking-wider">Nova senha</Label>
          <Input
            id="new-pwd"
            type="password"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            minLength={6}
            autoComplete="new-password"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-pwd" className="text-xs uppercase tracking-wider">Confirmar nova senha</Label>
          <Input
            id="confirm-pwd"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={6}
            autoComplete="new-password"
            required
          />
        </div>
        <Button
          type="submit"
          disabled={saving}
          className="rounded-none font-accent tracking-[0.15em] uppercase text-xs"
        >
          {saving ? "Salvando…" : "Alterar senha"}
        </Button>
      </form>
    </div>
  );
};
