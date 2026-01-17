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

    // Find download URLs from artifacts - separate APK and AAB
    let downloadUrl: string | null = null;
    let aabDownloadUrl: string | null = null;
    
    if (payload.artefacts && payload.artefacts.length > 0) {
      console.log('Processing artifacts:', JSON.stringify(payload.artefacts, null, 2));
      
      // Find APK artifact
      const apkArtifact = payload.artefacts.find(a => 
        a.type === 'apk' || a.name?.endsWith('.apk')
      );
      if (apkArtifact) {
        downloadUrl = apkArtifact.url;
        console.log('Found APK artifact:', apkArtifact.name, apkArtifact.url);
      }
      
      // Find AAB artifact
      const aabArtifact = payload.artefacts.find(a => 
        a.type === 'aab' || a.name?.endsWith('.aab')
      );
      if (aabArtifact) {
        aabDownloadUrl = aabArtifact.url;
        console.log('Found AAB artifact:', aabArtifact.name, aabArtifact.url);
      }
      
      // Find IPA artifact for iOS
      const ipaArtifact = payload.artefacts.find(a => 
        a.type === 'ipa' || a.name?.endsWith('.ipa')
      );
      if (ipaArtifact && !downloadUrl) {
        downloadUrl = ipaArtifact.url;
        console.log('Found IPA artifact:', ipaArtifact.name, ipaArtifact.url);
      }
      
      // Fallback to first artifact if no specific type found
      if (!downloadUrl && payload.artefacts.length > 0) {
        downloadUrl = payload.artefacts[0].url;
        console.log('Using fallback artifact:', payload.artefacts[0].name);
      }
    }

    // Check if build exists
    const { data: existingBuild } = await supabase
      .from('builds')
      .select('id')
      .eq('build_id', payload.buildId)
      .single();

    if (existingBuild) {
      // Update existing build
      console.log(`Updating build ${payload.buildId} to status: ${status}, APK: ${downloadUrl}, AAB: ${aabDownloadUrl}`);
      const { error: updateError } = await supabase
        .from('builds')
        .update({
          status,
          download_url: downloadUrl,
          aab_download_url: aabDownloadUrl,
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
          aab_download_url: aabDownloadUrl,
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

    // Send email notification for completed or failed builds
    if (payload.status === 'finished' || payload.status === 'failed') {
      try {
        // Get build details including user_id and app_name
        const { data: buildData } = await supabase
          .from('builds')
          .select('user_id, app_name')
          .eq('build_id', payload.buildId)
          .single();

        if (buildData) {
          const notificationPayload = {
            buildId: payload.buildId,
            status: payload.status === 'finished' ? 'completed' : 'failed',
            appName: buildData.app_name || 'Your App',
            platform: payload.workflowId?.includes('android') ? 'android' : 'ios',
            downloadUrl: downloadUrl,
            aabDownloadUrl: aabDownloadUrl,
            errorMessage: payload.error || null,
            userId: buildData.user_id,
          };

          console.log('Sending build notification email:', notificationPayload);

          // Call the send-build-notification edge function
          const notificationUrl = `${supabaseUrl}/functions/v1/send-build-notification`;
          const notificationResponse = await fetch(notificationUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify(notificationPayload),
          });

          const notificationResult = await notificationResponse.json();
          console.log('Build notification result:', notificationResult);
        }
      } catch (notificationError) {
        console.error('Error sending build notification:', notificationError);
        // Don't throw - we don't want to fail the webhook if email fails
      }
    }

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