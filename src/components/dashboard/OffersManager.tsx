import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const offerSchema = z.object({
  title: z.string().min(3, "Le titre doit contenir au moins 3 caractères").max(100),
  description: z.string().min(10, "La description doit contenir au moins 10 caractères").max(1000),
  price: z.number().min(0, "Le prix doit être positif"),
  tags: z.string(),
});

export const OffersManager = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState<any>(null);
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("0");
  const [tags, setTags] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: offers, isLoading } = useQuery({
    queryKey: ["my-offers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("offers")
        .select("*")
        .eq("vendor_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (offerData: any) => {
      let fileUrl = null;
      let fileSize = null;
      let fileFormat = null;

      // Upload file if provided
      if (file && user?.id) {
        setUploading(true);
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError, data } = await supabase.storage
          .from('offer-files')
          .upload(fileName, file);

        if (uploadError) {
          setUploading(false);
          throw new Error(`Erreur d'upload: ${uploadError.message}`);
        }

        const { data: { publicUrl } } = supabase.storage
          .from('offer-files')
          .getPublicUrl(fileName);

        fileUrl = publicUrl;
        fileSize = file.size;
        fileFormat = fileExt;
        setUploading(false);
      }

      const { error } = await supabase.from("offers").insert({
        ...offerData,
        vendor_id: user?.id,
        file_url: fileUrl,
        file_size: fileSize,
        file_format: fileFormat,
      });

      if (error) throw error;

      // Log creation
      await supabase.from("logs").insert({
        user_id: user?.id,
        action_type: "offer_created",
        message: `Offre créée: ${offerData.title}`,
        metadata: { title: offerData.title, hasFile: !!fileUrl },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-offers"] });
      queryClient.invalidateQueries({ queryKey: ["offers"] });
      toast.success("Offre créée avec succès !");
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Erreur lors de la création");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...offerData }: any) => {
      let fileUrl = offerData.file_url;
      let fileSize = offerData.file_size;
      let fileFormat = offerData.file_format;

      // Upload new file if provided
      if (file && user?.id) {
        setUploading(true);
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('offer-files')
          .upload(fileName, file);

        if (uploadError) {
          setUploading(false);
          throw new Error(`Erreur d'upload: ${uploadError.message}`);
        }

        const { data: { publicUrl } } = supabase.storage
          .from('offer-files')
          .getPublicUrl(fileName);

        fileUrl = publicUrl;
        fileSize = file.size;
        fileFormat = fileExt;
        setUploading(false);
      }

      const { error } = await supabase
        .from("offers")
        .update({
          ...offerData,
          file_url: fileUrl,
          file_size: fileSize,
          file_format: fileFormat,
        })
        .eq("id", id);

      if (error) throw error;

      // Log update
      await supabase.from("logs").insert({
        user_id: user?.id,
        action_type: "offer_updated",
        message: `Offre modifiée: ${offerData.title}`,
        metadata: { offerId: id },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-offers"] });
      queryClient.invalidateQueries({ queryKey: ["offers"] });
      toast.success("Offre modifiée avec succès !");
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Erreur lors de la modification");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("offers").delete().eq("id", id);
      if (error) throw error;

      // Log deletion
      await supabase.from("logs").insert({
        user_id: user?.id,
        action_type: "offer_deleted",
        message: "Offre supprimée",
        metadata: { offerId: id },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-offers"] });
      queryClient.invalidateQueries({ queryKey: ["offers"] });
      toast.success("Offre supprimée !");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erreur lors de la suppression");
    },
  });

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setPrice("0");
    setTags("");
    setFile(null);
    setEditingOffer(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const validated = offerSchema.parse({
        title,
        description,
        price: parseFloat(price),
        tags,
      });

      const offerData = {
        title: validated.title,
        description: validated.description,
        price: validated.price,
        tags: validated.tags.split(",").map(t => t.trim()).filter(Boolean),
      };

      if (editingOffer) {
        updateMutation.mutate({ id: editingOffer.id, ...offerData });
      } else {
        createMutation.mutate(offerData);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      }
    }
  };

  const handleEdit = (offer: any) => {
    setEditingOffer(offer);
    setTitle(offer.title);
    setDescription(offer.description);
    setPrice(offer.price.toString());
    setTags(offer.tags?.join(", ") || "");
    setIsDialogOpen(true);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetForm();
    }
    setIsDialogOpen(open);
  };

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground">Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-display font-bold">Mes Offres</h2>
        <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-button shadow-glow-cyan">
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle offre
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingOffer ? "Modifier l'offre" : "Créer une nouvelle offre"}</DialogTitle>
              <DialogDescription>
                Ajoutez les détails de votre offre
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Titre *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Aimbot CS2 Premium"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Décrivez votre offre en détail..."
                  rows={4}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Prix (€) *</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tags">Tags (séparés par virgules)</Label>
                  <Input
                    id="tags"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="cs2, aimbot, premium"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="file">Fichier téléchargeable *</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="file"
                    type="file"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    accept=".zip,.rar,.7z,.exe,.dll,.txt,.html,.css,.php,.py,.c,.cpp,.js,.json,.xml"
                    className="cursor-pointer"
                  />
                  {file && (
                    <Badge variant="outline" className="whitespace-nowrap">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </Badge>
                  )}
                </div>
                {editingOffer?.file_url && !file && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Upload className="h-3 w-3" />
                    Fichier actuel: {editingOffer.file_format?.toUpperCase()} ({(editingOffer.file_size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                  Annuler
                </Button>
                <Button 
                  type="submit" 
                  className="bg-gradient-button shadow-glow-cyan"
                  disabled={uploading}
                >
                  {uploading ? "Upload en cours..." : editingOffer ? "Modifier" : "Créer"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {!offers || offers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Aucune offre. Créez votre première offre !
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {offers.map((offer) => (
            <Card key={offer.id} className="card-glow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-xl mb-2">{offer.title}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {offer.description}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleEdit(offer)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        if (confirm("Supprimer cette offre ?")) {
                          deleteMutation.mutate(offer.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-4">
                  <Badge variant="default" className="bg-gradient-button">
                    {offer.price > 0 ? `${offer.price}€` : "GRATUIT"}
                  </Badge>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Download className="h-4 w-4" />
                    {offer.download_count} téléchargements
                  </div>
                  {offer.tags && offer.tags.length > 0 && (
                    <div className="flex gap-2">
                      {offer.tags.map((tag: string) => (
                        <Badge key={tag} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
