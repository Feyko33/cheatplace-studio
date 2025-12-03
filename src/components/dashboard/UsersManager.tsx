import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Edit, Ban, UserCheck, Search, Shield, Users, Globe } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface UserWithRole {
  id: string;
  username: string;
  active: boolean;
  created_at: string;
  last_login: string | null;
  ip_last_login: string | null;
  role: AppRole;
}

export const UsersManager = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editRole, setEditRole] = useState<AppRole>("client");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [banIpDialogOpen, setBanIpDialogOpen] = useState(false);
  const [ipToBan, setIpToBan] = useState("");
  const [banReason, setBanReason] = useState("");
  const queryClient = useQueryClient();

  const { data: users, isLoading } = useQuery({
    queryKey: ["users-with-roles"],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      const usersWithRoles: UserWithRole[] = profiles.map((profile) => {
        const userRole = roles.find((r) => r.user_id === profile.id);
        return {
          id: profile.id,
          username: profile.username,
          active: profile.active,
          created_at: profile.created_at,
          last_login: profile.last_login,
          ip_last_login: profile.ip_last_login,
          role: userRole?.role || "client",
        };
      });

      return usersWithRoles;
    },
  });

  const { data: bannedIps } = useQuery({
    queryKey: ["banned-ips"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("banned_ips")
        .select("*")
        .order("banned_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async ({ userId, username, active }: { userId: string; username: string; active: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ username, active })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      toast.success("Profil mis à jour");
    },
    onError: (error: any) => {
      toast.error("Erreur: " + error.message);
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      await supabase.from("user_roles").delete().eq("user_id", userId);
      
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role });
      
      if (error) throw error;

      await supabase
        .from("profiles")
        .update({ role })
        .eq("id", userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      toast.success("Rôle mis à jour");
    },
    onError: (error: any) => {
      toast.error("Erreur: " + error.message);
    },
  });

  const toggleBanMutation = useMutation({
    mutationFn: async ({ userId, active }: { userId: string; active: boolean }) => {
      const { data, error } = await supabase.functions.invoke("ban-user", {
        body: { userId, ban: !active }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      toast.success(variables.active ? "Utilisateur banni" : "Utilisateur débanni");
    },
    onError: (error: any) => {
      toast.error("Erreur: " + error.message);
    },
  });

  const banIpMutation = useMutation({
    mutationFn: async ({ ip, reason }: { ip: string; reason?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("banned_ips")
        .insert({ 
          ip_address: ip, 
          reason,
          banned_by: user?.id 
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["banned-ips"] });
      toast.success("IP bannie avec succès");
      setBanIpDialogOpen(false);
      setIpToBan("");
      setBanReason("");
    },
    onError: (error: any) => {
      if (error.message.includes("duplicate")) {
        toast.error("Cette IP est déjà bannie");
      } else {
        toast.error("Erreur: " + error.message);
      }
    },
  });

  const unbanIpMutation = useMutation({
    mutationFn: async (ip: string) => {
      const { error } = await supabase
        .from("banned_ips")
        .delete()
        .eq("ip_address", ip);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["banned-ips"] });
      toast.success("IP débannie avec succès");
    },
    onError: (error: any) => {
      toast.error("Erreur: " + error.message);
    },
  });

  const handleEdit = (user: UserWithRole) => {
    setEditingUser(user);
    setEditUsername(user.username);
    setEditRole(user.role);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editingUser) return;

    await updateProfileMutation.mutateAsync({
      userId: editingUser.id,
      username: editUsername,
      active: editingUser.active,
    });

    if (editRole !== editingUser.role) {
      await updateRoleMutation.mutateAsync({
        userId: editingUser.id,
        role: editRole,
      });
    }

    setDialogOpen(false);
    setEditingUser(null);
  };

  const handleToggleBan = (user: UserWithRole) => {
    toggleBanMutation.mutate({ userId: user.id, active: !user.active });
  };

  const handleBanUserIp = (user: UserWithRole) => {
    if (user.ip_last_login) {
      setIpToBan(user.ip_last_login);
      setBanIpDialogOpen(true);
    } else {
      toast.error("Aucune IP connue pour cet utilisateur");
    }
  };

  const filteredUsers = users?.filter(
    (user) =>
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleBadgeVariant = (role: AppRole) => {
    switch (role) {
      case "admin":
        return "destructive";
      case "vendor":
        return "default";
      default:
        return "secondary";
    }
  };

  if (isLoading) {
    return (
      <Card className="card-glow">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Shield className="h-8 w-8 animate-pulse text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="card-glow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Gestion des utilisateurs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom ou ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {filteredUsers?.map((user) => (
              <div
                key={user.id}
                className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg gap-3 ${
                  !user.active ? "opacity-50 bg-destructive/10 border-destructive/30" : ""
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{user.username}</span>
                    <Badge variant={getRoleBadgeVariant(user.role)}>{user.role}</Badge>
                    {!user.active && (
                      <Badge variant="destructive">BANNI</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ID: {user.id.slice(0, 8)}...
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Dernière connexion: {user.last_login ? new Date(user.last_login).toLocaleString("fr-FR") : "Jamais"}
                  </p>
                  {user.ip_last_login && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      IP: {user.ip_last_login}
                    </p>
                  )}
                </div>
                
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(user)}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Modifier
                  </Button>
                  <Button
                    variant={user.active ? "destructive" : "default"}
                    size="sm"
                    onClick={() => handleToggleBan(user)}
                  >
                    {user.active ? (
                      <>
                        <Ban className="h-4 w-4 mr-1" />
                        Bannir
                      </>
                    ) : (
                      <>
                        <UserCheck className="h-4 w-4 mr-1" />
                        Débannir
                      </>
                    )}
                  </Button>
                  {user.ip_last_login && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleBanUserIp(user)}
                      className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                    >
                      <Globe className="h-4 w-4 mr-1" />
                      Ban IP
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Modifier l'utilisateur</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Nom d'utilisateur</Label>
                  <Input
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rôle</Label>
                  <Select value={editRole} onValueChange={(v) => setEditRole(v as AppRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="client">Client</SelectItem>
                      <SelectItem value="vendor">Vendeur</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Annuler
                </Button>
                <Button onClick={handleSave}>
                  Sauvegarder
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={banIpDialogOpen} onOpenChange={setBanIpDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Bannir une adresse IP</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Adresse IP</Label>
                  <Input
                    value={ipToBan}
                    onChange={(e) => setIpToBan(e.target.value)}
                    placeholder="192.168.1.1"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Raison (optionnel)</Label>
                  <Input
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                    placeholder="Raison du ban..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setBanIpDialogOpen(false)}>
                  Annuler
                </Button>
                <Button 
                  variant="destructive"
                  onClick={() => banIpMutation.mutate({ ip: ipToBan, reason: banReason })}
                  disabled={!ipToBan}
                >
                  Bannir IP
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* Section IPs bannies */}
      <Card className="card-glow">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              IPs bannies
            </CardTitle>
            <Button
              size="sm"
              onClick={() => {
                setIpToBan("");
                setBanReason("");
                setBanIpDialogOpen(true);
              }}
            >
              Ajouter une IP
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {bannedIps && bannedIps.length > 0 ? (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {bannedIps.map((ban) => (
                <div
                  key={ban.id}
                  className="flex items-center justify-between p-3 border rounded-lg bg-destructive/5 border-destructive/20"
                >
                  <div>
                    <p className="font-mono font-medium">{ban.ip_address}</p>
                    {ban.reason && (
                      <p className="text-xs text-muted-foreground">Raison: {ban.reason}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Banni le: {new Date(ban.banned_at).toLocaleString("fr-FR")}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => unbanIpMutation.mutate(ban.ip_address)}
                  >
                    <UserCheck className="h-4 w-4 mr-1" />
                    Débannir
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">
              Aucune IP bannie
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
