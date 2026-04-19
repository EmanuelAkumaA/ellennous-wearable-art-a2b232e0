import { useRef } from "react";
import Autoplay from "embla-carousel-autoplay";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { useReveal } from "@/hooks/use-reveal";
import { Dragon } from "@/components/Dragon";
import { Quote } from "lucide-react";
import t1 from "@/assets/testimonial-1.jpg";
import t2 from "@/assets/testimonial-2.jpg";
import t3 from "@/assets/testimonial-3.jpg";
import t4 from "@/assets/testimonial-4.jpg";
import t5 from "@/assets/testimonial-5.jpg";
import t6 from "@/assets/testimonial-6.jpg";

const testimonials = [
  {
    image: t1,
    name: "Rafael M.",
    handle: "@rafa.mds",
    city: "São Paulo, SP",
    category: "Anime/Geek",
    quote: "Nunca usei nada que falasse tanto por mim sem precisar abrir a boca.",
  },
  {
    image: t2,
    name: "Marina S.",
    handle: "@mari.sant",
    city: "Rio de Janeiro, RJ",
    category: "Floral",
    quote: "É arte que respira comigo. Cada flor parece pintada na minha pele.",
  },
  {
    image: t3,
    name: "Lucas T.",
    handle: "@luc.tav",
    city: "Curitiba, PR",
    category: "ScarType™",
    quote: "Não é roupa. É um manifesto que eu visto todo dia.",
  },
  {
    image: t4,
    name: "Beatriz L.",
    handle: "@bea.lph",
    city: "Belo Horizonte, MG",
    category: "Exclusiva",
    quote: "Senti que finalmente alguém entendeu quem eu sou — e bordou isso em mim.",
  },
  {
    image: t5,
    name: "Daniel K.",
    handle: "@dan.kry",
    city: "Porto Alegre, RS",
    category: "Anime/Geek",
    quote: "É a única peça que eu tenho medo de tirar do corpo. Parece parte de mim.",
  },
  {
    image: t6,
    name: "Helena V.",
    handle: "@hel.vss",
    city: "Florianópolis, SC",
    category: "Realismo",
    quote: "Quem entende, entende. Quem não entende, fica olhando.",
  },
];

export const Testimonials = () => {
  const ref = useReveal();
  const autoplay = useRef(
    Autoplay({ delay: 4500, stopOnInteraction: false, stopOnMouseEnter: true })
  );

  return (
    <section
      ref={ref}
      className="relative py-32 px-6 overflow-hidden bg-gradient-to-b from-background via-background to-secondary/20"
    >
      <div className="absolute inset-0 flex items-center justify-start pointer-events-none opacity-[0.06]">
        <Dragon className="w-[700px] h-[700px] -ml-32" />
      </div>
      <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] bg-primary/15 blur-[140px] rounded-full pointer-events-none" />

      <div className="relative max-w-7xl mx-auto">
        <div className="reveal text-center mb-16">
          <p className="font-accent text-sm tracking-[0.4em] text-primary-glow/80 uppercase mb-6">Quem veste a Ellennous</p>
          <h2 className="font-display text-5xl md:text-7xl font-bold mb-6">
            Quem veste, <span className="text-gradient-brand">fala por si.</span>
          </h2>
          <p className="text-lg md:text-xl text-foreground/70 max-w-2xl mx-auto leading-relaxed">
            Não vendemos produto. Entregamos identidade. Veja quem já carrega a sua.
          </p>
        </div>

        <div className="reveal">
          <Carousel
            opts={{ align: "start", loop: true }}
            plugins={[autoplay.current]}
            className="w-full"
          >
            <CarouselContent className="-ml-4">
              {testimonials.map((t, i) => (
                <CarouselItem key={i} className="pl-4 basis-full md:basis-1/2 lg:basis-1/3">
                  <article className="group relative overflow-hidden border border-primary/15 bg-background/60 backdrop-blur-sm hover:border-primary-glow/50 transition-all duration-700">
                    <div className="relative aspect-[3/4] overflow-hidden">
                      <img
                        src={t.image}
                        alt={`${t.name} vestindo peça Ellennous categoria ${t.category}`}
                        loading="lazy"
                        width={768}
                        height={1024}
                        className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
                      <span className="font-accent absolute top-4 left-4 inline-block px-3 py-1 text-xs tracking-[0.3em] uppercase bg-primary/20 backdrop-blur border border-primary-glow/30 text-primary-glow">
                        {t.category}
                      </span>
                    </div>

                    <div className="relative p-8">
                      <Quote className="absolute -top-5 left-6 w-10 h-10 text-primary-glow/30" strokeWidth={1} />
                      <p className="font-display italic text-lg md:text-xl text-foreground/90 leading-relaxed mb-6">
                        "{t.quote}"
                      </p>
                      <div className="flex items-center justify-between pt-4 border-t border-border/40">
                        <div>
                          <p className="font-accent text-lg text-foreground tracking-wide">{t.name}</p>
                          <p className="text-xs text-muted-foreground tracking-wider">{t.city}</p>
                        </div>
                        <p className="text-xs text-primary-glow/70 tracking-widest">{t.handle}</p>
                      </div>
                    </div>
                  </article>
                </CarouselItem>
              ))}
            </CarouselContent>

            <CarouselPrevious className="hidden md:flex -left-6 lg:-left-12 h-12 w-12 bg-background/80 border-primary/30 text-primary-glow hover:bg-primary/20 hover:border-primary-glow hover:text-foreground shadow-[0_0_30px_hsl(var(--primary)/0.3)]" />
            <CarouselNext className="hidden md:flex -right-6 lg:-right-12 h-12 w-12 bg-background/80 border-primary/30 text-primary-glow hover:bg-primary/20 hover:border-primary-glow hover:text-foreground shadow-[0_0_30px_hsl(var(--primary)/0.3)]" />
          </Carousel>
        </div>
      </div>
    </section>
  );
};
