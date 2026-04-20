import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Autoplay from "embla-carousel-autoplay";
import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { useReveal } from "@/hooks/use-reveal";
import { Dragon } from "@/components/Dragon";
import { AlertCircle, Instagram, MapPin, Quote, RefreshCw, Sparkles, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  const queryClient = useQueryClient();
  const autoplay = useRef(
    Autoplay({ delay: 4500, stopOnInteraction: true, stopOnFocusIn: true, stopOnMouseEnter: true })
  );
  const [api, setApi] = useState<CarouselApi>();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [snapCount, setSnapCount] = useState(0);

  useEffect(() => {
    const channel = supabase
      .channel("public-reviews-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reviews" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["approved-reviews"] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const { data: cards, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["approved-reviews"],
    staleTime: 60_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
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

  useEffect(() => {
    if (!api) return;
    const update = () => {
      setSelectedIndex(api.selectedScrollSnap());
      setSnapCount(api.scrollSnapList().length);
    };
    update();
    api.on("select", update);
    api.on("reInit", update);
    return () => {
      api.off("select", update);
      api.off("reInit", update);
    };
  }, [api]);

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

        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="border border-primary/15 bg-background/40 backdrop-blur-sm">
                <Skeleton className="aspect-[3/4] w-full rounded-none" />
                <div className="p-8 space-y-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && isError && (
          <div className="max-w-2xl mx-auto text-center">
            <div className="relative border border-primary/15 bg-background/40 backdrop-blur-sm p-12 md:p-16">
              <AlertCircle className="w-10 h-10 text-primary-glow/60 mx-auto mb-6" strokeWidth={1.2} />
              <p className="font-display italic text-xl md:text-2xl text-foreground/85 leading-relaxed mb-6">
                Não foi possível carregar agora.
              </p>
              <p className="text-sm text-foreground/60 tracking-wider mb-6">
                Verifique sua conexão e toque para tentar novamente.
              </p>
              <Button
                variant="outline"
                onClick={() => refetch()}
                disabled={isFetching}
                className="border-primary/30 text-primary-glow hover:bg-primary/10"
              >
                <RefreshCw className={cn("h-4 w-4 mr-2", isFetching && "animate-spin")} />
                Tentar novamente
              </Button>
            </div>
          </div>
        )}

        {!isLoading && !isError && hasItems && (
          <div className="relative">
            <Carousel
              setApi={setApi}
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
                        <div className="pt-4 border-t border-border/40 space-y-2">
                          <div className="flex items-baseline justify-between gap-3 flex-wrap">
                            <p className="font-accent text-lg text-foreground tracking-wide">{t.name}</p>
                            {t.role && (
                              <p className="text-xs text-muted-foreground tracking-wider">{t.role}</p>
                            )}
                          </div>
                          {(t.city || t.state || t.instagram) && (
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              {(t.city || t.state) ? (
                                <p className="flex items-center gap-1 text-[11px] text-foreground/60">
                                  <MapPin className="h-3 w-3 text-primary-glow/70" strokeWidth={1.5} />
                                  {[t.city, t.state].filter(Boolean).join(" · ")}
                                </p>
                              ) : <span />}
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
                          )}
                        </div>
                      </div>
                    </article>
                  </CarouselItem>
                ))}
              </CarouselContent>

              {/* Mobile arrows — small, overlay on cards */}
              <CarouselPrevious
                aria-label="Depoimento anterior"
                className="md:hidden left-2 top-1/2 -translate-y-1/2 h-9 w-9 bg-background/80 border-primary/30 text-primary-glow hover:bg-primary/20"
              />
              <CarouselNext
                aria-label="Próximo depoimento"
                className="md:hidden right-2 top-1/2 -translate-y-1/2 h-9 w-9 bg-background/80 border-primary/30 text-primary-glow hover:bg-primary/20"
              />

              {/* Desktop arrows — original styling */}
              <CarouselPrevious className="hidden md:flex -left-6 lg:-left-12 h-12 w-12 bg-background/80 border-primary/30 text-primary-glow hover:bg-primary/20 hover:border-primary-glow hover:text-foreground shadow-[0_0_30px_hsl(var(--primary)/0.3)]" />
              <CarouselNext className="hidden md:flex -right-6 lg:-right-12 h-12 w-12 bg-background/80 border-primary/30 text-primary-glow hover:bg-primary/20 hover:border-primary-glow hover:text-foreground shadow-[0_0_30px_hsl(var(--primary)/0.3)]" />
            </Carousel>

            {/* Pagination dots — visible on mobile */}
            {snapCount > 1 && (
              <div className="md:hidden flex items-center justify-center gap-2 mt-8" role="tablist" aria-label="Navegar entre depoimentos">
                {Array.from({ length: snapCount }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    role="tab"
                    aria-selected={i === selectedIndex}
                    aria-label={`Ir para depoimento ${i + 1}`}
                    onClick={() => api?.scrollTo(i)}
                    className={cn(
                      "h-2 rounded-full transition-all duration-300",
                      i === selectedIndex
                        ? "w-6 bg-primary-glow"
                        : "w-2 bg-primary-glow/30 hover:bg-primary-glow/60"
                    )}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {!isLoading && !isError && !hasItems && (
          <div className="max-w-2xl mx-auto text-center">
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
