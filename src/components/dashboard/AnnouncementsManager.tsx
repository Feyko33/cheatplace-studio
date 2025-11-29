import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit, Trash2, Pin } from "lucide-react";
import { toast } from "sonner";

export const AnnouncementsManager = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [visible, setVisible] = useState(true);
  const [pinned, setPinned] = useState(false);

  const { data: announcements } = useQuery({
    queryKey: ["my-announcements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .eq("author_id", user?.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("announcements").insert({ ...data, author_id: user?.id });
      if (error) throw error;

      await supabase.from("logs").insert({
        user_id: user?.id,
        action_type: "announcement_created",
        message: `Annonce créée: ${data.title}`,
        metadata: { title: data.title },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-announcements"] });
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      toast.success("Annonce créée !");
      resetForm();
      setIsDialogOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const { error } = await supabase
        .from("announcements")
        .update(data)
        .eq("id", id);
      if (error) throw error;

      await supabase.from("logs").insert({
        user_id: user?.id,
        action_type: "announcement_updated",
        message: `Annonce modifiée: ${data.title}`,
        metadata: { announcementId: id },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-announcements"] });
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      toast.success("Annonce modifiée !");
      resetForm();
      setIsDialogOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("announcements").delete().eq("id", id);
      if (error) throw error;

      await supabase.from("logs").insert({
        user_id: user?.id,
        action_type: "announcement_deleted",
        message: "Annonce supprimée",
        metadata: { announcementId: id },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-announcements"] });
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      toast.success("Annonce supprimée !");
    },
  });

  const resetForm = () => {
    setTitle("");
    setContent("");
    setVisible(true);
    setPinned(false);
    setEditingAnnouncement(null);
  };

  const handleEdit = (announcement: any) => {
    setEditingAnnouncement(announcement);
    setTitle(announcement.title);
    setContent(announcement.content);
    setVisible(announcement.visible);
    setPinned(announcement.pinned);
    setIsDialogOpen(true);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetForm();
    }
    setIsDialogOpen(open);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-display font-bold">Annonces</h2>
        <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-button shadow-glow-cyan">
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle annonce
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingAnnouncement ? "Modifier l'annonce" : "Créer une annonce"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (editingAnnouncement) {
                updateMutation.mutate({ id: editingAnnouncement.id, title, content, visible, pinned });
              } else {
                createMutation.mutate({ title, content, visible, pinned });
              }
            }} className="space-y-4">
              <div>
                <Label htmlFor="title">Titre</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="content">Contenu</Label>
                <Textarea id="content" value={content} onChange={(e) => setContent(e.target.value)} rows={6} required />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={visible} onCheckedChange={setVisible} />
                <Label>Visible</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={pinned} onCheckedChange={setPinned} />
                <Label>Épingler</Label>
              </div>
              <Button type="submit" className="w-full bg-gradient-button">
                {editingAnnouncement ? "Modifier" : "Publier"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid gap-4">
        {announcements?.map((a) => (
          <Card key={a.id} className="card-glow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-2">
                    {a.title}
                    {a.pinned && <Pin className="h-4 w-4 text-primary" />}
                  </CardTitle>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleEdit(a)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      if (confirm("Supprimer cette annonce ?")) {
                        deleteMutation.mutate(a.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{a.content}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
