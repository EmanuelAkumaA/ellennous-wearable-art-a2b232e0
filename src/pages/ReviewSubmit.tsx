import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { z } from "zod";
import { Loader2, Star, Upload, X, Check, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dragon } from "@/components/Dragon";
import { useToast } from "@/hooks/use-toast";

const reviewSchema = z.object({
  client_name: z.string().trim().min(1, "Informe seu nome").max(120, "Máx. 120 caracteres"),
  city: z.string().trim().max(80, "Máx. 80 caracteres").optional(),
  state: z.string().trim().max(40, "Máx. 40 caracteres").optional(),
  instagram: z.string().trim().max(60, "Máx. 60 caracteres").optional(),
  rating: z.number().int().min(1, "Selecione de 1 a 5").max(5),
  content: z.string().trim().min(10, "Conte um pouco mais (mín. 10)").max(2000, "Máx. 2000 caracteres"),
});

type Status = "loading" | "valid" | "invalid" | "submitted";

const reasonText: Record<string, string> = {
  not_found: "Este link de avaliação não existe.",
  revoked: "Este link foi revogado pela Ellennous.",
  used: "Este link já foi utilizado.",
  expired: "Este link expirou.",
  missing_token: "Link inválido.",
  network: "Não foi possível verificar o link. Tente novamente.",
  unknown: "Link inválido.",
};

/* ---------- Shared shell with Ellennous DNA ---------- */
const Shell = ({ children }: { children: React.ReactNode }) => (
  <main className="relative min-h-[100svh] flex items-center justify-center overflow-hidden px-6 py-16 bg-background text-foreground">
    {/* Background layers */}
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ background: "var(--gradient-hero)" }}
      aria-hidden
    />
    <div className="absolute inset-0 splash-bg opacity-30 animate-splash-drift pointer-events-none" aria-hidden />
    <div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-primary/15 blur-[140px] rounded-full pointer-events-none" aria-hidden />
    <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-accent-red/10 blur-[140px] rounded-full pointer-events-none" aria-hidden />
    <div className="absolute inset-0 flex items-center justify-start pointer-events-none opacity-[0.05]" aria-hidden>
      <Dragon className="w-[700px] h-[700px] -ml-40" />
    </div>

    {/* Content card */}
    <div className="relative z-10 w-full max-w-xl">
      <div className="bg-background/60 backdrop-blur-sm border border-primary/15 shadow-elegant px-6 py-10 md:px-10 md:py-12 rounded-none">
        {children}
      </div>
      <p className="mt-6 text-center font-accent text-[10px] tracking-[0.4em] uppercase text-muted-foreground/60">
        Ellennous · Arte Vestível
      </p>
    </div>
  </main>
);

const inputCls =
  "rounded-none h-12 bg-background/40 border-border/60 focus-visible:border-primary-glow focus-visible:ring-primary/30";
const labelCls = "font-accent text-[11px] tracking-[0.3em] uppercase text-foreground/70";

