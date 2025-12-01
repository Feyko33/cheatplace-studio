import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Eye, Package } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const OffersSection = () => {
  const [selectedOffer, setSelectedOffer] = useState<any>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const handleDownload = async (offer: any) => {
    if (!offer.file_url) {
      toast.error("Aucun fichier disponible pour cette offre");
      return;
    }

    try {
      setDownloadingId(offer.id);

      // Incrémenter le compteur de téléchargements via la fonction sécurisée
      const { error: updateError } = await supabase
        .rpc('increment_offer_download', { _offer_id: offer.id });

      if (updateError) {
        console.error("Error updating download count:", updateError);
      }

      // Construire une URL de téléchargement forcé via le paramètre `download`
      const hasQuery = offer.file_url.includes("?");
      const fileExtension = offer.file_format ? `.${offer.file_format}` : "";
      const downloadFileName = `${offer.title}${fileExtension}`;
      const downloadUrl = `${offer.file_url}${hasQuery ? "&" : "?"}download=${encodeURIComponent(downloadFileName)}`;

      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = downloadFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Ouvrir le lien Discord en même temps
      window.open("https://discord.gg/brmNnnDS", "_blank");

      // Rafraîchir les données pour afficher le nouveau compteur
      queryClient.invalidateQueries({ queryKey: ["offers"] });

      toast.success("Téléchargement démarré");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Erreur lors du téléchargement");
    } finally {
      setDownloadingId(null);
    }
  };

  const { data: offers, isLoading } = useQuery({
    queryKey: ["offers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("offers")
        .select(`
          *,
          profiles:vendor_id (username, role)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "N/A";
    const sizes = ["Bytes", "KB", "MB", "GB"];
    if (bytes === 0) return "0 Byte";
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + " " + sizes[i];
  };

  if (isLoading) {
    return (
      <section id="offers" className="py-20 bg-muted/20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-display font-bold text-glow-cyan mb-4">
              NOS OFFRES
            </h2>
            <p className="text-muted-foreground">Chargement des offres...</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="offers" className="py-20 bg-muted/20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12 animate-slide-up">
          <h2 className="text-4xl font-display font-bold text-glow-cyan mb-4">
            NOS OFFRES
          </h2>
          <p className="text-muted-foreground text-lg">
            Découvrez nos cheats et outils premium
          </p>
        </div>

        {!offers || offers.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground text-lg">
              Aucune offre disponible pour le moment
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {offers.map((offer, index) => (
              <Card 
                key={offer.id} 
                className="card-glow hover:scale-105 transition-all duration-300 animate-slide-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {offer.image_preview_url && (
                  <div className="h-48 overflow-hidden rounded-t-lg">
                    <img
                      src={offer.image_preview_url}
                      alt={offer.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-xl">{offer.title}</CardTitle>
                    {offer.price > 0 ? (
                      <Badge variant="default" className="bg-gradient-button">
                        {offer.price}€
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-accent">
                        GRATUIT
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-sm">
                    Par {offer.profiles?.username || "Vendor"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {offer.description}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {offer.tags?.map((tag: string) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Download className="h-3 w-3" />
                      {offer.download_count} téléchargements
                    </div>
                    {offer.file_size && (
                      <div className="flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        {formatFileSize(offer.file_size)}
                      </div>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="flex gap-2">
                  <Button 
                    className="flex-1 bg-gradient-button shadow-glow-cyan" 
                    size="sm"
                    onClick={() => setSelectedOffer(offer)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Voir détails
                  </Button>
                  {offer.file_url && (
                    <Button 
                      variant="secondary"
                      size="sm"
                      onClick={() => handleDownload(offer)}
                      disabled={downloadingId === offer.id}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      {downloadingId === offer.id ? "..." : "Télécharger"}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
