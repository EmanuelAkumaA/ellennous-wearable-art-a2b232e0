import { useReveal } from "@/hooks/use-reveal";

const steps = [
  { n: "01", title: "Briefing com o cliente", text: "Conversamos. Entendemos quem você é, o que quer comunicar, sua referência visual." },
  { n: "02", title: "Criação do conceito", text: "Esboços, paleta, narrativa. Nada vai pro tecido sem ter alma." },
  { n: "03", title: "Pintura manual", text: "Pincéis, tinta, paciência. Cada traço feito à mão, sem atalhos." },
  { n: "04", title: "Aplicação do método ScarType™", text: "Costura artística, fusão de tecidos, detalhes irrepetíveis." },
  { n: "05", title: "Finalização", text: "Selagem, controle de qualidade, certificado de unicidade." },
];

export const Process = () => {
  const ref = useReveal();
  return (
    <section ref={ref} className="relative py-32 px-6 overflow-hidden">
      <div className="max-w-5xl mx-auto">
        <div className="reveal text-center mb-20">
          <p className="font-accent text-sm tracking-[0.4em] text-primary-glow/80 uppercase mb-6">Processo</p>
          <h2 className="font-display text-4xl md:text-6xl font-bold mb-6">
            Como nasce uma <span className="text-gradient-brand">Ellennous</span>
          </h2>
          <p className="text-muted-foreground italic max-w-xl mx-auto">
            Nada aqui é rápido. Porque nada aqui é comum.
          </p>
        </div>

        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-6 md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-primary/40 to-transparent md:-translate-x-px" />

          {steps.map((step, i) => (
            <div
              key={step.n}
              className={`reveal relative mb-16 md:mb-24 md:grid md:grid-cols-2 md:gap-16 ${
                i % 2 === 0 ? "" : "md:[&>*:first-child]:order-2"
              }`}
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <div className={`pl-16 md:pl-0 ${i % 2 === 0 ? "md:text-right md:pr-12" : "md:pl-12"}`}>
                <p className="font-accent text-7xl md:text-8xl text-primary-glow/40 mb-3 tracking-wider">{step.n}</p>
                <h3 className="font-accent text-3xl md:text-4xl mb-3 tracking-wide uppercase">{step.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{step.text}</p>
              </div>
              {/* Dot */}
              <div className="absolute left-6 md:left-1/2 top-3 -translate-x-1/2 w-3 h-3 rounded-full bg-primary shadow-glow" />
              <div className="hidden md:block" />
            </div>
          ))}
        </div>

        <div className="reveal text-center mt-12 pt-12 border-t border-border/40">
          <p className="font-accent text-sm tracking-[0.4em] uppercase text-muted-foreground mb-2">Tempo médio</p>
          <p className="font-accent text-4xl md:text-5xl text-gradient-light tracking-wide">30 a 40 dias</p>
        </div>
      </div>
    </section>
  );
};