const ReviewSubmit = () => {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const isPreview = token === "preview";
  const [status, setStatus] = useState<Status>("loading");
  const [reason, setReason] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [instagram, setInstagram] = useState("");
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [content, setContent] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Avaliação · Ellennous";
    if (isPreview) {
      setStatus("valid");
      return;
    }
    if (!token) {
      setStatus("invalid");
      setReason("missing_token");
      return;
    }
    const url = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/submit-review?token=${encodeURIComponent(token)}`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (data.valid) setStatus("valid");
        else {
          setStatus("invalid");
          setReason(data.reason ?? "unknown");
        }
      })
      .catch(() => {
        setStatus("invalid");
        setReason("network");
      });
  }, [token, isPreview]);

  const handlePhoto = (file: File | null) => {
    if (!file) {
      setPhotoFile(null);
      setPhotoPreview(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast({ title: "Arquivo inválido", description: "Envie uma imagem.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Foto muito grande", description: "Limite de 5MB.", variant: "destructive" });
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = reviewSchema.safeParse({
      client_name: name,
      city: city || undefined,
      state: state || undefined,
      instagram: instagram || undefined,
      rating,
      content,
    });
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      toast({ title: "Verifique o formulário", description: first.message, variant: "destructive" });
      return;
    }

    if (isPreview) {
      toast({ title: "Modo demonstração", description: "Nada foi enviado — esta é só uma prévia." });
      return;
    }

    setSubmitting(true);
    try {
      let photo_url: string | null = null;
      let photo_storage_path: string | null = null;

      if (photoFile && token) {
        const ext = photoFile.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `public/${token}-${Date.now()}.${ext}`;
        const up = await supabase.storage
          .from("reviews")
          .upload(path, photoFile, { contentType: photoFile.type, upsert: false });
        if (up.error) throw new Error(`Falha no upload da foto: ${up.error.message}`);
        photo_storage_path = path;
        photo_url = supabase.storage.from("reviews").getPublicUrl(path).data.publicUrl;
      }

      const url = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/submit-review`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          client_name: parsed.data.client_name,
          city: parsed.data.city ?? null,
          state: parsed.data.state ?? null,
          instagram: parsed.data.instagram ?? null,
          rating: parsed.data.rating,
          content: parsed.data.content,
          photo_url,
          photo_storage_path,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const map: Record<string, string> = {
          invite_used: "Este link já foi utilizado.",
          invite_expired: "Este link expirou.",
          invite_revoked: "Este link foi revogado.",
          invite_not_found: "Link não encontrado.",
          invalid_payload: "Dados inválidos. Verifique o formulário.",
          insert_failed: "Não foi possível registrar sua avaliação.",
        };
        throw new Error(map[data.error] ?? "Erro ao enviar.");
      }
      setStatus("submitted");
    } catch (err: any) {
      toast({ title: "Não foi possível enviar", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  /* -------- LOADING -------- */
  if (status === "loading") {
    return (
      <Shell>
        <div className="text-center space-y-5 py-8">
          <div className="mx-auto w-14 h-14 rounded-full border border-primary-glow/40 flex items-center justify-center shadow-glow">
            <Loader2 className="h-6 w-6 animate-spin text-primary-glow" />
          </div>
          <p className="font-accent text-[10px] tracking-[0.4em] uppercase text-primary-glow">
            Verificando convite…
          </p>
        </div>
      </Shell>
    );
  }

  /* -------- INVALID -------- */
  if (status === "invalid") {
    return (
      <Shell>
        <div className="text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full border border-destructive/50 flex items-center justify-center shadow-red-glow">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>
          <p className="font-accent text-[10px] tracking-[0.4em] uppercase text-destructive">
            Convite indisponível
          </p>
          <h1 className="font-display text-4xl md:text-5xl text-gradient-light">Não foi possível abrir</h1>
          <div className="w-12 h-px bg-primary-glow/40 mx-auto" />
          <p className="text-foreground/70 leading-relaxed">
            {reasonText[reason ?? "unknown"] ?? reasonText.unknown}
          </p>
          <Button
            asChild
            variant="outline"
            className="font-accent text-sm border-foreground/20 hover:border-primary-glow hover:bg-transparent hover:text-primary-glow tracking-[0.2em] uppercase h-12 rounded-none bg-background/40 backdrop-blur"
          >
            <Link to="/">Voltar ao site</Link>
          </Button>
        </div>
      </Shell>
    );
  }

  /* -------- SUBMITTED -------- */
  if (status === "submitted") {
    return (
      <Shell>
        <div className="text-center space-y-6">
          <div className="mx-auto w-20 h-20 rounded-full bg-primary/15 border border-primary-glow/50 flex items-center justify-center shadow-glow">
            <Check className="h-9 w-9 text-primary-glow" />
          </div>
          <p className="font-accent text-[10px] tracking-[0.4em] uppercase text-primary-glow">
            Ellennous · Recebido
          </p>
          <h1 className="font-display text-4xl md:text-5xl text-gradient-light">
            Obrigado por compartilhar
          </h1>
          <div className="w-12 h-px bg-primary-glow/40 mx-auto" />
          <p className="text-foreground/70 leading-relaxed">
            Sua avaliação foi recebida e aparecerá no site após aprovação.
          </p>
          <Button
            asChild
            variant="outline"
            className="font-accent text-sm border-foreground/20 hover:border-primary-glow hover:bg-transparent hover:text-primary-glow tracking-[0.2em] uppercase h-12 rounded-none bg-background/40 backdrop-blur"
          >
            <Link to="/">Voltar ao site</Link>
          </Button>
        </div>
      </Shell>
    );
  }

  /* -------- VALID (form) -------- */
  return (
    <Shell>
      <form onSubmit={handleSubmit} className="space-y-7">
        {isPreview && (
          <div className="border border-primary-glow/30 bg-primary/5 px-4 py-3 text-center rounded-none">
            <p className="font-accent text-[10px] tracking-[0.3em] uppercase text-primary-glow">
              Modo demonstração
            </p>
            <p className="text-xs text-foreground/60 mt-1">
              Esta é uma prévia da página de avaliação — nada será enviado.
            </p>
          </div>
        )}

        <div className="text-center space-y-3 mb-2">
          <p className="font-accent text-[10px] tracking-[0.4em] uppercase text-primary-glow">
            Ellennous · Avaliação{isPreview && " · Prévia"}
          </p>
          <h1 className="font-display text-4xl md:text-5xl text-gradient-light leading-tight">
            Conte sua experiência
          </h1>
          <div className="w-12 h-px bg-primary-glow/50 mx-auto" />
          <p className="text-foreground/70 leading-relaxed">
            Sua palavra ajuda a contar quem somos.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="name" className={labelCls}>Seu nome *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            placeholder="Como devemos te chamar"
            required
            className={inputCls}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-4">
          <div className="space-y-2">
            <Label htmlFor="city" className={labelCls}>Cidade (opcional)</Label>
            <Input
              id="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              maxLength={80}
              placeholder="Ex: São Paulo"
              className={inputCls}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state" className={labelCls}>Estado</Label>
            <Input
              id="state"
              value={state}
              onChange={(e) => setState(e.target.value.toUpperCase())}
              maxLength={2}
              placeholder="SP"
              className={inputCls}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="instagram" className={labelCls}>Instagram (opcional)</Label>
          <Input
            id="instagram"
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            maxLength={60}
            placeholder="@seu.user"
            className={inputCls}
          />
        </div>

        <div className="space-y-3 text-center">
          <Label className={`${labelCls} block`}>Sua nota *</Label>
          <div className="flex gap-1.5 justify-center">
            {[1, 2, 3, 4, 5].map((i) => {
              const active = i <= (hover || rating);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setRating(i)}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(0)}
                  className="p-1 transition-transform hover:scale-110"
                  aria-label={`${i} estrela${i > 1 ? "s" : ""}`}
                >
                  <Star
                    className={`h-9 w-9 transition-all ${
                      active
                        ? "fill-primary-glow text-primary-glow drop-shadow-[0_0_10px_hsl(var(--primary-glow)/0.6)]"
                        : "text-muted-foreground/30"
                    }`}
                    strokeWidth={1.5}
                  />
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="content" className={labelCls}>Seu depoimento *</Label>
          <Textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={2000}
            rows={6}
            placeholder="Conte como foi vestir uma peça Ellennous…"
            required
            className="rounded-none bg-background/40 border-border/60 focus-visible:border-primary-glow focus-visible:ring-primary/30 resize-none"
          />
          <p className="text-[10px] text-muted-foreground text-right font-accent tracking-[0.2em]">
            {content.length}/2000
          </p>
        </div>

        <div className="space-y-3">
          <Label className={labelCls}>Foto (opcional)</Label>
          <div className="border border-primary-glow/25 bg-primary/5 px-4 py-3 rounded-none">
            <p className="text-xs text-foreground/80 leading-relaxed">
              ✨ <span className="font-medium text-primary-glow">Poste uma foto sua vestindo a peça</span> e ganhe{" "}
              <span className="font-semibold text-primary-glow">10% de desconto</span> na sua próxima compra.
            </p>
          </div>
          <div className="flex items-center gap-4">
            {photoPreview ? (
              <div className="relative">
                <img
                  src={photoPreview}
                  alt="Prévia"
                  className="h-20 w-20 rounded-full object-cover border border-primary-glow/40 shadow-glow"
                />
                <button
                  type="button"
                  onClick={() => handlePhoto(null)}
                  className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:scale-110 transition-transform"
                  aria-label="Remover foto"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="h-20 w-20 rounded-full border border-dashed border-primary-glow/30 flex items-center justify-center text-muted-foreground bg-background/40">
                <Upload className="h-5 w-5" />
              </div>
            )}
            <div className="flex-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileRef.current?.click()}
                className="font-accent text-xs border-foreground/20 hover:border-primary-glow hover:bg-transparent hover:text-primary-glow tracking-[0.2em] uppercase h-11 rounded-none bg-background/40 backdrop-blur"
              >
                {photoFile ? "Trocar foto" : "Escolher foto"}
              </Button>
              <p className="text-[10px] text-muted-foreground mt-2 font-accent tracking-[0.15em] uppercase">
                JPG / PNG · até 5MB
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handlePhoto(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
        </div>

        <Button
          type="submit"
          disabled={submitting}
          className="font-accent text-base bg-gradient-purple-wine border border-primary-glow/40 hover:shadow-glow text-white tracking-[0.2em] uppercase h-14 rounded-none w-full transition-all"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Enviando…
            </>
          ) : isPreview ? (
            "Enviar (modo prévia)"
          ) : (
            "Enviar avaliação"
          )}
        </Button>
      </form>
    </Shell>
  );
};

export default ReviewSubmit;
