import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerificationRequest {
  email: string;
  type: "login" | "signup";
  user_id?: string;
}

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, type, user_id }: VerificationRequest = await req.json();

    if (!email || !type) {
      return new Response(
        JSON.stringify({ error: "Email and type are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Supprimer les anciens codes pour cet email
    await supabase
      .from("verification_codes")
      .delete()
      .eq("email", email)
      .eq("verified", false);

    // Insérer le nouveau code
    const { error: insertError } = await supabase
      .from("verification_codes")
      .insert({
        email,
        code,
        type,
        user_id: user_id || null,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error("Error inserting verification code:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create verification code" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Envoyer l'email via Resend
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%); color: #ffffff;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #00d4ff; font-size: 28px; margin: 0;">LEAKZONE</h1>
          <p style="color: #888; margin-top: 5px;">Vérification de sécurité</p>
        </div>
        
        <div style="background: rgba(0, 212, 255, 0.1); border: 1px solid rgba(0, 212, 255, 0.3); border-radius: 12px; padding: 30px; text-align: center;">
          <p style="color: #ccc; margin-bottom: 20px;">
            ${type === 'login' ? 'Voici votre code pour vous connecter:' : 'Voici votre code pour finaliser votre inscription:'}
          </p>
          
          <div style="background: rgba(0, 0, 0, 0.5); border-radius: 8px; padding: 20px; margin: 20px 0;">
            <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #00d4ff;">${code}</span>
          </div>
          
          <p style="color: #888; font-size: 14px; margin-top: 20px;">
            Ce code expire dans 10 minutes.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1);">
          <p style="color: #666; font-size: 12px;">
            Si vous n'avez pas demandé ce code, ignorez cet email.
          </p>
        </div>
      </div>
    `;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "LEAKZONE <onboarding@resend.dev>",
        to: [email],
        subject: `Votre code de vérification: ${code}`,
        html: emailHtml,
      }),
    });

    const emailData = await emailResponse.json();
    console.log("Email response:", emailData);

    if (!emailResponse.ok) {
      console.error("Error sending email:", emailData);
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: emailData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Verification code sent" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-verification-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
