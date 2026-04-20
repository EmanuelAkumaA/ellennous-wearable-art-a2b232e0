import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";

const ReviewSubmit = () => {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<"loading" | "valid" | "invalid">("loading");
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Avaliação · Ellennous";
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
  }, [token]);

  const reasonText: Record<string, string> = {
    not_found: "Este link de avaliação não existe.",
    revoked: "Este link foi revogado pela Ellennous.",
    used: "Este link já foi utilizado.",
    expired: "Este link expirou.",
    missing_token: "Link inválido.",
    network: "Não foi possível verificar o link. Tente novamente.",
    unknown: "Link inválido.",
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-background text-foreground">
      <div className="max-w-md w-full text-center space-y-6">
        {status === "loading" && (
          <>
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary-glow" />
            <p className="font-accent text-xs tracking-[0.3em] uppercase text-muted-foreground">
              Verificando convite…
            </p>
          </>
        )}

        {status === "valid" && (
          <>
            <p className="font-accent text-[10px] tracking-[0.4em] uppercase text-primary-glow">
              Ellennous · Avaliação
            </p>
            <h1 className="font-display text-3xl text-gradient-light">
              Convite válido
            </h1>
            <p className="text-sm text-muted-foreground">
              O formulário completo de avaliação será disponibilizado em breve nesta página.
            </p>
          </>
        )}

        {status === "invalid" && (
          <>
            <p className="font-accent text-[10px] tracking-[0.4em] uppercase text-destructive">
              Convite indisponível
            </p>
            <h1 className="font-display text-3xl">Não foi possível abrir</h1>
            <p className="text-sm text-muted-foreground">
              {reasonText[reason ?? "unknown"] ?? reasonText.unknown}
            </p>
          </>
        )}
      </div>
    </main>
  );
};

export default ReviewSubmit;
