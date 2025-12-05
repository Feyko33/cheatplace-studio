import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Ban } from "lucide-react";

export const BanCheck = ({ children }: { children: React.ReactNode }) => {
  const [isBlocked, setIsBlocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [blockReason, setBlockReason] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  const getClientIP = async (): Promise<string | null> => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      console.error("Error fetching IP:", error);
      return null;
    }
  };

  useEffect(() => {
    const checkBanStatus = async () => {
      try {
        // Vérifier si l'IP est bannie
        const clientIP = await getClientIP();
        if (clientIP) {
          const { data: ipBanned } = await supabase
            .from("banned_ips")
            .select("*")
            .eq("ip_address", clientIP)
            .maybeSingle();

          if (ipBanned) {
            setBlockReason("Votre adresse IP a été bannie.");
            setIsBlocked(true);
            setChecking(false);
            return;
          }
        }

        // Vérifier si l'utilisateur connecté est banni
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Vérifier l'email banni
          const { data: emailBanned } = await supabase
            .from("banned_emails")
            .select("*")
            .eq("email", user.email)
            .maybeSingle();

          if (emailBanned) {
            setBlockReason("Votre compte a été banni.");
            setIsBlocked(true);
            // Déconnecter l'utilisateur
            await supabase.auth.signOut();
            setChecking(false);
            return;
          }

          // Vérifier le statut actif dans profiles
          const { data: profile } = await supabase
            .from("profiles")
            .select("active")
            .eq("id", user.id)
            .single();

          if (profile && !profile.active) {
            setBlockReason("Votre compte a été désactivé.");
            setIsBlocked(true);
            // Déconnecter l'utilisateur
            await supabase.auth.signOut();
            setChecking(false);
            return;
          }
        }

        setIsBlocked(false);
      } catch (error) {
        console.error("Error checking ban status:", error);
      } finally {
        setChecking(false);
      }
    };

    checkBanStatus();
  }, [location.pathname]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center animate-pulse">
          <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Vérification...</p>
        </div>
      </div>
    );
  }

  if (isBlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-destructive/10 mb-6">
            <Ban className="h-10 w-10 text-destructive" />
          </div>
          <h1 className="text-3xl font-display font-bold text-destructive mb-4">
            Accès Refusé
          </h1>
          <p className="text-lg text-muted-foreground mb-4">
            {blockReason}
          </p>
          <p className="text-sm text-muted-foreground">
            Si vous pensez qu'il s'agit d'une erreur, contactez l'administrateur.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
