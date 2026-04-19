import { Hero } from "@/components/sections/Hero";
import { Positioning } from "@/components/sections/Positioning";
import { Manifesto } from "@/components/sections/Manifesto";
import { Gallery } from "@/components/sections/Gallery";
import { Process } from "@/components/sections/Process";
import { ScarType } from "@/components/sections/ScarType";
import { Testimonials } from "@/components/sections/Testimonials";
import { ForWhom } from "@/components/sections/ForWhom";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { Footer } from "@/components/sections/Footer";
import { FloatingWhatsApp } from "@/components/FloatingWhatsApp";
import { FloatingAdmin } from "@/components/FloatingAdmin";

const Index = () => {
  return (
    <main className="relative">
      <Hero />
      <Positioning />
      <Manifesto />
      <Gallery />
      <Process />
      <ScarType />
      <Testimonials />
      <ForWhom />
      <FinalCTA />
      <Footer />
      <FloatingWhatsApp />
      <FloatingAdmin />
    </main>
  );
};

export default Index;
