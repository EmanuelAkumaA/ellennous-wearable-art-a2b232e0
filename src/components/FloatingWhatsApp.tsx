import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";

export const WHATSAPP_NUMBER = "5511976864627";
export const INSTAGRAM_URL = "https://www.instagram.com/ellennouss/";

export const buildWhatsAppLink = (message?: string) => {
  const text = message || "Quero criar minha peça exclusiva Ellennous.";
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
};

export const FloatingWhatsApp = () => (
  <a
    href={buildWhatsAppLink()}
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Falar no WhatsApp"
    className="fixed bottom-5 right-5 z-50 group"
  >
    <span className="absolute inset-0 rounded-full bg-[#25D366]/50 blur-xl animate-pulse-glow" />
    <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] border border-[#128C7E]/60 shadow-[0_0_40px_rgba(37,211,102,0.45)] transition-transform duration-300 group-hover:scale-110">
      <WhatsAppIcon className="h-7 w-7 text-white" />
    </span>
  </a>
);
