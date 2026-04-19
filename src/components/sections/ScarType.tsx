import { useReveal } from "@/hooks/use-reveal";
import { Dragon } from "@/components/Dragon";

const techniques = [
  { title: "Fusão de tecidos", text: "Materiais unidos com intenção. Cada combinação é um diálogo entre texturas." },
  { title: "Costura artística", text: "Pontos visíveis como traços de tinta. A linha vira pincel." },
  { title: "Pintura manual", text: "Camadas pacientes. Tinta que respira com o tecido, não sobre ele." },
];

export const ScarType = () => {
  const ref = useReveal();
  return (
    <section ref={ref} className="relative py-32 px-6 overflow-hidden bg-gradient-to-b from-background via-secondary/40 to-background">
      <div className="absolute inset-0 flex items-center justify-end pointer-events-none opacity-[0.08]">
        <Dragon className="w-[700px] h-[700px] -mr-32" />
      </div>
      <div className="absolute -top-20 -left-20 w-[500px] h-[500px] bg-brand-red/15 blur-[140px] rounded-full pointer-events-none" />

      <div className="relative max-w-6xl mx-auto">
        <div className="reveal text-center mb-16">
          <p className="text-xs tracking-[0.4em] text-brand-red/80 uppercase mb-6">Método Exclusivo</p>
          <h2 className="font-display text-5xl md:text-7xl font-bold mb-6">
            Método <span className="text-gradient-brand">ScarType™</span>
          </h2>
          <p className="text-lg md:text-xl text-foreground/80 max-w-2xl mx-auto leading-relaxed">
            Uma técnica exclusiva da Ellennous que combina três linguagens em uma só peça.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {techniques.map((t, i) => (
            <div
              key={t.title}
              className="reveal relative p-8 bg-background/60 backdrop-blur border border-primary/20 hover:border-primary-glow/60 transition-all duration-700 group"
              style={{ transitionDelay: `${i * 120}ms` }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/0 group-hover:from-primary/10 group-hover:to-brand-red/5 transition-all duration-700" />
              <div className="relative">
                <div className="w-10 h-px bg-primary-glow mb-6" />
                <h3 className="font-display text-xl mb-3">{t.title}</h3>
                <p className="text-muted-foreground leading-relaxed text-sm">{t.text}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="reveal text-center">
          <p className="font-display text-2xl md:text-3xl italic text-gradient-light">
            Resultado: peças com identidade irrepetível.
          </p>
        </div>
      </div>
    </section>
  );
};
