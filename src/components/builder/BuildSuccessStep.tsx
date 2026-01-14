import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, Download, ExternalLink, Play, Apple, Loader2, Clock, AlertCircle, Package, CreditCard, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BuildResult {
  platform: string;
  status: string;
  buildId: string;
  message: string;
  estimatedTime: string;
  downloadUrl: string | null;
  aabDownloadUrl?: string | null;
}

interface BuildSuccessStepProps {
  selectedPlatforms: string[];
  appName: string;
  onStartOver: () => void;
  buildResults?: BuildResult[];
}

const DOWNLOAD_FEE_INR = 2800;

const BuildSuccessStep = ({
  selectedPlatforms,
  appName,
  onStartOver,
  buildResults = [],
}: BuildSuccessStepProps) => {
  const [downloadingApk, setDownloadingApk] = useState(false);
  const [downloadingAab, setDownloadingAab] = useState(false);
  const [downloadingIos, setDownloadingIos] = useState(false);
  const [builds, setBuilds] = useState<BuildResult[]>(buildResults);
  const [isPaid, setIsPaid] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(true);
  const [processingPayment, setProcessingPayment] = useState(false);

  // Get the primary build ID for payment
  const primaryBuildId = buildResults[0]?.buildId || "";

  // Check payment status on mount and when URL changes
  useEffect(() => {
    const checkPaymentStatus = async () => {
      if (!primaryBuildId) {
        setCheckingPayment(false);
        return;
      }

      try {
        console.log("Checking payment status for build:", primaryBuildId);
        
        const { data, error } = await supabase.functions.invoke("check-payment", {
          body: { buildId: primaryBuildId },
        });

        if (error) {
          console.error("Error checking payment:", error);
        } else {
          console.log("Payment status:", data);
          setIsPaid(data?.paid === true);
        }
      } catch (error) {
        console.error("Error checking payment status:", error);
      } finally {
        setCheckingPayment(false);
      }
    };

    // Check if returning from successful payment
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get("payment");
    
    if (paymentStatus === "success") {
      toast.success("Payment successful! You can now download your app.");
      // Clean up URL
      window.history.replaceState({}, "", window.location.pathname);
    } else if (paymentStatus === "cancelled") {
      toast.error("Payment was cancelled");
      window.history.replaceState({}, "", window.location.pathname);
    }

    checkPaymentStatus();
  }, [primaryBuildId]);

  // Subscribe to real-time build updates
  useEffect(() => {
    const buildIds = buildResults.map(b => b.buildId);
    if (buildIds.length === 0) return;

    console.log('Subscribing to real-time updates for builds:', buildIds);

    const channel = supabase
      .channel('build-status-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'builds',
        },
        (payload) => {
          console.log('Real-time build update received:', payload);
          
          const updatedBuild = payload.new as {
            build_id: string;
            platform: string;
            status: string;
            download_url: string | null;
            aab_download_url: string | null;
            error_message: string | null;
          };

          setBuilds(prev => prev.map(build => {
            if (build.buildId === updatedBuild.build_id) {
              return {
                ...build,
                status: updatedBuild.status,
                downloadUrl: updatedBuild.download_url,
                aabDownloadUrl: updatedBuild.aab_download_url,
                message: updatedBuild.error_message || build.message,
              };
            }
            return build;
          }));
        }
      )
      .subscribe((status) => {
        console.log('Real-time subscription status:', status);
      });

    return () => {
      console.log('Unsubscribing from real-time updates');
      supabase.removeChannel(channel);
    };
  }, [buildResults]);

  const handlePayment = async () => {
    if (!primaryBuildId) {
      toast.error("No build found to process payment");
      return;
    }

    setProcessingPayment(true);
    
    try {
      console.log("Creating checkout session for build:", primaryBuildId);
      
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          buildId: primaryBuildId,
          appName: appName,
          successUrl: `${window.location.origin}/builder?payment=success&build_id=${primaryBuildId}`,
          cancelUrl: `${window.location.origin}/builder?payment=cancelled`,
        },
      });

      if (error) {
        console.error("Error creating checkout:", error);
        toast.error("Failed to create payment session");
        return;
      }

      if (data?.alreadyPaid) {
        setIsPaid(true);
        toast.success("Payment already completed!");
        return;
      }

      if (data?.url) {
        console.log("Redirecting to Stripe checkout:", data.url);
        window.location.href = data.url;
      } else {
        toast.error("Failed to get payment URL");
      }
    } catch (error) {
      console.error("Payment error:", error);
      toast.error("Failed to process payment");
    } finally {
      setProcessingPayment(false);
    }
  };

  const sanitizeFileName = (name: string) => {
    return name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() || 'app';
  };

  const handleDownload = async (type: 'apk' | 'aab' | 'ios') => {
    // Check payment status first
    if (!isPaid) {
      toast.error("Please complete payment to download your app");
      return;
    }

    const setDownloading = type === 'apk' ? setDownloadingApk : type === 'aab' ? setDownloadingAab : setDownloadingIos;
    setDownloading(true);

    const platform = type === 'ios' ? 'ios' : 'android';
    const build = builds.find(b => b.platform === platform);
    
    const downloadUrl = type === 'aab' ? build?.aabDownloadUrl : build?.downloadUrl;
    
    if (downloadUrl && downloadUrl.startsWith('http')) {
      console.log(`Downloading real ${type.toUpperCase()} from:`, downloadUrl);
      window.open(downloadUrl, '_blank');
      setDownloading(false);
      return;
    }

    if (!downloadUrl) {
      console.log(`No download URL available for ${type.toUpperCase()} yet - build may still be processing`);
      toast.info("Build is still processing. Please wait...");
      setDownloading(false);
      return;
    }

    // Demo/simulated download
    setTimeout(() => {
      const extension = type === 'ios' ? 'ipa' : type;
      const mimeType = type === 'ios' 
        ? 'application/octet-stream' 
        : type === 'aab'
        ? 'application/octet-stream'
        : 'application/vnd.android.package-archive';

      const packageType = type === 'aab' ? 'Android App Bundle (AAB)' : type === 'apk' ? 'Android APK' : 'iOS IPA';
      const storeInfo = type === 'aab' 
        ? 'Google Play Store (recommended for publishing)' 
        : type === 'apk' 
        ? 'Direct installation or alternative stores'
        : 'Apple App Store';

      const content = `# ${packageType}
# Generated by Web2App Converter with AppdesignLab Engine
# ================================
#
# App Name: ${appName}
# Platform: ${platform}
# Package Type: ${extension.toUpperCase()}
# Generated: ${new Date().toISOString()}
# Build ID: ${build?.buildId || 'demo'}
#
# This is a demo package. In production, this would be a real
# ${packageType} file generated by AppdesignLab Engine.
#
# Recommended for: ${storeInfo}
#
# For production builds:
# 1. Configure your build credentials
# 2. The build will produce a real, signed app package
# 3. Download and submit to the appropriate app store

[METADATA]
app_name=${appName}
platform=${platform}
format=${extension}
build_service=appdesignlab
timestamp=${Date.now()}
`;

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${sanitizeFileName(appName)}.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setDownloading(false);
    }, 1500);
  };

  const getBuildStatus = (platform: string) => {
    const build = builds.find(b => b.platform === platform);
    return build?.status || 'completed';
  };

  const renderPaymentSection = () => {
    if (checkingPayment) {
      return (
        <div className="bg-accent/50 rounded-xl p-6 max-w-md mx-auto">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Checking payment status...</span>
          </div>
        </div>
      );
    }

    if (isPaid) {
      return (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-6 max-w-md mx-auto">
          <div className="flex items-center justify-center gap-2 text-green-600">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">Payment Complete - Downloads Unlocked!</span>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-xl p-6 max-w-md mx-auto space-y-4">
        <div className="flex items-center justify-center gap-2">
          <Lock className="w-5 h-5 text-primary" />
          <span className="font-semibold">Downloads Locked</span>
        </div>
        
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-2">
            Complete payment to download your app files
          </p>
          <p className="text-3xl font-bold text-primary">
            ₹{DOWNLOAD_FEE_INR.toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            One-time fee • Includes APK, AAB & IPA
          </p>
        </div>

        <Button 
          onClick={handlePayment}
          disabled={processingPayment}
          className="w-full"
          size="lg"
        >
          {processingPayment ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <CreditCard className="w-4 h-4 mr-2" />
              Pay Now with Stripe
            </>
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Secure payment powered by Stripe
        </p>
      </div>
    );
  };

  const renderAndroidBuildCard = () => {
    const status = getBuildStatus('android');
    const build = builds.find(b => b.platform === 'android');
    const isDownloadDisabled = !isPaid || status !== 'completed';

    return (
      <div className="p-4 rounded-xl border bg-card space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center">
            <Play className="w-5 h-5 text-green-600" />
          </div>
          <div className="flex-1">
            <p className="font-medium">Android Build</p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {status === 'queued' && (
                <>
                  <Clock className="w-3 h-3" />
                  <span>Queued - {build?.estimatedTime}</span>
                </>
              )}
              {status === 'building' && (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Building...</span>
                </>
              )}
              {status === 'completed' && (
                <>
                  <CheckCircle className="w-3 h-3 text-green-500" />
                  <span>{isPaid ? 'Ready to download' : 'Payment required'}</span>
                </>
              )}
              {status === 'failed' && (
                <>
                  <AlertCircle className="w-3 h-3 text-red-500" />
                  <span>Build failed</span>
                </>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={() => handleDownload('apk')}
            disabled={isDownloadDisabled || downloadingApk}
          >
            {downloadingApk ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : !isPaid ? (
              <Lock className="w-4 h-4 mr-2" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            APK
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={() => handleDownload('aab')}
            disabled={isDownloadDisabled || downloadingAab}
          >
            {downloadingAab ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : !isPaid ? (
              <Lock className="w-4 h-4 mr-2" />
            ) : (
              <Package className="w-4 h-4 mr-2" />
            )}
            AAB
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          APK: Direct install • AAB: Google Play Store
        </p>
      </div>
    );
  };

  const renderIosBuildCard = () => {
    const status = getBuildStatus('ios');
    const build = builds.find(b => b.platform === 'ios');
    const isDownloadDisabled = !isPaid || status !== 'completed';

    return (
      <div className="flex items-center gap-3 p-4 rounded-xl border bg-card">
        <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
          <Apple className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1">
          <p className="font-medium">iOS IPA</p>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {status === 'queued' && (
              <>
                <Clock className="w-3 h-3" />
                <span>Queued - {build?.estimatedTime}</span>
              </>
            )}
            {status === 'building' && (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Building...</span>
              </>
            )}
            {status === 'completed' && (
              <>
                <CheckCircle className="w-3 h-3 text-green-500" />
                <span>{isPaid ? 'Ready to download' : 'Payment required'}</span>
              </>
            )}
            {status === 'failed' && (
              <>
                <AlertCircle className="w-3 h-3 text-red-500" />
                <span>Build failed</span>
              </>
            )}
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleDownload('ios')}
          disabled={isDownloadDisabled || downloadingIos}
        >
          {downloadingIos ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : !isPaid ? (
            <Lock className="w-4 h-4" />
          ) : (
            <Download className="w-4 h-4" />
          )}
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in text-center">
      <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
        <CheckCircle className="w-10 h-10 text-green-500" />
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-2">Build Started!</h2>
        <p className="text-muted-foreground">
          Your app "{appName}" is being built via AppdesignLab Engine
        </p>
      </div>

      {/* Payment Section */}
      {renderPaymentSection()}

      {/* Build Status Cards */}
      <div className="max-w-md mx-auto space-y-3">
        {selectedPlatforms.includes("android") && renderAndroidBuildCard()}
        {selectedPlatforms.includes("ios") && renderIosBuildCard()}
      </div>

      {/* Build Info */}
      <div className="bg-accent/50 rounded-xl p-4 max-w-md mx-auto">
        <p className="text-sm text-muted-foreground">
          Builds are processed by AppdesignLab Engine by Ask2mesolution. You'll be notified when your builds are ready. 
          Typical build time is 5-15 minutes.
        </p>
      </div>

      {/* Next Steps */}
      <div className="bg-card border rounded-xl p-6 max-w-md mx-auto text-left">
        <h3 className="font-semibold mb-3">Next Steps</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs mt-0.5 shrink-0">1</span>
            <span>Wait for builds to complete (check status above)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs mt-0.5 shrink-0">2</span>
            <span>Complete payment (₹{DOWNLOAD_FEE_INR.toLocaleString('en-IN')} one-time fee)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs mt-0.5 shrink-0">3</span>
            <span>Download your app files</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs mt-0.5 shrink-0">4</span>
            <span>Test on device, then submit to app stores</span>
          </li>
        </ul>
      </div>

      {/* Documentation Links */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
        <Button 
          variant="outline" 
          className="flex-1"
          onClick={() => window.open('https://ask2mesolution.com', '_blank')}
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          AppdesignLab Docs
        </Button>
        <Button 
          variant="outline" 
          className="flex-1"
          onClick={() => window.open('https://play.google.com/console', '_blank')}
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          Play Console
        </Button>
      </div>

      <div className="pt-4">
        <Button variant="ghost" onClick={onStartOver}>
          Create Another App
        </Button>
      </div>
    </div>
  );
};

export default BuildSuccessStep;
