import { Button } from "@/components/ui/button";
import { useReveal } from "@/hooks/use-reveal";
import { buildWhatsAppLink } from "@/components/FloatingWhatsApp";
import { Chameleon } from "@/components/Chameleon";

export const FinalCTA = () => {
  const ref = useReveal();
  return (
    <section ref={ref} className="relative py-24 md:py-40 px-4 sm:px-6 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-purple-wine opacity-30" />
      <div className="absolute inset-0 splash-bg opacity-30 animate-splash-drift" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] max-w-full bg-primary/30 blur-[180px] rounded-full pointer-events-none" />

      <div className="absolute top-10 left-4 sm:left-10 opacity-25 animate-float-slow">
        <Chameleon color="hsl(var(--brand-red))" size={50} />
      </div>

      <div className="relative max-w-4xl mx-auto text-center">
        <div className="reveal">
          <p className="text-[10px] sm:text-xs tracking-[0.35em] sm:tracking-[0.4em] text-brand-ice uppercase mb-6 sm:mb-8">— Última chamada —</p>
          <h2 className="font-display text-[2.4rem] xs:text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black leading-[1] sm:leading-[0.95] mb-8 sm:mb-10 break-words [text-wrap:balance]">
            Se você entendeu,
            <br />
            <span className="text-gradient-brand">você já sabe.</span>
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg mb-10 sm:mb-12 max-w-xl mx-auto px-2">
            Não é venda. É curadoria. E começa com uma conversa.
          </p>
          <Button
            asChild
            size="lg"
            className="bg-foreground text-background hover:bg-primary-glow hover:text-primary-foreground font-semibold tracking-[0.15em] uppercase px-6 sm:px-10 h-14 sm:h-16 text-sm sm:text-base rounded-none shadow-elegant whitespace-normal text-center"
          >
            <a href={buildWhatsAppLink()} target="_blank" rel="noopener noreferrer">
              Criar minha peça exclusiva
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
};
