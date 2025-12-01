// send-verification-email/index.ts (version robuste)
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "OPTIONS, POST"
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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => null);
    if (!body) return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { email, type, user_id } = body as VerificationRequest;
    if (!email || !type) return new Response(JSON.stringify({ error: "Email and type are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Envs
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return new Response(JSON.stringify({ error: "Server configuration error (supabase)" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!RESEND_API_KEY) {
      console.error("Missing RESEND_API_KEY");
      return new Response(JSON.stringify({ error: "Server configuration error (resend)" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    // Supprimer anciens codes non vérifiés (try/catch pour ne pas planter)
    try {
      const { error: delErr } = await supabase.from("verification_codes").delete().eq("email", email).eq("verified", false);
      if (delErr) console.warn("Warning delete old codes:", delErr);
    } catch (e) {
      console.warn("Warning exception during delete old codes:", String(e));
    }

    // Insérer nouveau code (avec select pour aider au debug)
    let insertedRow: any = null;
    try {
      const { data, error } = await supabase
        .from("verification_codes")
        .insert({ email, code, type, user_id: user_id || null, expires_at: expiresAt, verified: false })
        .select();
      if (error) {
        console.error("Insert verification code error:", error);
        return new Response(JSON.stringify({ error: "Failed to create verification code", details: error }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      insertedRow = data?.[0] ?? null;
    } catch (err) {
      console.error("Exception inserting code:", err);
      return new Response(JSON.stringify({ error: "Failed to create verification code (exception)", details: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Construire l'HTML (utilise un template literal correctement)
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #07174a 0%, #0f2b5b 100%); color: #ffffff;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #7dd3fc; font-size: 28px; margin: 0;">CHEATPLACE-STUDIO</h1>
          <p style="color: #9fb8d9; margin-top: 6px;">Vérification de sécurité</p>
        </div>

        <div style="background: rgba(255,255,255,0.03); border-radius: 12px; padding: 24px; text-align: center; border: 1px solid rgba(125,211,252,0.08);">
          <p style="color: #cfefff; margin-bottom: 18px;">
            ${type === 'login' ? "Voici votre code pour vous connecter :" : "Voici votre code pour finaliser votre inscription :"}
          </p>

          <div style="display:inline-block; background: rgba(0,0,0,0.35); border-radius: 8px; padding: 16px 26px; margin: 18px 0;">
            <span style="font-size:36px; font-weight:700; letter-spacing:6px; color:#7dd3fc;">${code}</span>
          </div>

          <p style="color: #9fb8d9; font-size: 13px; margin-top: 12px;">Ce code expire dans 10 minutes.</p>
        </div>

        <div style="text-align:center; margin-top: 20px; color:#98bcd6; font-size:12px;">
          <p>Si vous n'avez pas demandé ce code, ignorez cet e-mail.</p>
        </div>
      </div>
    `;

    // Envoyer l'email via Resend
    let emailResponseRaw: any = null;
    try {
      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "CHEATPLACE <onboarding@resend.dev>",
          to: [email],
          subject: `Votre code de vérification • CHEATPLACE`,
          html: emailHtml,
        }),
      });

      // lire le body (json ou text)
      const contentType = resp.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        emailResponseRaw = await resp.json();
      } else {
        emailResponseRaw = { text: await resp.text(), status: resp.status };
      }

      console.log("Resend send status:", resp.status, "body:", emailResponseRaw);

      if (!resp.ok) {
        // supprimer le code inséré si l'envoi échoue (pour éviter codes flottants)
        try { await supabase.from("verification_codes").delete().eq("id", insertedRow?.id); } catch(e){/*ignore*/}

        return new Response(JSON.stringify({ error: "Failed to send email", details: emailResponseRaw }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } catch (err) {
      console.error("Fetch to Resend failed:", String(err));
      // supprimer le code inséré
      try { await supabase.from("verification_codes").delete().eq("id", insertedRow?.id); } catch(e){/*ignore*/}

      return new Response(JSON.stringify({ error: "Failed to contact email provider", details: String(err) }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Succès
    return new Response(JSON.stringify({ success: true, message: "Verification code sent", inserted: insertedRow, emailResult: emailResponseRaw }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("Unhandled error in send-verification-email:", error);
    return new Response(JSON.stringify({ error: error?.message || String(error) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
};

serve(handler);
