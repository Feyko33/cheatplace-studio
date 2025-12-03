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

  const checkBanned = async (email: string): Promise<boolean> => {
    const { data: bannedData } = await supabase
      .from("banned_emails")
      .select("*")
      .eq("email", email)
      .maybeSingle();
    
    return !!bannedData;
  };

  const checkUsernameExists = async (username: string): Promise<boolean> => {
    const { data } = await supabase
      .from("profiles")
      .select("username")
      .eq("username", username)
      .maybeSingle();
    
    return !!data;
  };

  const checkEmailExists = async (email: string): Promise<boolean> => {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", email)
      .maybeSingle();
    
    return !!data;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      loginSchema.parse({ email: loginEmail, password: loginPassword });
      
      setLoading(true);

      // Vérifier si l'email est banni
      const isBanned = await checkBanned(loginEmail);
      if (isBanned) {
        toast.error("Ce compte a été banni. Contactez l'administrateur.");
        setLoading(false);
        return;
      }
      
      const { error } = await signIn(loginEmail, loginPassword);
      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast.error("Identifiants incorrects");
        } else {
          toast.error(error.message || "Erreur de connexion");
        }
      } else {
        toast.success("Connexion réussie !");
        navigate("/");
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
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

      // Vérifier si l'email est banni
      const isBanned = await checkBanned(signupEmail);
      if (isBanned) {
        toast.error("Cet email a été banni. Contactez l'administrateur.");
        setLoading(false);
        return;
      }

      // Vérifier si le username existe déjà
      const usernameExists = await checkUsernameExists(signupUsername);
      if (usernameExists) {
        toast.error("Ce nom d'utilisateur est déjà pris");
        setLoading(false);
        return;
      }
      
      const { error } = await signUp(signupUsername, signupEmail, signupPassword);
      if (error) {
        if (error.message.includes("already registered")) {
          toast.error("Cet email est déjà utilisé");
        } else if (error.message.includes("duplicate key") || error.message.includes("unique constraint")) {
          toast.error("Ce nom d'utilisateur ou cet email est déjà utilisé");
        } else {
          toast.error(error.message || "Erreur d'inscription");
        }
      } else {
        toast.success("Compte créé avec succès !");
        navigate("/");
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
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
                  Créez votre compte gratuitement
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-username">Nom d'utilisateur</Label>
                    <Input
                      id="signup-username"
                      type="text"
                      placeholder="VotreUsername"
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
                    {loading ? "Création..." : "Créer un compte"}
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
