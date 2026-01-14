import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
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

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2023-10-16",
    });

    // Get raw body for webhook signature verification
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    console.log("Received webhook event");

    let event: Stripe.Event;

    // If we have a webhook secret, verify the signature
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (webhookSecret && signature) {
      try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      } catch (err: unknown) {
        const errMessage = err instanceof Error ? err.message : "Unknown error";
        console.error("Webhook signature verification failed:", errMessage);
        return new Response(
          JSON.stringify({ error: "Webhook signature verification failed" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      // Parse event without verification (for development)
      event = JSON.parse(body);
      console.log("Warning: Processing webhook without signature verification");
    }

    console.log("Event type:", event.type);

    // Initialize Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      
      console.log("Checkout session completed:", session.id);
      console.log("Metadata:", session.metadata);

      const buildId = session.metadata?.build_id;
      const userId = session.metadata?.user_id;

      if (!buildId) {
        console.error("No build_id in session metadata");
        return new Response(
          JSON.stringify({ error: "No build_id in metadata" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update existing payment record or create new one
      const { data: existingPayment, error: fetchError } = await supabase
        .from("payments")
        .select("*")
        .eq("stripe_session_id", session.id)
        .single();

      if (existingPayment) {
        // Update existing record
        const { error: updateError } = await supabase
          .from("payments")
          .update({
            status: "completed",
            stripe_payment_intent_id: session.payment_intent as string,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_session_id", session.id);

        if (updateError) {
          console.error("Error updating payment:", updateError);
        } else {
          console.log("Payment record updated successfully");
        }
      } else {
        // Create new record (fallback)
        const { error: insertError } = await supabase.from("payments").insert({
          user_id: userId || null,
          build_id: buildId,
          stripe_session_id: session.id,
          stripe_payment_intent_id: session.payment_intent as string,
          amount: session.amount_total || 280000,
          currency: session.currency || "inr",
          status: "completed",
        });

        if (insertError) {
          console.error("Error inserting payment:", insertError);
        } else {
          console.log("Payment record created successfully");
        }
      }
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
