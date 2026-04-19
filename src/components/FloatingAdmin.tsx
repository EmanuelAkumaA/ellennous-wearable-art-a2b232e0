import { Lock } from "lucide-react";
import { Link } from "react-router-dom";

export const FloatingAdmin = () => {
  return (
    <Link
      to="/admin"
      aria-label="Acesso admin"
      className="fixed bottom-5 right-24 z-40 h-10 w-10 rounded-full border border-border/60 bg-background/70 backdrop-blur-sm flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary-glow/60 transition-all duration-500"
    >
      <Lock className="h-4 w-4" />
    </Link>
  );
};
