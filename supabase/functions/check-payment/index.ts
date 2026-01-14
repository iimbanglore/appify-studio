import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
    const { buildId } = await req.json();

    if (!buildId) {
      throw new Error("Build ID is required");
    }

    console.log("Checking payment status for build:", buildId);

    // Initialize Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if payment exists and is completed
    const { data: payment, error } = await supabase
      .from("payments")
      .select("*")
      .eq("build_id", buildId)
      .eq("status", "completed")
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Error checking payment:", error);
      throw error;
    }

    const isPaid = !!payment;
    console.log("Payment status for build", buildId, ":", isPaid ? "PAID" : "NOT PAID");

    return new Response(
      JSON.stringify({ 
        paid: isPaid,
        payment: isPaid ? {
          id: payment.id,
          amount: payment.amount,
          currency: payment.currency,
          paidAt: payment.updated_at,
        } : null
      }),
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
