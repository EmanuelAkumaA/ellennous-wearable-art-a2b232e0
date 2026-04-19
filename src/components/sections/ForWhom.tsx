import { useReveal } from "@/hooks/use-reveal";

const profiles = [
  "Para quem valoriza exclusividade acima de tendência.",
  "Para quem quer ser notado sem precisar gritar.",
  "Para quem nunca seguiu padrões — e nem pretende.",
];

export const ForWhom = () => {
  const ref = useReveal();
  return (
    <section ref={ref} className="relative py-32 px-6">
      <div className="max-w-4xl mx-auto text-center">
        <div className="reveal mb-16">
          <p className="text-xs tracking-[0.4em] text-primary-glow/80 uppercase mb-6">Para quem é</p>
          <h2 className="font-display text-4xl md:text-6xl font-bold leading-tight">
            Isso <span className="text-gradient-brand">não é para todos.</span>
          </h2>
        </div>

        <div className="space-y-6">
          {profiles.map((p, i) => (
            <div
              key={i}
              className="reveal flex items-center gap-6 py-6 border-b border-border/40 group"
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              <span className="font-display text-3xl md:text-4xl text-primary-glow/40 group-hover:text-primary-glow transition-colors">
                0{i + 1}
              </span>
              <p className="text-left text-lg md:text-2xl font-display text-foreground/90 leading-snug">
                {p}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
