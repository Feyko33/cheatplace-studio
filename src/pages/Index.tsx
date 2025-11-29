import { Navbar } from "@/components/Navbar";
import { HeroSection } from "@/components/HeroSection";
import { OffersSection } from "@/components/OffersSection";
import { AnnouncementsSection } from "@/components/AnnouncementsSection";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20">
        <HeroSection />
        <OffersSection />
        <AnnouncementsSection />
      </main>
      
      <footer className="border-t border-border/50 bg-card/50 backdrop-blur-sm py-8 mt-20">
        <div className="container mx-auto px-4 text-center text-muted-foreground text-sm">
          <p>© 2024 CHEATPLACE-STUDIO. Tous droits réservés.</p>
          <p className="mt-2">Le marketplace ultime pour les cheaters et gamers</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
