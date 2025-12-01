// verify-code/index.ts (version avec vérifications)
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyRequest {
  email: string;
  code: string;
  type: "login" | "signup";
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => null);
    if (!body) return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { email, code, type } = body as VerifyRequest;
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
    const { data: updData, error: updErr } = await supabase
      .from("verification_codes")
      .update({ verified: true })
      .eq("id", verificationData.id)
      .select();

    if (updErr) {
      console.error("Error marking code verified:", updErr);
      return new Response(JSON.stringify({ error: "Failed to update verification status", details: updErr }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ valid: true, message: "Code verified successfully", verification: verificationData }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("Error in verify-code function:", error);
    return new Response(JSON.stringify({ error: error?.message || String(error) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
};

serve(handler);
