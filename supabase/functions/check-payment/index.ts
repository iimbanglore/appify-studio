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
    const { buildId, sessionId } = await req.json();

    if (!buildId) {
      throw new Error("Build ID is required");
    }

    console.log("Checking payment status for build:", buildId, "sessionId:", sessionId);

    // Initialize Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // First check if we already have a completed payment in the database
    const { data: existingPayment, error: existingError } = await supabase
      .from("payments")
      .select("*")
      .eq("build_id", buildId)
      .eq("status", "completed")
      .single();

    if (!existingError && existingPayment) {
      console.log("Found completed payment in database:", existingPayment.id);
      return new Response(
        JSON.stringify({ 
          paid: true,
          payment: {
            id: existingPayment.id,
            amount: existingPayment.amount,
            currency: existingPayment.currency,
            paidAt: existingPayment.updated_at,
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If sessionId is provided, verify directly with Stripe
    if (sessionId) {
      console.log("Verifying session with Stripe:", sessionId);
      
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (!stripeKey) {
        throw new Error("Stripe secret key not configured");
      }

      const stripe = new Stripe(stripeKey, {
        apiVersion: "2023-10-16",
      });

      // Retrieve the session from Stripe
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      console.log("Stripe session status:", session.payment_status, "metadata:", session.metadata);

      // Check if payment was successful
      if (session.payment_status === "paid") {
        console.log("Payment confirmed by Stripe, updating database...");
        
        // Update payment record in database
        const { error: updateError } = await supabase
          .from("payments")
          .update({
            status: "completed",
            stripe_payment_intent_id: session.payment_intent as string,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_session_id", sessionId);

        if (updateError) {
          console.error("Error updating payment:", updateError);
          // Try to insert if update fails (in case payment record doesn't exist)
          const { error: insertError } = await supabase.from("payments").insert({
            build_id: buildId,
            user_id: session.metadata?.user_id || null,
            stripe_session_id: sessionId,
            stripe_payment_intent_id: session.payment_intent as string,
            amount: session.amount_total || 280000,
            currency: session.currency || "inr",
            status: "completed",
          });

          if (insertError) {
            console.error("Error inserting payment:", insertError);
          }
        }

        return new Response(
          JSON.stringify({ 
            paid: true,
            payment: {
              amount: session.amount_total,
              currency: session.currency,
              paidAt: new Date().toISOString(),
            }
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        console.log("Payment not yet completed, status:", session.payment_status);
      }
    }

    // No completed payment found
    console.log("No completed payment found for build:", buildId);
    return new Response(
      JSON.stringify({ paid: false, payment: null }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error checking payment:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
