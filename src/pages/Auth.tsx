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
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

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
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupUsername, setSignupUsername] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Email verification states
  const [authStep, setAuthStep] = useState<AuthStep>("credentials");
  const [verificationCode, setVerificationCode] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [pendingPassword, setPendingPassword] = useState("");
  const [pendingUsername, setPendingUsername] = useState("");
  const [pendingType, setPendingType] = useState<"login" | "signup">("login");
  
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  const sendVerificationCode = async (email: string, type: "login" | "signup") => {
    const { data, error } = await supabase.functions.invoke("send-verification-email", {
      body: { email, type },
    });

    if (error) {
      throw new Error("Erreur lors de l'envoi du code");
    }

    return data;
  };

  const verifyCode = async (email: string, code: string, type: "login" | "signup") => {
    const { data, error } = await supabase.functions.invoke("verify-code", {
      body: { email, code, type },
    });

    if (error) {
      throw new Error("Erreur lors de la vérification");
    }

    return data;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      loginSchema.parse({ email: loginEmail, password: loginPassword });
      
      setLoading(true);
      
      // Envoyer le code de vérification
      await sendVerificationCode(loginEmail, "login");
      
      // Sauvegarder les credentials et passer à l'étape de vérification
      setPendingEmail(loginEmail);
      setPendingPassword(loginPassword);
      setPendingType("login");
      setAuthStep("verification");
      
      toast.success("Code de vérification envoyé à " + loginEmail);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Erreur lors de l'envoi du code");
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
      
      // Envoyer le code de vérification
      await sendVerificationCode(signupEmail, "signup");
      
      // Sauvegarder les credentials et passer à l'étape de vérification
      setPendingEmail(signupEmail);
      setPendingPassword(signupPassword);
      setPendingUsername(signupUsername);
      setPendingType("signup");
      setAuthStep("verification");
      
      toast.success("Code de vérification envoyé à " + signupEmail);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Erreur lors de l'envoi du code");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (verificationCode.length !== 6) {
      toast.error("Veuillez entrer le code à 6 chiffres");
      return;
    }

    setLoading(true);

    try {
      // Vérifier le code
      const result = await verifyCode(pendingEmail, verificationCode, pendingType);

      if (!result.valid) {
        toast.error("Code invalide ou expiré");
        setLoading(false);
        return;
      }

      // Code valide, procéder à l'authentification
      if (pendingType === "login") {
        const { error } = await signIn(pendingEmail, pendingPassword);
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
      } else {
        const { error } = await signUp(pendingUsername, pendingEmail, pendingPassword);
        if (error) {
          if (error.message.includes("already registered")) {
            toast.error("Cet email est déjà utilisé");
          } else {
            toast.error(error.message || "Erreur d'inscription");
          }
        } else {
          toast.success("Compte créé avec succès !");
          navigate("/");
        }
      }
    } catch (error: any) {
      toast.error(error.message || "Erreur de vérification");
    } finally {
      setLoading(false);
    }
  };

  const handleBackToCredentials = () => {
    setAuthStep("credentials");
    setVerificationCode("");
    setPendingEmail("");
    setPendingPassword("");
    setPendingUsername("");
  };

  const handleResendCode = async () => {
    setLoading(true);
    try {
      await sendVerificationCode(pendingEmail, pendingType);
      toast.success("Nouveau code envoyé !");
    } catch (error) {
      toast.error("Erreur lors de l'envoi du code");
    } finally {
      setLoading(false);
    }
  };

  // Verification step UI
  if (authStep === "verification") {
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
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Vérification email
              </CardTitle>
              <CardDescription>
                Un code à 6 chiffres a été envoyé à <strong>{pendingEmail}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={verificationCode}
                  onChange={(value) => setVerificationCode(value)}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <Button
                onClick={handleVerifyCode}
                className="w-full bg-gradient-button shadow-glow-cyan"
                disabled={loading || verificationCode.length !== 6}
              >
                {loading ? "Vérification..." : "Vérifier"}
              </Button>

              <div className="flex flex-col gap-2">
                <Button
                  variant="ghost"
                  onClick={handleResendCode}
                  disabled={loading}
                  className="w-full"
                >
                  Renvoyer le code
                </Button>
                <Button
                  variant="outline"
                  onClick={handleBackToCredentials}
                  className="w-full"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Retour
                </Button>
              </div>
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
                    {loading ? "Envoi du code..." : "Se connecter"}
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
                    {loading ? "Envoi du code..." : "Créer un compte"}
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
