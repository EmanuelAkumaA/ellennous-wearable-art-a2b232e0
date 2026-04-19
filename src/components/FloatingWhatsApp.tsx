import { MessageCircle } from "lucide-react";

export const WHATSAPP_NUMBER = "5511976864627";

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
    <span className="absolute inset-0 rounded-full bg-primary/40 blur-xl animate-pulse-glow" />
    <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-purple-wine border border-primary-glow/40 shadow-glow transition-transform duration-300 group-hover:scale-110">
      <MessageCircle className="h-6 w-6 text-white" strokeWidth={2.2} />
    </span>
  </a>
);
