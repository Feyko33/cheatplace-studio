import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Navbar } from "@/components/Navbar";
import { Download, LogIn, Package } from "lucide-react";

export default function UserStats() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: downloads } = useQuery({
    queryKey: ["user-downloads", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("user_downloads")
        .select(`
          *,
          offers (title, description, image_preview_url)
        `)
        .eq("user_id", user.id)
        .order("downloaded_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-lg">Chargement...</div>
      </div>
    );
  }

  if (!user) return null;

  // Compter les téléchargements uniques
  const uniqueDownloads = downloads ? new Set(downloads.map(d => d.offer_id)).size : 0;
  const totalDownloads = downloads?.length || 0;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-20">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-display font-bold text-glow-cyan mb-2">
              Mes Statistiques
            </h1>
            <p className="text-muted-foreground">
              Bienvenue {profile?.username || user.email}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="card-glow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Téléchargements
                </CardTitle>
                <Download className="h-4 w-4 text-accent" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalDownloads}</div>
                <p className="text-xs text-muted-foreground">
                  {uniqueDownloads} offres différentes
                </p>
              </CardContent>
            </Card>

            <Card className="card-glow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Connexions
                </CardTitle>
                <LogIn className="h-4 w-4 text-accent" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{profile?.login_count || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Dernière connexion: {profile?.last_login ? new Date(profile.last_login).toLocaleDateString('fr-FR') : 'N/A'}
                </p>
              </CardContent>
            </Card>

            <Card className="card-glow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Membre depuis
                </CardTitle>
                <Package className="h-4 w-4 text-accent" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('fr-FR') : 'N/A'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Rôle: {profile?.role || 'client'}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="card-glow">
            <CardHeader>
              <CardTitle>Historique des téléchargements</CardTitle>
              <CardDescription>Liste de toutes vos offres téléchargées</CardDescription>
            </CardHeader>
            <CardContent>
              {!downloads || downloads.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Aucun téléchargement pour le moment
                </div>
              ) : (
                <div className="space-y-4">
                  {downloads.map((download) => (
                    <div key={download.id} className="flex items-center gap-4 p-4 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors">
                      {download.offers?.image_preview_url && (
                        <img
                          src={download.offers.image_preview_url}
                          alt={download.offers?.title || "Offre"}
                          className="w-16 h-16 object-cover rounded"
                        />
                      )}
                      <div className="flex-1">
                        <h3 className="font-semibold">{download.offers?.title || "Offre supprimée"}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {download.offers?.description || ""}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Téléchargé le {new Date(download.downloaded_at).toLocaleDateString('fr-FR')} à {new Date(download.downloaded_at).toLocaleTimeString('fr-FR')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
