import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Pin } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export const AnnouncementsSection = () => {
  const { data: announcements, isLoading } = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select(`
          *,
          profiles:author_id (username, role)
        `)
        .eq("visible", true)
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-display font-bold text-glow-purple mb-4">
              ANNONCES
            </h2>
            <p className="text-muted-foreground">Chargement des annonces...</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12 animate-slide-up">
          <h2 className="text-4xl font-display font-bold text-glow-purple mb-4">
            ANNONCES
          </h2>
          <p className="text-muted-foreground text-lg">
            Restez informé de nos dernières actualités
          </p>
        </div>

        {!announcements || announcements.length === 0 ? (
          <div className="text-center py-12">
            <Megaphone className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground text-lg">
              Aucune annonce pour le moment
            </p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            {announcements.map((announcement, index) => (
              <Card 
                key={announcement.id}
                className={`card-glow animate-slide-up ${
                  announcement.pinned ? "border-secondary shadow-glow-purple" : ""
                }`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {announcement.pinned && (
                          <Badge variant="secondary" className="gap-1">
                            <Pin className="h-3 w-3" />
                            Épinglé
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {announcement.profiles?.role === "admin" ? "Admin" : "Vendor"}
                        </Badge>
                      </div>
                      <CardTitle className="text-2xl mb-2">{announcement.title}</CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        <span>Par {announcement.profiles?.username || "Staff"}</span>
                        <span>•</span>
                        <span>
                          {format(new Date(announcement.created_at), "d MMM yyyy", { locale: fr })}
                        </span>
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div 
                    className="prose prose-invert max-w-none text-foreground"
                    dangerouslySetInnerHTML={{ __html: announcement.content }}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
