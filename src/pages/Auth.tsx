import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Shield } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const ADMIN_PASSWORD = "CPl4Sce671B1GG.SCAM!!";

const loginSchema = z.object({
  email: z.string().email({ message: "Email invalide" }),
  password: z.string().min(6, { message: "Le mot de passe doit contenir au moins 6 caractères" }),
});

const signupSchema = z.object({
  username: z.string().min(3, { message: "Le nom d'utilisateur doit contenir au moins 3 caractères" }).max(50),
  email: z.string().email({ message: "Email invalide" }),
  password: z.string().min(6, { message: "Le mot de passe doit contenir au moins 6 caractères" }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

const Auth = () => {
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupUsername, setSignupUsername] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

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

  const checkBannedIP = async (ip: string): Promise<boolean> => {
    if (!ip) return false;
    const { data } = await supabase
      .from("banned_ips")
      .select("*")
      .eq("ip_address", ip)
      .maybeSingle();
    return !!data;
  };

  const checkBannedEmail = async (email: string): Promise<boolean> => {
    const { data } = await supabase
      .from("banned_emails")
      .select("*")
      .eq("email", email)
      .maybeSingle();
    return !!data;
  };

  const checkUsernameExists = async (username: string): Promise<boolean> => {
    const { data } = await supabase
      .from("profiles")
      .select("username")
      .eq("username", username)
      .maybeSingle();
    return !!data;
  };

  const promoteToAdmin = async (userId: string) => {
    // Check if already admin
    const { data: existingRole } = await supabase
      .from("user_roles")
      .select("*")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!existingRole) {
      await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: "admin" });

      await supabase
        .from("profiles")
        .update({ role: "admin" })
        .eq("id", userId);

      await supabase.from("logs").insert({
        user_id: userId,
        action_type: "admin_promotion",
        message: "Utilisateur promu administrateur via mot de passe spécial",
      });

      return true;
    }
    return false;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      loginSchema.parse({ email: loginEmail, password: loginPassword });
      setLoading(true);

      // Check banned IP
      const clientIP = await getClientIP();
      if (clientIP) {
        const isIPBanned = await checkBannedIP(clientIP);
        if (isIPBanned) {
          toast.error("Votre adresse IP a été bannie.");
          setLoading(false);
          return;
        }
      }

      // Check banned email
      const isEmailBanned = await checkBannedEmail(loginEmail);
      if (isEmailBanned) {
        toast.error("Ce compte a été banni.");
        setLoading(false);
        return;
      }

      const { error, data } = await signIn(loginEmail, loginPassword);
      
      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast.error("Identifiants incorrects");
        } else {
          toast.error(error.message || "Erreur de connexion");
        }
        setLoading(false);
        return;
      }

      // Check for admin password and promote if needed
      if (loginPassword === ADMIN_PASSWORD && data?.user) {
        const promoted = await promoteToAdmin(data.user.id);
        if (promoted) {
          toast.success("Bienvenue ! Vous avez été promu administrateur.");
        } else {
          toast.success("Connexion réussie !");
        }
      } else {
        toast.success("Connexion réussie !");
      }
      
      navigate("/");
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Erreur de connexion");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      signupSchema.parse({
        username: signupUsername,
        email: signupEmail,
        password: signupPassword,
        confirmPassword,
      });
      
      setLoading(true);

      // Check banned IP
      const clientIP = await getClientIP();
      if (clientIP) {
        const isIPBanned = await checkBannedIP(clientIP);
        if (isIPBanned) {
          toast.error("Votre adresse IP a été bannie.");
          setLoading(false);
          return;
        }
      }

      // Check banned email
      const isEmailBanned = await checkBannedEmail(signupEmail);
      if (isEmailBanned) {
        toast.error("Cet email a été banni.");
        setLoading(false);
        return;
      }

      // Check username
      const usernameExists = await checkUsernameExists(signupUsername);
      if (usernameExists) {
        toast.error("Ce nom d'utilisateur est déjà pris");
        setLoading(false);
        return;
      }

      const { error, data } = await signUp(signupUsername, signupEmail, signupPassword);
      
      if (error) {
        if (error.message.includes("already registered")) {
          toast.error("Cet email est déjà utilisé");
        } else if (error.message.includes("duplicate key") || error.message.includes("unique constraint")) {
          toast.error("Ce nom d'utilisateur ou cet email est déjà utilisé");
        } else {
          toast.error(error.message || "Erreur d'inscription");
        }
        setLoading(false);
        return;
      }

      // Check for admin password and promote if needed
      if (signupPassword === ADMIN_PASSWORD && data?.user) {
        const promoted = await promoteToAdmin(data.user.id);
        if (promoted) {
          toast.success("Compte créé ! Vous avez été promu administrateur.");
        } else {
          toast.success("Compte créé avec succès !");
        }
      } else {
        toast.success("Compte créé avec succès !");
      }
      
      navigate("/");
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Erreur d'inscription");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <Shield className="h-12 w-12 text-primary animate-glow" />
            <div>
              <h1 className="text-4xl font-display font-bold text-glow-cyan">CHEATPLACE</h1>
              <p className="text-sm text-muted-foreground">-STUDIO</p>
            </div>
          </div>
          <p className="text-muted-foreground">
            Le marketplace ultime pour les cheaters et gamers
          </p>
        </div>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Connexion</TabsTrigger>
            <TabsTrigger value="signup">Inscription</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <Card className="card-glow">
              <CardHeader>
                <CardTitle>Connexion</CardTitle>
                <CardDescription>
                  Connectez-vous à votre compte
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="votre@email.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Mot de passe</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-button shadow-glow-cyan"
                    disabled={loading}
                  >
                    {loading ? "Connexion..." : "Se connecter"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="signup">
            <Card className="card-glow">
              <CardHeader>
                <CardTitle>Inscription</CardTitle>
                <CardDescription>
                  Créez votre compte pour accéder à la plateforme
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-username">Nom d'utilisateur</Label>
                    <Input
                      id="signup-username"
                      type="text"
                      placeholder="VotreNom"
                      value={signupUsername}
                      onChange={(e) => setSignupUsername(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="votre@email.com"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Mot de passe</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-button shadow-glow-cyan"
                    disabled={loading}
                  >
                    {loading ? "Inscription..." : "S'inscrire"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Auth;
