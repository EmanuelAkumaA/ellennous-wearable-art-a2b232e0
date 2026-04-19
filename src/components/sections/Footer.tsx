import { buildWhatsAppLink } from "@/components/FloatingWhatsApp";

export const Footer = () => (
  <footer className="relative border-t border-border/40 py-12 px-6">
    <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
      <div className="text-center md:text-left">
        <p className="font-display text-2xl tracking-[0.2em] text-gradient-light">ELLENNOUS</p>
        <p className="text-xs text-muted-foreground tracking-wider mt-1">Arte vestível · Peças únicas feitas à mão</p>
      </div>
      <div className="flex flex-col md:flex-row items-center gap-4 text-sm text-muted-foreground">
        <a
          href={buildWhatsAppLink()}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-primary-glow transition-colors"
        >
          WhatsApp
        </a>
        <span className="hidden md:inline opacity-30">·</span>
        <span>© {new Date().getFullYear()} Ellennous. Todos os direitos reservados.</span>
      </div>
    </div>
  </footer>
);
