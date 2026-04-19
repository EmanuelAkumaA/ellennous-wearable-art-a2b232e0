import { Instagram } from "lucide-react";
import { buildWhatsAppLink, INSTAGRAM_URL } from "@/components/FloatingWhatsApp";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import logoEllennous from "@/assets/logo-ellennous.png";

export const Footer = () => (
  <footer className="relative border-t border-border/40 pt-14 pb-28 md:pb-14 px-6">
    <div className="max-w-6xl mx-auto flex flex-col items-center gap-10 md:flex-row md:items-center md:justify-between text-center md:text-left">
      {/* Logo */}
      <div className="flex flex-col items-center md:items-start gap-3">
        <img
          src={logoEllennous}
          alt="ELLENNOUS — arte vestível"
          loading="lazy"
          className="h-16 sm:h-20 md:h-24 w-auto object-contain text-center"
        />
        <p className="text-[11px] sm:text-xs text-muted-foreground tracking-[0.25em] uppercase max-w-xs">
          Arte vestível · Peças únicas feitas à mão
        </p>
      </div>

      {/* Social */}
      <div className="flex items-center gap-4">
        <a
          href={buildWhatsAppLink()}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="WhatsApp Ellennous"
          className="group h-11 w-11 flex items-center justify-center rounded-full border border-border hover:border-[#25D366] hover:bg-[#25D366]/10 transition-all duration-500"
        >
          <WhatsAppIcon className="h-5 w-5 text-muted-foreground group-hover:text-[#25D366] transition-colors" />
        </a>
        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Instagram @ellennouss"
          className="group h-11 w-11 flex items-center justify-center rounded-full border border-border hover:border-primary-glow hover:bg-primary/10 transition-all duration-500"
        >
          <Instagram className="h-5 w-5 text-muted-foreground group-hover:text-primary-glow transition-colors" strokeWidth={1.6} />
        </a>
      </div>
    </div>

    {/* Bottom bar */}
    <div className="max-w-6xl mx-auto mt-10 pt-6 border-t border-border/30 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-muted-foreground text-center md:text-left">
      <span className="tracking-wider">© {new Date().getFullYear()} Ellennous. Todos os direitos reservados.</span>
      <a
        href="https://kumatech.com.br/"
        target="_blank"
        rel="noopener noreferrer"
        className="tracking-[0.2em] uppercase hover:text-primary-glow transition-colors"
      >
        Criado por <span className="font-semibold text-foreground/80">Kuma Tech</span>
      </a>
    </div>
  </footer>
);
