import { useReveal } from "@/hooks/use-reveal";
import { Chameleon } from "@/components/Chameleon";

export const Manifesto = () => {
  const ref = useReveal();
  return (
    <section ref={ref} className="relative py-32 px-6 overflow-hidden bg-gradient-to-b from-background via-secondary/30 to-background">
      <div className="absolute inset-0 splash-bg opacity-20 pointer-events-none" />
      <div className="absolute -top-20 left-10 w-[500px] h-[500px] bg-primary/10 blur-[140px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-10 opacity-20 animate-float-slow">
        <Chameleon color="hsl(var(--brand-wine))" size={60} />
      </div>

      <div className="relative max-w-5xl mx-auto text-center">
        <div className="reveal">
          <p className="text-xs tracking-[0.4em] text-brand-red/80 uppercase mb-8">— Manifesto —</p>
          <blockquote className="font-display text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.1] tracking-tight">
            <span className="text-foreground">"Eu não nasci pra me encaixar.</span>
            <br />
            <span className="text-gradient-brand">Nasci pra ser referência."</span>
          </blockquote>
          <div className="mt-12 inline-flex items-center gap-3">
            <div className="h-px w-16 bg-foreground/30" />
            <span className="font-display text-sm tracking-[0.3em] text-muted-foreground">ELLENNOUS</span>
            <div className="h-px w-16 bg-foreground/30" />
          </div>
        </div>
      </div>
    </section>
  );
};
