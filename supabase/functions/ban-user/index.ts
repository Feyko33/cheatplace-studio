import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BanRequest {
  userId: string;
  ban: boolean; // true = bannir, false = débannir
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, ban }: BanRequest = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "userId requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Récupérer l'email de l'utilisateur depuis auth.users
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId);

    if (userError || !user || !user.email) {
      console.error("Erreur récupération utilisateur:", userError);
      return new Response(
        JSON.stringify({ error: "Utilisateur non trouvé" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mettre à jour le statut actif dans profiles
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ active: !ban })
      .eq("id", userId);

    if (profileError) {
      console.error("Erreur mise à jour profile:", profileError);
      return new Response(
        JSON.stringify({ error: "Erreur lors de la mise à jour du profil" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (ban) {
      // Ajouter l'email à la liste des bannis
      const authHeader = req.headers.get("authorization");
      let bannedBy = null;
      
      if (authHeader) {
        const token = authHeader.replace("Bearer ", "");
        const { data: { user: currentUser } } = await supabase.auth.getUser(token);
        bannedBy = currentUser?.id;
      }

      const { error: banError } = await supabase
        .from("banned_emails")
        .insert({
          email: user.email,
          banned_by: bannedBy,
          reason: "Banni par l'administrateur"
        });

      if (banError && banError.code !== "23505") { // Ignorer erreur de duplicate
        console.error("Erreur ajout email banni:", banError);
      }
    } else {
      // Retirer l'email de la liste des bannis
      await supabase
        .from("banned_emails")
        .delete()
        .eq("email", user.email);
    }

    // Logger l'action
    await supabase.from("logs").insert({
      user_id: userId,
      action_type: ban ? "user_banned" : "user_unbanned",
      message: ban ? "Utilisateur banni" : "Utilisateur débanni",
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: ban ? "Utilisateur banni avec succès" : "Utilisateur débanni avec succès",
        email: user.email
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Erreur dans ban-user:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
