import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Edit, Ban, UserCheck, Search, Shield, Users } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface UserWithRole {
  id: string;
  username: string;
  active: boolean;
  created_at: string;
  last_login: string | null;
  role: AppRole;
}

export const UsersManager = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editRole, setEditRole] = useState<AppRole>("client");
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: users, isLoading } = useQuery({
    queryKey: ["users-with-roles"],
    queryFn: async () => {
      // Récupérer les profils
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Récupérer les rôles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Mapper les profils avec leurs rôles réels
      const usersWithRoles: UserWithRole[] = profiles.map((profile) => {
        const userRole = roles.find((r) => r.user_id === profile.id);
        return {
          id: profile.id,
          username: profile.username,
          active: profile.active,
          created_at: profile.created_at,
          last_login: profile.last_login,
          role: userRole?.role || "client",
        };
      });

      return usersWithRoles;
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
      // D'abord supprimer l'ancien rôle
      await supabase.from("user_roles").delete().eq("user_id", userId);
      
      // Puis ajouter le nouveau rôle
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role });
      
      if (error) throw error;

      // Mettre à jour aussi le profil pour cohérence
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
      const { error } = await supabase
        .from("profiles")
        .update({ active })
        .eq("id", userId);
      if (error) throw error;

      // Log l'action
      await supabase.from("logs").insert({
        action_type: active ? "user_unbanned" : "user_banned",
        message: active ? "Utilisateur débanni" : "Utilisateur banni",
        metadata: { target_user_id: userId },
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      toast.success(variables.active ? "Utilisateur débanni" : "Utilisateur banni");
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
              </div>
              
              <div className="flex gap-2">
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
      </CardContent>
    </Card>
  );
};
