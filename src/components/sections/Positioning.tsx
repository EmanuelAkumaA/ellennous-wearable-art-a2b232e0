import { useReveal } from "@/hooks/use-reveal";

const pillars = [
  { num: "01", title: "100% Autoral", text: "Cada conceito nasce do zero, pensado para quem vai vesti-lo." },
  { num: "02", title: "Nenhuma se repete", text: "Sua peça nunca será reproduzida. Nem parecida. Nem inspirada." },
  { num: "03", title: "Criada para você", text: "Não é uma jaqueta com sua arte. É a sua arte que virou jaqueta." },
];

export const Positioning = () => {
  const ref = useReveal();
  return (
    <section ref={ref} className="relative py-32 px-6 overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <div className="reveal text-center mb-20">
          <p className="font-accent text-sm tracking-[0.4em] text-primary-glow/80 uppercase mb-6">Posicionamento</p>
          <h2 className="font-display text-3xl md:text-5xl lg:text-6xl font-bold leading-tight">
            Você não compra uma peça.
            <br />
            <span className="text-gradient-light">Você veste algo que nunca existiu antes.</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8 md:gap-12">
          {pillars.map((p, i) => (
            <div
              key={p.num}
              className="reveal group relative p-8 border border-border/60 hover:border-primary/60 transition-colors duration-700 bg-card/30 backdrop-blur"
              style={{ transitionDelay: `${i * 120}ms` }}
            >
              <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary-glow/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <p className="font-accent text-6xl text-primary-glow/40 mb-4 tracking-wider">{p.num}</p>
              <h3 className="font-accent text-2xl mb-3 text-foreground tracking-wide uppercase">{p.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{p.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
