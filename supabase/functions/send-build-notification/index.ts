import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

if (!RESEND_API_KEY) {
  console.error("RESEND_API_KEY is not configured");
}

// Helper function to send email via Resend API
async function sendEmail(to: string, subject: string, html: string) {
  console.log("Attempting to send email to:", to);
  console.log("Subject:", subject);
  console.log("RESEND_API_KEY configured:", !!RESEND_API_KEY);
  
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Appify <support@ask2mesolution.com>",
      to: [to],
      subject,
      html,
    }),
  });
  
  const responseText = await response.text();
  console.log("Resend API response status:", response.status);
  console.log("Resend API response:", responseText);
  
  if (!response.ok) {
    throw new Error(`Failed to send email: ${responseText}`);
  }
  
  return JSON.parse(responseText);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BuildNotificationRequest {
  buildId: string;
  status: "completed" | "failed";
  appName: string;
  platform: string;
  downloadUrl?: string;
  aabDownloadUrl?: string;
  errorMessage?: string;
  userId?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: BuildNotificationRequest = await req.json();
    console.log("Received build notification request:", JSON.stringify(payload, null, 2));

    if (!payload.buildId || !payload.status) {
      throw new Error("Missing required fields: buildId and status");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user email from profiles table
    let userEmail: string | null = null;
    let userName: string | null = null;

    if (payload.userId) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("user_id", payload.userId)
        .single();

      if (profileError) {
        console.error("Error fetching profile:", profileError);
      } else if (profile) {
        userEmail = profile.email;
        userName = profile.full_name || "User";
        console.log("Found user email:", userEmail);
      }
    }

    // If no user_id provided, try to get from builds table
    if (!userEmail) {
      const { data: build, error: buildError } = await supabase
        .from("builds")
        .select("user_id")
        .eq("build_id", payload.buildId)
        .single();

      if (buildError) {
        console.error("Error fetching build:", buildError);
      } else if (build?.user_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("email, full_name")
          .eq("user_id", build.user_id)
          .single();

        if (profile) {
          userEmail = profile.email;
          userName = profile.full_name || "User";
          console.log("Found user email from build:", userEmail);
        }
      }
    }

    if (!userEmail) {
      console.log("No user email found for build notification");
      return new Response(
        JSON.stringify({ success: false, message: "No user email found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build email content based on status
    const isSuccess = payload.status === "completed";
    const platformName = payload.platform === "android" ? "Android" : "iOS";
    const appName = payload.appName || "Your App";

    let emailHtml: string;
    let emailSubject: string;

    if (isSuccess) {
      emailSubject = `✅ ${appName} - ${platformName} Build Successful!`;
      
      let downloadSection = "";
      
      if (payload.platform === "android") {
        if (payload.downloadUrl) {
          downloadSection += `
            <div style="margin: 20px 0;">
              <a href="${payload.downloadUrl}" 
                 style="background: linear-gradient(135deg, #4F46E5, #7C3AED); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; margin-right: 10px;">
                📱 Download APK
              </a>
            </div>
          `;
        }
        if (payload.aabDownloadUrl) {
          downloadSection += `
            <div style="margin: 20px 0;">
              <a href="${payload.aabDownloadUrl}" 
                 style="background: linear-gradient(135deg, #059669, #10B981); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">
                📦 Download AAB (Play Store)
              </a>
            </div>
          `;
        }
      } else {
        if (payload.downloadUrl) {
          downloadSection = `
            <div style="margin: 20px 0;">
              <a href="${payload.downloadUrl}" 
                 style="background: linear-gradient(135deg, #4F46E5, #7C3AED); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">
                📱 Download IPA
              </a>
            </div>
          `;
        }
      }

      emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #4F46E5, #7C3AED); padding: 40px 30px; text-align: center;">
              <div style="font-size: 60px; margin-bottom: 10px;">🎉</div>
              <h1 style="color: white; margin: 0; font-size: 28px;">Build Successful!</h1>
            </div>
            
            <!-- Content -->
            <div style="padding: 30px;">
              <p style="color: #374151; font-size: 16px; line-height: 1.6;">
                Hi ${userName},
              </p>
              
              <p style="color: #374151; font-size: 16px; line-height: 1.6;">
                Great news! Your <strong>${platformName}</strong> app <strong>"${appName}"</strong> has been built successfully and is ready for download.
              </p>
              
              <!-- Build Info -->
              <div style="background: #F3F4F6; border-radius: 12px; padding: 20px; margin: 20px 0;">
                <h3 style="margin: 0 0 15px 0; color: #1F2937; font-size: 16px;">📋 Build Details</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #6B7280;">App Name:</td>
                    <td style="padding: 8px 0; color: #1F2937; font-weight: 500;">${appName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6B7280;">Platform:</td>
                    <td style="padding: 8px 0; color: #1F2937; font-weight: 500;">${platformName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6B7280;">Build ID:</td>
                    <td style="padding: 8px 0; color: #1F2937; font-weight: 500; font-family: monospace; font-size: 14px;">${payload.buildId}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6B7280;">Status:</td>
                    <td style="padding: 8px 0;">
                      <span style="background: #D1FAE5; color: #065F46; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: 500;">✓ Completed</span>
                    </td>
                  </tr>
                </table>
              </div>
              
              <!-- Download Buttons -->
              <div style="text-align: center; margin: 30px 0;">
                <h3 style="color: #1F2937; margin-bottom: 20px;">Download Your App</h3>
                ${downloadSection || '<p style="color: #6B7280;">Download links will be available in your dashboard.</p>'}
              </div>
              
              <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
              
              <p style="color: #6B7280; font-size: 14px; text-align: center;">
                You can also view and download your builds from the <a href="https://appify.lovable.app/dashboard" style="color: #4F46E5;">Dashboard</a>.
              </p>
            </div>
            
            <!-- Footer -->
            <div style="background: #F9FAFB; padding: 20px 30px; text-align: center; border-top: 1px solid #E5E7EB;">
              <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
                © 2025 Appify - Web to App Converter
              </p>
            </div>
          </div>
        </body>
        </html>
      `;
    } else {
      emailSubject = `❌ ${appName} - ${platformName} Build Failed`;
      
      emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #DC2626, #EF4444); padding: 40px 30px; text-align: center;">
              <div style="font-size: 60px; margin-bottom: 10px;">⚠️</div>
              <h1 style="color: white; margin: 0; font-size: 28px;">Build Failed</h1>
            </div>
            
            <!-- Content -->
            <div style="padding: 30px;">
              <p style="color: #374151; font-size: 16px; line-height: 1.6;">
                Hi ${userName},
              </p>
              
              <p style="color: #374151; font-size: 16px; line-height: 1.6;">
                Unfortunately, your <strong>${platformName}</strong> app <strong>"${appName}"</strong> build has failed. Don't worry - our team is here to help!
              </p>
              
              <!-- Build Info -->
              <div style="background: #FEF2F2; border-radius: 12px; padding: 20px; margin: 20px 0; border-left: 4px solid #DC2626;">
                <h3 style="margin: 0 0 15px 0; color: #991B1B; font-size: 16px;">❌ Build Details</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #6B7280;">App Name:</td>
                    <td style="padding: 8px 0; color: #1F2937; font-weight: 500;">${appName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6B7280;">Platform:</td>
                    <td style="padding: 8px 0; color: #1F2937; font-weight: 500;">${platformName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6B7280;">Build ID:</td>
                    <td style="padding: 8px 0; color: #1F2937; font-weight: 500; font-family: monospace; font-size: 14px;">${payload.buildId}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6B7280;">Status:</td>
                    <td style="padding: 8px 0;">
                      <span style="background: #FEE2E2; color: #991B1B; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: 500;">✗ Failed</span>
                    </td>
                  </tr>
                </table>
                ${payload.errorMessage ? `
                  <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #FECACA;">
                    <p style="color: #991B1B; font-size: 14px; margin: 0;"><strong>Error:</strong></p>
                    <p style="color: #7F1D1D; font-size: 14px; margin: 5px 0 0 0; font-family: monospace; background: #FEE2E2; padding: 10px; border-radius: 6px;">${payload.errorMessage}</p>
                  </div>
                ` : ''}
              </div>
              
              <!-- Next Steps -->
              <div style="background: #F3F4F6; border-radius: 12px; padding: 20px; margin: 20px 0;">
                <h3 style="margin: 0 0 15px 0; color: #1F2937; font-size: 16px;">💡 What to do next?</h3>
                <ul style="color: #4B5563; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                  <li>Check that your website URL is accessible</li>
                  <li>Ensure your app icon and splash screen are valid images</li>
                  <li>Try building again from the dashboard</li>
                  <li>Contact support if the issue persists</li>
                </ul>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://appify.lovable.app/builder" 
                   style="background: linear-gradient(135deg, #4F46E5, #7C3AED); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">
                  🔄 Try Again
                </a>
              </div>
              
              <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
              
              <p style="color: #6B7280; font-size: 14px; text-align: center;">
                Need help? Contact us at <a href="mailto:support@appify.com" style="color: #4F46E5;">support@appify.com</a>
              </p>
            </div>
            
            <!-- Footer -->
            <div style="background: #F9FAFB; padding: 20px 30px; text-align: center; border-top: 1px solid #E5E7EB;">
              <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
                © 2025 Appify - Web to App Converter
              </p>
            </div>
          </div>
        </body>
        </html>
      `;
    }

    // Send email using Resend API
    console.log("Sending email to:", userEmail);
    const emailResponse = await sendEmail(userEmail, emailSubject, emailHtml);

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, emailId: emailResponse.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error sending build notification:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
