import { Button } from "@/components/ui/button";
import { Chameleon } from "@/components/Chameleon";
import { buildWhatsAppLink } from "@/components/FloatingWhatsApp";
import heroImage from "@/assets/hero-ellennous.jpg";

export const Hero = () => (
  <section className="relative min-h-[100svh] flex items-center justify-center overflow-hidden">
    {/* Background image */}
    <div className="absolute inset-0">
      <img
        src={heroImage}
        alt="Pessoa vestindo jaqueta personalizada Ellennous com arte autoral"
        className="w-full h-full object-cover opacity-60"
        width={1920}
        height={1080}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/60 to-background" />
      <div className="absolute inset-0 splash-bg opacity-40 animate-splash-drift" />
    </div>

    {/* Glow */}
    <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />

    {/* Camouflaged chameleon */}
    <div className="absolute top-24 right-8 md:right-16 opacity-30 animate-float-slow">
      <Chameleon color="hsl(var(--primary-glow))" size={70} />
    </div>

    {/* Content */}
    <div className="relative z-10 max-w-5xl mx-auto px-6 text-center animate-fade-up">
      <p className="text-xs md:text-sm tracking-[0.4em] text-brand-ice/70 uppercase mb-6">
        Ellennous · Arte Vestível
      </p>
      <h1 className="font-display text-[2.75rem] xs:text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black leading-[1] sm:leading-[0.95] mb-8 break-words [text-wrap:balance]">
        <span className="block text-foreground">NÃO É ROUPA.</span>
        <span className="block text-gradient-brand mt-2">É IDENTIDADE.</span>
      </h1>
      <p className="text-base md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
        Peças únicas criadas à mão.
        <br />
        Feitas para quem não aceita ser comum.
      </p>
      <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
        <Button
          asChild
          size="lg"
          className="bg-gradient-purple-wine border border-primary-glow/40 hover:shadow-glow text-white font-semibold tracking-wide px-8 h-14 rounded-none"
        >
          <a href={buildWhatsAppLink()} target="_blank" rel="noopener noreferrer">
            Criar minha peça exclusiva
          </a>
        </Button>
        <Button
          asChild
          variant="outline"
          size="lg"
          className="border-foreground/20 hover:border-primary-glow hover:bg-transparent hover:text-primary-glow tracking-wide px-8 h-14 rounded-none bg-background/40 backdrop-blur"
        >
          <a href="#galeria">Explorar obras</a>
        </Button>
      </div>
    </div>

    {/* Scroll cue */}
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-muted-foreground text-xs tracking-[0.3em] uppercase opacity-60">
      <div className="flex flex-col items-center gap-2">
        <span>Role</span>
        <div className="w-px h-10 bg-gradient-to-b from-foreground/40 to-transparent" />
      </div>
    </div>
  </section>
);
