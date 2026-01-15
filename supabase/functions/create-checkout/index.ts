import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("Stripe secret key not configured");
    }

    const { buildId, appName, successUrl, cancelUrl } = await req.json();

    if (!buildId) {
      throw new Error("Build ID is required");
    }

    console.log("Creating checkout session for build:", buildId, "app:", appName);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) {
        userId = user.id;
      }
    }

    console.log("User ID:", userId);

    // Check if payment already exists for this build
    const { data: existingPayment } = await supabase
      .from("payments")
      .select("*")
      .eq("build_id", buildId)
      .eq("status", "completed")
      .single();

    if (existingPayment) {
      console.log("Payment already completed for build:", buildId);
      return new Response(
        JSON.stringify({ alreadyPaid: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Stripe
    const stripe = new Stripe(stripeKey, {
      apiVersion: "2023-10-16",
    });

    // Create checkout session - note: we add session_id to success URL for direct verification
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "inr",
            product_data: {
              name: `App Download - ${appName || "Mobile App"}`,
              description: "Download access for your mobile app (APK, AAB, or IPA)",
            },
            unit_amount: 280000, // 2800 INR in paise
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      // Include session_id in URL using {CHECKOUT_SESSION_ID} placeholder
      success_url: successUrl 
        ? `${successUrl}&session_id={CHECKOUT_SESSION_ID}` 
        : `${req.headers.get("origin")}/builder?payment=success&build_id=${buildId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${req.headers.get("origin")}/builder?payment=cancelled`,
      metadata: {
        build_id: buildId,
        user_id: userId || "",
        app_name: appName || "",
      },
    });

    console.log("Created checkout session:", session.id);

    // Create pending payment record
    const { error: insertError } = await supabase.from("payments").insert({
      user_id: userId,
      build_id: buildId,
      stripe_session_id: session.id,
      amount: 280000,
      currency: "inr",
      status: "pending",
    });

    if (insertError) {
      console.error("Error creating payment record:", insertError);
      // Continue anyway - webhook will handle it
    }

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error creating checkout session:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
