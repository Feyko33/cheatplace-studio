import { Button } from "@/components/ui/button";
import { Shield, Zap, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";

export const HeroSection = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-hero opacity-20" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,255,255,0.1),transparent_50%)]" />
      
      <div className="container mx-auto px-4 py-20 relative z-10">
        <div className="max-w-4xl mx-auto text-center space-y-8 animate-slide-up">
          <div className="inline-flex items-center gap-4 mb-6">
            <Shield className="h-20 w-20 text-primary animate-glow" />
          </div>
          
          <h1 className="text-5xl md:text-7xl font-display font-bold leading-tight">
            <span className="text-glow-cyan">CHEATPLACE</span>
            <br />
            <span className="text-glow-purple text-4xl md:text-5xl">-STUDIO</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
            Le marketplace ultime pour les cheaters et gamers
          </p>

          <div className="flex flex-wrap gap-4 justify-center items-center pt-8">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Zap className="h-4 w-4 text-accent" />
              <span>Téléchargement instantané</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="h-4 w-4 text-secondary" />
              <span>Paiement sécurisé</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4 text-primary" />
              <span>Support 24/7</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 justify-center pt-8">
            {!user && (
              <Button 
                size="lg" 
                onClick={() => navigate("/auth")}
                className="bg-gradient-button text-primary-foreground shadow-glow-cyan text-lg px-8"
              >
                Commencer maintenant
              </Button>
            )}
            <Button 
              size="lg" 
              variant="outline"
              onClick={() => {
                const offersSection = document.getElementById("offers");
                offersSection?.scrollIntoView({ behavior: "smooth" });
              }}
              className="text-lg px-8"
            >
              Explorer les offres
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};
