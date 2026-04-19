import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useAdminProfile } from "@/hooks/useAdminProfile";
import { PalettePhoto } from "@/components/admin/PalettePhoto";
import { AvatarCropDialog } from "@/components/admin/AvatarCropDialog";
import { Shield, KeyRound, ShieldCheck, ShieldAlert, Save, Loader2, Trash2, Palette, RotateCcw } from "lucide-react";

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

const BUCKET = "gallery";
const FOLDER = "admin-avatars";

// Hex defaults aproximando os tokens de marca (necessário para input[type=color])
const DEFAULT_HEX = ["#8A2AE3", "#B47CFF", "#E11D48", "#1E3A8A", "#F5C518"];
const DOT_LABELS = ["Tinta 1", "Tinta 2", "Tinta 3", "Tinta 4", "Tinta 5"];

export const UserSettings = () => {
  const { user } = useAuth();
  const { profile, refresh } = useAdminProfile();
  const fileRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState("");
  const [paletteHex, setPaletteHex] = useState<string[]>(DEFAULT_HEX);
  const [paletteCustomized, setPaletteCustomized] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);

  useEffect(() => {
    setDisplayName(profile.display_name ?? "");
  }, [profile.display_name]);

  useEffect(() => {
    if (profile.palette_colors && profile.palette_colors.length === 5) {
      setPaletteHex(profile.palette_colors);
      setPaletteCustomized(true);
    } else {
      setPaletteHex(DEFAULT_HEX);
      setPaletteCustomized(false);
    }
  }, [profile.palette_colors]);

  const score = useMemo(() => scorePassword(pwd), [pwd]);
  const strength = STRENGTH[score];
  const initials = useMemo(
    () => (displayName || user?.email || "?").slice(0, 2).toUpperCase(),
    [displayName, user]
  );

  const upsertProfile = async (
    patch: Partial<{
      display_name: string | null;
      avatar_url: string | null;
      avatar_storage_path: string | null;
      palette_colors: string[] | null;
    }>
  ) => {
    if (!user) return { error: new Error("no user") };
    return supabase.from("admin_profile").upsert(
      {
        user_id: user.id,
        display_name: patch.display_name !== undefined ? patch.display_name : profile.display_name,
        avatar_url: patch.avatar_url !== undefined ? patch.avatar_url : profile.avatar_url,
        avatar_storage_path:
          patch.avatar_storage_path !== undefined ? patch.avatar_storage_path : profile.avatar_storage_path,
        palette_colors:
          patch.palette_colors !== undefined ? (patch.palette_colors as any) : (profile.palette_colors as any),
      },
      { onConflict: "user_id" }
    );
  };

  const handlePickFile = () => fileRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      return toast({ title: "Arquivo inválido", description: "Envie uma imagem.", variant: "destructive" });
    }
    if (file.size > 10 * 1024 * 1024) {
      return toast({ title: "Imagem grande demais", description: "Máximo 10MB.", variant: "destructive" });
    }
    const url = URL.createObjectURL(file);
    setCropSrc(url);
  };

  const closeCrop = () => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  };

  const handleCropApply = async (blob: Blob) => {
    if (!user) return;
    setUploading(true);
    try {
      if (profile.avatar_storage_path) {
        await supabase.storage.from(BUCKET).remove([profile.avatar_storage_path]);
      }
      const path = `${FOLDER}/${user.id}-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, {
        cacheControl: "3600",
        upsert: true,
        contentType: "image/jpeg",
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const url = `${pub.publicUrl}?t=${Date.now()}`;
      const { error: dbErr } = await upsertProfile({ avatar_url: url, avatar_storage_path: path });
      if (dbErr) throw dbErr;
      await refresh();
      toast({ title: "Foto atualizada" });
      closeCrop();
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!user || !profile.avatar_url) return;
    setRemoving(true);
    try {
      if (profile.avatar_storage_path) {
        await supabase.storage.from(BUCKET).remove([profile.avatar_storage_path]);
      }
      const { error } = await upsertProfile({ avatar_url: null, avatar_storage_path: null });
      if (error) throw error;
      await refresh();
      toast({ title: "Foto removida" });
    } catch (err: any) {
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" });
    } finally {
      setRemoving(false);
    }
  };

  const handleColorChange = (i: number, value: string) => {
    setPaletteHex((prev) => {
      const next = [...prev];
      next[i] = value;
      return next;
    });
    setPaletteCustomized(true);
  };

  const handleResetPalette = () => {
    setPaletteHex(DEFAULT_HEX);
    setPaletteCustomized(false);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    const { error } = await upsertProfile({
      display_name: displayName.trim() || null,
      palette_colors: paletteCustomized ? paletteHex : null,
    });
    setSavingProfile(false);
    if (error) {
      return toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    }
    await refresh();
    toast({ title: "Perfil atualizado" });
  };

  const handleSubmitPwd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.length < 6) {
      return toast({ title: "Senha muito curta", description: "Mínimo 6 caracteres.", variant: "destructive" });
    }
    if (pwd !== confirm) {
      return toast({ title: "Senhas não conferem", variant: "destructive" });
    }
    setSavingPwd(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setSavingPwd(false);
    if (error) {
      return toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
    setPwd("");
    setConfirm("");
    toast({ title: "Senha atualizada" });
  };

  // Cores usadas na pré-visualização da paleta (ao vivo, antes de salvar)
  const previewColors = paletteCustomized ? paletteHex : null;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Account card */}
      <form onSubmit={handleSaveProfile} className="glass-panel p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-primary/20 blur-[80px] pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row gap-6">
          {/* Palette photo (top-left) */}
          <div className="shrink-0 flex flex-col items-start gap-3">
            <div className="relative">
              <PalettePhoto
                size="lg"
                src={profile.avatar_url ?? undefined}
                initials={initials}
                editable
                onPick={handlePickFile}
                colors={previewColors}
              />
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-full">
                  <Loader2 className="h-5 w-5 animate-spin text-primary-glow" />
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <p className="font-accent text-[9px] tracking-[0.3em] uppercase text-muted-foreground">
              Paleta · clique para trocar
            </p>
            {profile.avatar_url && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemovePhoto}
                disabled={removing}
                className="h-7 px-2 -ml-1 rounded-none font-accent text-[10px] tracking-[0.25em] uppercase text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                {removing ? (
                  <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3 mr-1.5" />
                )}
                Remover foto
              </Button>
            )}
          </div>

          {/* Form */}
          <div className="flex-1 min-w-0 space-y-4">
            <div>
              <p className="font-accent text-[10px] tracking-[0.3em] text-primary-glow/80 uppercase mb-1">
                Administrador
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Shield className="h-3 w-3 text-primary-glow" /> Acesso completo ao atelier
              </p>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="display-name"
                className="font-accent text-[10px] tracking-[0.3em] uppercase text-muted-foreground"
              >
                Nome de exibição
              </Label>
              <Input
                id="display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Como aparecerá na sidebar"
                maxLength={60}
                className="bg-secondary/40 border-border/40 focus-visible:border-primary-glow"
              />
            </div>

            <div className="space-y-2">
              <Label className="font-accent text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
                E-mail
              </Label>
              <Input
                value={user?.email ?? ""}
                readOnly
                disabled
                className="bg-secondary/20 border-border/30"
              />
            </div>

            {/* Palette color pickers */}
            <div className="space-y-3 pt-2 border-t border-border/30">
              <div className="flex items-center justify-between gap-2 pt-3">
                <Label className="font-accent text-[10px] tracking-[0.3em] uppercase text-muted-foreground flex items-center gap-1.5">
                  <Palette className="h-3 w-3 text-primary-glow" /> Cores da paleta
                </Label>
                {paletteCustomized && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleResetPalette}
                    className="h-7 px-2 rounded-none font-accent text-[10px] tracking-[0.25em] uppercase text-muted-foreground hover:text-primary-glow"
                  >
                    <RotateCcw className="h-3 w-3 mr-1.5" /> Padrão
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-5 gap-2">
                {paletteHex.map((hex, i) => (
                  <label
                    key={i}
                    className="flex flex-col items-center gap-1.5 cursor-pointer group"
                    title={DOT_LABELS[i]}
                  >
                    <span
                      className="relative h-9 w-9 rounded-full ring-2 ring-border/40 group-hover:ring-primary-glow/60 transition-all shadow-[0_4px_12px_rgba(0,0,0,0.3)] overflow-hidden"
                      style={{ backgroundColor: hex }}
                    >
                      <span
                        className="absolute top-1 left-1.5 h-1.5 w-1.5 rounded-full bg-white/60"
                        aria-hidden
                      />
                      <input
                        type="color"
                        value={hex}
                        onChange={(e) => handleColorChange(i, e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        aria-label={DOT_LABELS[i]}
                      />
                    </span>
                    <span className="font-accent text-[8px] tracking-[0.2em] uppercase text-muted-foreground">
                      {i + 1}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <Button
              type="submit"
              disabled={savingProfile}
              className="rounded-none font-accent tracking-[0.2em] uppercase text-xs h-11 px-6 bg-gradient-purple-wine hover:opacity-90 shadow-glow"
            >
              {savingProfile ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> Salvando…
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5 mr-2" /> Salvar perfil
                </>
              )}
            </Button>
          </div>
        </div>
      </form>

      {/* Password card */}
      <form onSubmit={handleSubmitPwd} className="glass-panel p-6 sm:p-8 space-y-5">
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
            className="bg-secondary/40 border-border/40 focus-visible:border-primary-glow"
          />
          {confirm && pwd !== confirm && (
            <p className="text-[11px] text-destructive font-accent tracking-[0.15em] uppercase">As senhas não conferem</p>
          )}
        </div>

        <Button
          type="submit"
          disabled={savingPwd || !pwd || pwd !== confirm || score < 1}
          className="rounded-none font-accent tracking-[0.2em] uppercase text-xs h-11 px-6 bg-gradient-purple-wine hover:opacity-90 shadow-glow"
        >
          {savingPwd ? "Salvando…" : "Atualizar senha"}
        </Button>
      </form>
    </div>
  );
};
