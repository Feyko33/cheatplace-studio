import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Shield, Mail, ArrowLeft } from "lucide-react";
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

type AuthStep = "credentials" | "verification";

const Auth = () => {
  const [step, setStep] = useState<AuthStep>("credentials");
  const [authType, setAuthType] = useState<"login" | "signup">("login");
  
  // Credentials state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupUsername, setSignupUsername] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // Verification state
  const [verificationCode, setVerificationCode] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [pendingPassword, setPendingPassword] = useState("");
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

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

  const sendVerificationCode = async (email: string, type: "login" | "signup", userId?: string) => {
    const response = await supabase.functions.invoke('send-verification-email', {
      body: { email, type, user_id: userId }
    });
    
    if (response.error) {
      throw new Error(response.error.message || "Erreur lors de l'envoi du code");
    }
    
    return response.data;
  };

  const verifyCode = async (email: string, code: string, type: "login" | "signup", password: string) => {
    const response = await supabase.functions.invoke('verify-code', {
      body: { email, code, type, password }
    });
    
    if (response.error) {
      throw new Error(response.error.message || "Erreur lors de la vérification");
    }
    
    return response.data;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      loginSchema.parse({ email: loginEmail, password: loginPassword });
      setLoading(true);

      // Vérifier si l'IP est bannie
      const clientIP = await getClientIP();
      if (clientIP) {
        const isIPBanned = await checkBannedIP(clientIP);
        if (isIPBanned) {
          toast.error("Votre adresse IP a été bannie.");
          setLoading(false);
          return;
        }
      }

      // Vérifier si l'email est banni
      const isEmailBanned = await checkBannedEmail(loginEmail);
      if (isEmailBanned) {
        toast.error("Ce compte a été banni.");
        setLoading(false);
        return;
      }

      // Tenter de se connecter pour valider les credentials
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast.error("Identifiants incorrects");
        } else {
          toast.error(error.message || "Erreur de connexion");
        }
        setLoading(false);
        return;
      }

      // Se déconnecter immédiatement (on veut d'abord vérifier le code)
      await supabase.auth.signOut();

      // Envoyer le code de vérification
      await sendVerificationCode(loginEmail, "login", data.user?.id);
      
      setPendingEmail(loginEmail);
      setPendingPassword(loginPassword);
      setPendingUserId(data.user?.id || null);
      setAuthType("login");
      setStep("verification");
      setResendCooldown(60);
      
      toast.success("Un code de vérification a été envoyé à votre email");
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

      // Vérifier si l'IP est bannie
      const clientIP = await getClientIP();
      if (clientIP) {
        const isIPBanned = await checkBannedIP(clientIP);
        if (isIPBanned) {
          toast.error("Votre adresse IP a été bannie.");
          setLoading(false);
          return;
        }
      }

      // Vérifier si l'email est banni
      const isEmailBanned = await checkBannedEmail(signupEmail);
      if (isEmailBanned) {
        toast.error("Cet email a été banni.");
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

      // Créer le compte
      const { error } = await signUp(signupUsername, signupEmail, signupPassword);
      
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

      // Récupérer l'ID de l'utilisateur créé
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;

      // Se déconnecter pour attendre la vérification
      await supabase.auth.signOut();

      // Envoyer le code de vérification
      await sendVerificationCode(signupEmail, "signup", userId);
      
      setPendingEmail(signupEmail);
      setPendingPassword(signupPassword);
      setPendingUserId(userId || null);
      setAuthType("signup");
      setStep("verification");
      setResendCooldown(60);
      
      toast.success("Un code de vérification a été envoyé à votre email");
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

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (verificationCode.length !== 6) {
      toast.error("Le code doit contenir 6 chiffres");
      return;
    }

    setLoading(true);
    
    try {
      // Vérifier le code
      const result = await verifyCode(pendingEmail, verificationCode, authType, pendingPassword);
      
      if (!result.valid) {
        toast.error("Code invalide ou expiré");
        setLoading(false);
        return;
      }

      // Se connecter définitivement
      const { error } = await supabase.auth.signInWithPassword({
        email: pendingEmail,
        password: pendingPassword,
      });

      if (error) {
        toast.error(error.message || "Erreur de connexion");
        setLoading(false);
        return;
      }

      // Mettre à jour les infos de connexion
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        const clientIP = await getClientIP();
        
        const { data: profileData } = await supabase
          .from("profiles")
          .select("login_count")
          .eq("id", currentUser.id)
          .single();

        await supabase
          .from("profiles")
          .update({ 
            last_login: new Date().toISOString(),
            login_count: (profileData?.login_count || 0) + 1,
            ip_last_login: clientIP
          })
          .eq("id", currentUser.id);

        await supabase.from("logs").insert({
          user_id: currentUser.id,
          action_type: authType === "login" ? "login" : "signup_complete",
          message: authType === "login" ? "Connexion réussie" : "Inscription complétée",
          metadata: { email: pendingEmail, ip: clientIP },
        });
      }

      if (result.promotedToAdmin) {
        toast.success("Bienvenue ! Vous avez été promu administrateur.");
      } else {
        toast.success(authType === "login" ? "Connexion réussie !" : "Compte créé avec succès !");
      }
      
      navigate("/");
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Erreur lors de la vérification");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) return;
    
    setLoading(true);
    try {
      await sendVerificationCode(pendingEmail, authType, pendingUserId || undefined);
      setResendCooldown(60);
      toast.success("Nouveau code envoyé");
    } catch (error) {
      toast.error("Erreur lors de l'envoi du code");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep("credentials");
    setVerificationCode("");
    setPendingEmail("");
    setPendingPassword("");
    setPendingUserId(null);
  };

  if (step === "verification") {
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
          </div>

          <Card className="card-glow">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={handleBack}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5 text-primary" />
                    Vérification par email
                  </CardTitle>
                  <CardDescription>
                    Entrez le code à 6 chiffres envoyé à {pendingEmail}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleVerifyCode} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="verification-code">Code de vérification</Label>
                  <Input
                    id="verification-code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="000000"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                    className="text-center text-2xl tracking-widest font-mono"
                    required
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full bg-gradient-button shadow-glow-cyan"
                  disabled={loading || verificationCode.length !== 6}
                >
                  {loading ? "Vérification..." : "Vérifier le code"}
                </Button>
                <div className="text-center">
                  <Button
                    type="button"
                    variant="link"
                    onClick={handleResendCode}
                    disabled={resendCooldown > 0 || loading}
                    className="text-sm"
                  >
                    {resendCooldown > 0 
                      ? `Renvoyer le code (${resendCooldown}s)` 
                      : "Renvoyer le code"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

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
