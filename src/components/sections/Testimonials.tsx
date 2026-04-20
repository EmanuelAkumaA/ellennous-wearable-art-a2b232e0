import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import Autoplay from "embla-carousel-autoplay";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { useReveal } from "@/hooks/use-reveal";
import { Dragon } from "@/components/Dragon";
import { Instagram, MapPin, Quote, Sparkles, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface CardData {
  image: string | null;
  name: string;
  role: string | null;
  quote: string;
  rating: number;
  city: string | null;
  state: string | null;
  instagram: string | null;
}

const StarRating = ({ value }: { value: number }) => (
  <div className="flex gap-0.5 mb-3">
    {[1, 2, 3, 4, 5].map((i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${i <= value ? "fill-primary-glow text-primary-glow" : "text-muted-foreground/30"}`}
        strokeWidth={1.5}
      />
    ))}
  </div>
);

export const Testimonials = () => {
  const ref = useReveal();
  const autoplay = useRef(
    Autoplay({ delay: 4500, stopOnInteraction: false, stopOnMouseEnter: true })
  );

  const { data: cards, isLoading } = useQuery({
    queryKey: ["approved-reviews"],
    staleTime: 60_000,
    refetchOnMount: "always",
    queryFn: async (): Promise<CardData[]> => {
      const { data, error } = await supabase
        .from("reviews")
        .select("client_name, client_role, content, rating, photo_url, city, state, instagram")
        .eq("status", "approved")
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        image: r.photo_url,
        name: r.client_name,
        role: r.client_role,
        quote: r.content,
        rating: r.rating,
        city: r.city,
        state: r.state,
        instagram: r.instagram,
      }));
    },
  });

  const items = cards ?? [];
  const hasItems = items.length > 0;

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

        {!isLoading && hasItems && (
          <div className="reveal">
            <Carousel
              opts={{ align: "start", loop: true }}
              plugins={[autoplay.current]}
              className="w-full"
            >
              <CarouselContent className="-ml-4">
                {items.map((t, i) => (
                  <CarouselItem key={i} className="pl-4 basis-full md:basis-1/2 lg:basis-1/3">
                    <article className="group relative overflow-hidden border border-primary/15 bg-background/60 backdrop-blur-sm hover:border-primary-glow/50 transition-all duration-700 h-full">
                      {t.image && (
                        <div className="relative aspect-[3/4] overflow-hidden">
                          <img
                            src={t.image}
                            alt={`${t.name} — depoimento Ellennous`}
                            loading="lazy"
                            width={768}
                            height={1024}
                            className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
                        </div>
                      )}

                      <div className="relative p-8">
                        <Quote className="absolute -top-5 left-6 w-10 h-10 text-primary-glow/30" strokeWidth={1} />
                        <StarRating value={t.rating} />
                        <p className="font-display italic text-lg md:text-xl text-foreground/90 leading-relaxed mb-6">
                          "{t.quote}"
                        </p>
                        <div className="pt-4 border-t border-border/40 space-y-1.5">
                          <p className="font-accent text-lg text-foreground tracking-wide">{t.name}</p>
                          {t.role && (
                            <p className="text-xs text-muted-foreground tracking-wider">{t.role}</p>
                          )}
                          {(t.city || t.state) && (
                            <p className="flex items-center gap-1 text-[11px] text-foreground/60">
                              <MapPin className="h-3 w-3 text-primary-glow/70" strokeWidth={1.5} />
                              {[t.city, t.state].filter(Boolean).join(" · ")}
                            </p>
                          )}
                          {t.instagram && (
                            <a
                              href={`https://instagram.com/${t.instagram.replace(/^@/, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-primary-glow/80 hover:text-primary-glow transition-colors"
                            >
                              <Instagram className="h-3 w-3" strokeWidth={1.5} />
                              {t.instagram.startsWith("@") ? t.instagram : `@${t.instagram}`}
                            </a>
                          )}
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
        )}

        {!isLoading && !hasItems && (
          <div className="reveal max-w-2xl mx-auto text-center">
            <div className="relative border border-primary/15 bg-background/40 backdrop-blur-sm p-12 md:p-16">
              <Sparkles className="w-10 h-10 text-primary-glow/60 mx-auto mb-6" strokeWidth={1.2} />
              <p className="font-display italic text-xl md:text-2xl text-foreground/85 leading-relaxed mb-4">
                "As primeiras vozes estão sendo bordadas."
              </p>
              <p className="text-sm text-foreground/60 tracking-wider">
                Em breve, quem veste a Ellennous fala por si — aqui mesmo.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
