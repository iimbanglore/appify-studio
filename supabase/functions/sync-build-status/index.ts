import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { buildId } = await req.json();

    if (!buildId) {
      throw new Error("Build ID is required");
    }

    console.log("Syncing build status from Codemagic for:", buildId);

    const codemagicToken = Deno.env.get("CODEMAGIC_API_TOKEN");
    if (!codemagicToken) {
      throw new Error("Codemagic API token not configured");
    }

    // Fetch build status from Codemagic
    const response = await fetch(`https://api.codemagic.io/builds/${buildId}`, {
      headers: {
        "x-auth-token": codemagicToken,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Codemagic API error:", response.status, errorText);
      throw new Error(`Codemagic API error: ${response.status}`);
    }

    const buildData = await response.json();
    console.log("Codemagic build data:", JSON.stringify(buildData, null, 2));

    // Extract build info
    const build = buildData.build || buildData;
    const status = build.status?.toLowerCase() || "unknown";
    
    // Map Codemagic status to our status
    let mappedStatus = status;
    if (status === "finished") {
      mappedStatus = "completed";
    } else if (status === "preparing" || status === "fetching") {
      mappedStatus = "building";
    }

    // Extract artifacts
    let downloadUrl: string | null = null;
    let aabDownloadUrl: string | null = null;

    if (build.artefacts && Array.isArray(build.artefacts)) {
      console.log("Processing artifacts:", JSON.stringify(build.artefacts, null, 2));
      
      for (const artifact of build.artefacts) {
        const name = artifact.name?.toLowerCase() || "";
        const type = artifact.type?.toLowerCase() || "";
        
        if (type === "apk" || name.endsWith(".apk")) {
          downloadUrl = artifact.url;
          console.log("Found APK:", artifact.url);
        } else if (type === "aab" || name.endsWith(".aab")) {
          aabDownloadUrl = artifact.url;
          console.log("Found AAB:", artifact.url);
        } else if (type === "ipa" || name.endsWith(".ipa")) {
          if (!downloadUrl) {
            downloadUrl = artifact.url;
            console.log("Found IPA:", artifact.url);
          }
        }
      }
      
      // Fallback to first artifact
      if (!downloadUrl && build.artefacts.length > 0) {
        downloadUrl = build.artefacts[0].url;
      }
    }

    // Update database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const updateData: Record<string, unknown> = {
      status: mappedStatus,
      updated_at: new Date().toISOString(),
    };

    if (downloadUrl) {
      updateData.download_url = downloadUrl;
      updateData.artifact_url = downloadUrl;
    }
    if (aabDownloadUrl) {
      updateData.aab_download_url = aabDownloadUrl;
    }
    if (build.startedAt) {
      updateData.started_at = build.startedAt;
    }
    if (build.finishedAt) {
      updateData.finished_at = build.finishedAt;
    }
    if (build.error) {
      updateData.error_message = build.error;
    }

    console.log("Updating build in database:", JSON.stringify(updateData, null, 2));

    const { error: updateError } = await supabase
      .from("builds")
      .update(updateData)
      .eq("build_id", buildId);

    if (updateError) {
      console.error("Error updating build:", updateError);
      throw updateError;
    }

    // Fetch the updated build
    const { data: updatedBuild, error: fetchError } = await supabase
      .from("builds")
      .select("*")
      .eq("build_id", buildId)
      .single();

    if (fetchError) {
      console.error("Error fetching updated build:", fetchError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: mappedStatus,
        downloadUrl,
        aabDownloadUrl,
        build: updatedBuild,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error syncing build status:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
