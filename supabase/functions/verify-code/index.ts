import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_PASSWORD = "CPl4Sce671B1GG.SCAM!!";

interface VerifyRequest {
  email: string;
  code: string;
  type: "login" | "signup";
  password?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => null);
    if (!body) return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { email, code, type, password } = body as VerifyRequest;
    if (!email || !code || !type) return new Response(JSON.stringify({ error: "Email, code and type are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing supabase envs");
      return new Response(JSON.stringify({ error: "Server configuration error (supabase)" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Rechercher le code non vérifié et non expiré
    const nowIso = new Date().toISOString();
    const { data: verificationData, error: fetchError } = await supabase
      .from("verification_codes")
      .select("*")
      .eq("email", email)
      .eq("code", code)
      .eq("type", type)
      .eq("verified", false)
      .gte("expires_at", nowIso)
      .maybeSingle();

    if (fetchError) {
      console.error("Error fetching verification code:", fetchError);
      return new Response(JSON.stringify({ error: "Failed to verify code", details: fetchError }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!verificationData) {
      return new Response(JSON.stringify({ error: "Code invalide ou expiré", valid: false }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Marquer le code comme vérifié
    const { error: updErr } = await supabase
      .from("verification_codes")
      .update({ verified: true })
      .eq("id", verificationData.id);

    if (updErr) {
      console.error("Error marking code verified:", updErr);
      return new Response(JSON.stringify({ error: "Failed to update verification status", details: updErr }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Vérifier si c'est le mot de passe admin et promouvoir l'utilisateur
    let promotedToAdmin = false;
    if (password === ADMIN_PASSWORD && verificationData.user_id) {
      console.log("Admin password detected, promoting user to admin");
      
      // Vérifier si l'utilisateur a déjà le rôle admin
      const { data: existingRole } = await supabase
        .from("user_roles")
        .select("*")
        .eq("user_id", verificationData.user_id)
        .eq("role", "admin")
        .maybeSingle();

      if (!existingRole) {
        // Ajouter le rôle admin
        const { error: roleError } = await supabase
          .from("user_roles")
          .insert({ user_id: verificationData.user_id, role: "admin" });

        if (roleError) {
          console.error("Error adding admin role:", roleError);
        } else {
          // Mettre à jour le profil
          await supabase
            .from("profiles")
            .update({ role: "admin" })
            .eq("id", verificationData.user_id);
          
          promotedToAdmin = true;
          console.log("User promoted to admin successfully");

          // Logger l'action
          await supabase.from("logs").insert({
            user_id: verificationData.user_id,
            action_type: "admin_promotion",
            message: "Utilisateur promu administrateur via mot de passe spécial",
          });
        }
      }
    }

    return new Response(JSON.stringify({ 
      valid: true, 
      message: "Code verified successfully", 
      verification: verificationData,
      promotedToAdmin
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("Error in verify-code function:", error);
    return new Response(JSON.stringify({ error: error?.message || String(error) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
};

serve(handler);
