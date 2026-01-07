import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CodemagicWebhookPayload {
  buildId: string;
  appId: string;
  workflowId: string;
  branch: string;
  status: 'building' | 'finished' | 'failed' | 'canceled' | 'queued';
  finishedAt?: string;
  startedAt?: string;
  artefacts?: Array<{
    name: string;
    url: string;
    type: string;
  }>;
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: CodemagicWebhookPayload = await req.json();
    console.log('Received Codemagic webhook:', JSON.stringify(payload, null, 2));

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Map Codemagic status to our status
    let status = payload.status;
    if (status === 'finished') {
      status = 'completed' as any;
    }

    // Determine platform from workflowId
    const platform = payload.workflowId?.includes('android') ? 'android' : 'ios';

    // Find download URL from artifacts
    let downloadUrl: string | null = null;
    if (payload.artefacts && payload.artefacts.length > 0) {
      const artifact = payload.artefacts.find(a => 
        a.type === 'apk' || a.type === 'ipa' || 
        a.name?.endsWith('.apk') || a.name?.endsWith('.ipa')
      ) || payload.artefacts[0];
      downloadUrl = artifact?.url || null;
    }

    // Check if build exists
    const { data: existingBuild } = await supabase
      .from('builds')
      .select('id')
      .eq('build_id', payload.buildId)
      .single();

    if (existingBuild) {
      // Update existing build
      console.log(`Updating build ${payload.buildId} to status: ${status}`);
      const { error: updateError } = await supabase
        .from('builds')
        .update({
          status,
          download_url: downloadUrl,
          artifact_url: downloadUrl,
          error_message: payload.error || null,
          started_at: payload.startedAt || null,
          finished_at: payload.finishedAt || null,
        })
        .eq('build_id', payload.buildId);

      if (updateError) {
        console.error('Error updating build:', updateError);
        throw updateError;
      }
    } else {
      // Insert new build record
      console.log(`Creating new build record for ${payload.buildId}`);
      const { error: insertError } = await supabase
        .from('builds')
        .insert({
          build_id: payload.buildId,
          platform,
          status,
          app_name: 'Unknown App', // Will be updated from build-app
          download_url: downloadUrl,
          artifact_url: downloadUrl,
          error_message: payload.error || null,
          started_at: payload.startedAt || null,
          finished_at: payload.finishedAt || null,
        });

      if (insertError) {
        console.error('Error inserting build:', insertError);
        throw insertError;
      }
    }

    console.log(`Successfully processed webhook for build ${payload.buildId}`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error processing webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});