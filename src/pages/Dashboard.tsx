import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Navbar } from "@/components/Navbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, Package, Megaphone, Users, Activity, Shield } from "lucide-react";
import { StatsOverview } from "@/components/dashboard/StatsOverview";
import { OffersManager } from "@/components/dashboard/OffersManager";
import { AnnouncementsManager } from "@/components/dashboard/AnnouncementsManager";
import { UsersManager } from "@/components/dashboard/UsersManager";
import { LogsViewer } from "@/components/dashboard/LogsViewer";

const Dashboard = () => {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && (!user || !profile || (profile.role !== "vendor" && profile.role !== "admin"))) {
      navigate("/");
    }
  }, [user, profile, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-12 w-12 text-primary animate-glow mx-auto mb-4" />
          <p className="text-muted-foreground">Chargement du dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile || (profile.role !== "vendor" && profile.role !== "admin")) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-12">
        <div className="container mx-auto px-4">
          <div className="mb-8 animate-slide-up">
            <h1 className="text-4xl font-display font-bold text-glow-cyan mb-2">
              DASHBOARD
            </h1>
            <p className="text-muted-foreground">
              Bienvenue, {profile.username} ({profile.role})
            </p>
          </div>

          <Tabs defaultValue="stats" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5 gap-2">
              <TabsTrigger value="stats" className="gap-2">
                <LayoutDashboard className="h-4 w-4" />
                <span className="hidden sm:inline">Stats</span>
              </TabsTrigger>
              <TabsTrigger value="offers" className="gap-2">
                <Package className="h-4 w-4" />
                <span className="hidden sm:inline">Offres</span>
              </TabsTrigger>
              <TabsTrigger value="announcements" className="gap-2">
                <Megaphone className="h-4 w-4" />
                <span className="hidden sm:inline">Annonces</span>
              </TabsTrigger>
              {profile.role === "admin" && (
                <TabsTrigger value="users" className="gap-2">
                  <Users className="h-4 w-4" />
                  <span className="hidden sm:inline">Utilisateurs</span>
                </TabsTrigger>
              )}
              <TabsTrigger value="logs" className="gap-2">
                <Activity className="h-4 w-4" />
                <span className="hidden sm:inline">Logs</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="stats">
              <StatsOverview />
            </TabsContent>

            <TabsContent value="offers">
              <OffersManager />
            </TabsContent>

            <TabsContent value="announcements">
              <AnnouncementsManager />
            </TabsContent>

            {profile.role === "admin" && (
              <TabsContent value="users">
                <UsersManager />
              </TabsContent>
            )}

            <TabsContent value="logs">
              <LogsViewer />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
