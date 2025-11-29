import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Package, Megaphone, Download, TrendingUp } from "lucide-react";

export const StatsOverview = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [usersResult, offersResult, announcementsResult, downloadsResult] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("offers").select("id", { count: "exact", head: true }),
        supabase.from("announcements").select("id", { count: "exact", head: true }),
        supabase.from("offers").select("download_count"),
      ]);

      const totalDownloads = downloadsResult.data?.reduce((sum, offer) => sum + (offer.download_count || 0), 0) || 0;

      return {
        usersCount: usersResult.count || 0,
        offersCount: offersResult.count || 0,
        announcementsCount: announcementsResult.count || 0,
        totalDownloads,
      };
    },
  });

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground">Chargement des stats...</div>;
  }

  const statsCards = [
    {
      title: "Utilisateurs totaux",
      value: stats?.usersCount || 0,
      icon: Users,
      gradient: "from-primary to-accent",
    },
    {
      title: "Offres actives",
      value: stats?.offersCount || 0,
      icon: Package,
      gradient: "from-accent to-secondary",
    },
    {
      title: "Annonces publiées",
      value: stats?.announcementsCount || 0,
      icon: Megaphone,
      gradient: "from-secondary to-primary",
    },
    {
      title: "Téléchargements totaux",
      value: stats?.totalDownloads || 0,
      icon: Download,
      gradient: "from-primary to-secondary",
    },
  ];

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card 
              key={stat.title} 
              className="card-glow hover:scale-105 transition-all"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <Icon className="h-5 w-5 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold bg-gradient-to-r bg-clip-text text-transparent" 
                     style={{ 
                       backgroundImage: `linear-gradient(to right, hsl(var(--primary)), hsl(var(--accent)))` 
                     }}>
                  {stat.value.toLocaleString()}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="card-glow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Aperçu rapide
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Moyenne de téléchargements par offre</span>
            <span className="text-xl font-bold text-primary">
              {stats?.offersCount && stats.offersCount > 0 
                ? Math.round((stats.totalDownloads || 0) / stats.offersCount) 
                : 0}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Taux d'engagement</span>
            <span className="text-xl font-bold text-accent">
              {stats?.usersCount && stats.usersCount > 0
                ? `${Math.round(((stats.totalDownloads || 0) / stats.usersCount) * 100)}%`
                : "0%"}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
