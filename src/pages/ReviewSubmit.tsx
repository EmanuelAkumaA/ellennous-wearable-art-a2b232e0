import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { z } from "zod";
import { Loader2, Star, Upload, X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const reviewSchema = z.object({
  client_name: z.string().trim().min(1, "Informe seu nome").max(120, "Máx. 120 caracteres"),
  client_role: z.string().trim().max(60, "Máx. 60 caracteres").optional(),
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

const ReviewSubmit = () => {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const isPreview = token === "preview";
  const [status, setStatus] = useState<Status>("loading");
  const [reason, setReason] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [role, setRole] = useState("");
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
      client_role: role || undefined,
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
          client_role: parsed.data.client_role ?? null,
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

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16 bg-background text-foreground">
      <div className="max-w-xl w-full">
        {status === "loading" && (
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary-glow" />
            <p className="font-accent text-xs tracking-[0.3em] uppercase text-muted-foreground">
              Verificando convite…
            </p>
          </div>
        )}

        {status === "invalid" && (
          <div className="text-center space-y-4">
            <p className="font-accent text-[10px] tracking-[0.4em] uppercase text-destructive">
              Convite indisponível
            </p>
            <h1 className="font-display text-3xl">Não foi possível abrir</h1>
            <p className="text-sm text-muted-foreground">
              {reasonText[reason ?? "unknown"] ?? reasonText.unknown}
            </p>
          </div>
        )}

        {status === "submitted" && (
          <div className="text-center space-y-5">
            <div className="mx-auto w-14 h-14 rounded-full bg-primary/15 border border-primary-glow/40 flex items-center justify-center">
              <Check className="h-7 w-7 text-primary-glow" />
            </div>
            <p className="font-accent text-[10px] tracking-[0.4em] uppercase text-primary-glow">
              Ellennous · Recebido
            </p>
            <h1 className="font-display text-3xl text-gradient-light">Obrigado por compartilhar</h1>
            <p className="text-sm text-muted-foreground">
              Sua avaliação foi recebida e aparecerá no site após aprovação.
            </p>
          </div>
        )}

        {status === "valid" && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="text-center space-y-2 mb-2">
              <p className="font-accent text-[10px] tracking-[0.4em] uppercase text-primary-glow">
                Ellennous · Avaliação {isPreview && "· Prévia"}
              </p>
              <h1 className="font-display text-3xl text-gradient-light">Conte sua experiência</h1>
              <p className="text-sm text-muted-foreground">
                Sua palavra ajuda a contar quem somos.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Seu nome *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                placeholder="Como devemos te chamar"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Como se descreve? (opcional)</Label>
              <Input
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                maxLength={60}
                placeholder="Ex: cliente, noiva, parceiro…"
              />
            </div>

            <div className="space-y-2">
              <Label>Sua nota *</Label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
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
                      className={`h-8 w-8 transition-colors ${
                        i <= (hover || rating)
                          ? "fill-primary-glow text-primary-glow"
                          : "text-muted-foreground/40"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Seu depoimento *</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                maxLength={2000}
                rows={6}
                placeholder="Conte como foi vestir uma peça Ellennous…"
                required
              />
              <p className="text-[10px] text-muted-foreground text-right">{content.length}/2000</p>
            </div>

            <div className="space-y-2">
              <Label>Foto (opcional)</Label>
              <div className="flex items-center gap-4">
                {photoPreview ? (
                  <div className="relative">
                    <img
                      src={photoPreview}
                      alt="Prévia"
                      className="h-20 w-20 rounded-full object-cover border border-border"
                    />
                    <button
                      type="button"
                      onClick={() => handlePhoto(null)}
                      className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                      aria-label="Remover foto"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="h-20 w-20 rounded-full border border-dashed border-border/60 flex items-center justify-center text-muted-foreground">
                    <Upload className="h-5 w-5" />
                  </div>
                )}
                <div className="flex-1">
                  <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                    {photoFile ? "Trocar foto" : "Escolher foto"}
                  </Button>
                  <p className="text-[10px] text-muted-foreground mt-1">JPG/PNG até 5MB</p>
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

            <Button type="submit" disabled={submitting} className="w-full h-12">
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
        )}
      </div>
    </main>
  );
};

export default ReviewSubmit;
