import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import StepIndicator from "@/components/builder/StepIndicator";
import WebsiteUrlStep from "@/components/builder/WebsiteUrlStep";
import AppDetailsStep from "@/components/builder/AppDetailsStep";
import IconUploadStep from "@/components/builder/IconUploadStep";
import SplashScreenStep, { SplashConfig } from "@/components/builder/SplashScreenStep";
import NavigationStep, { NavBarStyle } from "@/components/builder/NavigationStep";
import KeystoreStep from "@/components/builder/KeystoreStep";
import PlatformStep from "@/components/builder/PlatformStep";
import BuildSuccessStep from "@/components/builder/BuildSuccessStep";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";

const steps = [
  { id: 1, title: "Website" },
  { id: 2, title: "Details" },
  { id: 3, title: "Icon" },
  { id: 4, title: "Splash" },
  { id: 5, title: "Navigation" },
  { id: 6, title: "Keystore" },
  { id: 7, title: "Build" },
];

interface NavItem {
  id: string;
  label: string;
  url: string;
  icon: string;
}

interface KeystoreConfig {
  alias: string;
  password: string;
  validity: string;
  organization: string;
  country: string;
}

interface BuildResult {
  platform: string;
  status: string;
  buildId: string;
  message: string;
  estimatedTime: string;
  downloadUrl: string | null;
}

const Builder = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [buildComplete, setBuildComplete] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildResults, setBuildResults] = useState<BuildResult[]>([]);

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // Step 1: Website URL
  const [websiteUrl, setWebsiteUrl] = useState("");

  // Step 2: App Details
  const [appName, setAppName] = useState("");
  const [packageId, setPackageId] = useState("");
  const [appDescription, setAppDescription] = useState("");

  // Step 3: App Icon
  const [appIcon, setAppIcon] = useState<string | null>(null);

  // Step 4: Splash Screen
  const [splashConfig, setSplashConfig] = useState<SplashConfig>({
    image: null,
    backgroundColor: "#ffffff",
    resizeMode: "contain",
  });

  // Step 5: Navigation
  const [enableNavigation, setEnableNavigation] = useState(false);
  const [navigationType, setNavigationType] = useState<"tabs" | "drawer">("tabs");
  const [navItems, setNavItems] = useState<NavItem[]>([
    { id: "1", label: "Home", url: "/", icon: "home" },
  ]);
  const [navBarStyle, setNavBarStyle] = useState<NavBarStyle>({
    backgroundColor: "#1a1a1a",
    activeIconColor: "#007AFF",
    inactiveIconColor: "#8E8E93",
    activeTextColor: "#007AFF",
    inactiveTextColor: "#8E8E93",
  });

  // Step 6: Keystore
  const [generateKeystore, setGenerateKeystore] = useState(false);
  const [keystoreConfig, setKeystoreConfig] = useState<KeystoreConfig>({
    alias: "",
    password: "",
    validity: "25",
    organization: "",
    country: "",
  });

  // Step 7: Platform
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return websiteUrl.length > 0;
      case 2:
        return appName.length > 0 && packageId.length > 0;
      case 3:
        return true; // Icon is optional
      case 4:
        return true; // Splash is optional
      case 5:
        return true; // Navigation is optional
      case 6:
        return true; // Keystore is optional
      case 7:
        return selectedPlatforms.length > 0;
      default:
        return false;
    }
  };

  const nextStep = () => {
    if (currentStep < 7 && canProceed()) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleBuild = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }
    
    setIsBuilding(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('build-app', {
        body: {
          websiteUrl,
          appName,
          packageId,
          appDescription,
          appIcon,
          splashConfig,
          enableNavigation,
          navigationType,
          navItems,
          navBarStyle,
          keystoreConfig: generateKeystore ? keystoreConfig : null,
          platforms: selectedPlatforms,
          userId: user.id,
        },
      });

      if (error) {
        throw error;
      }

      if (data?.success) {
        setBuildResults(data.builds || []);
        setBuildComplete(true);
        toast({
          title: "Build Started!",
          description: "Your app build has been queued with AppdesignLab Engine.",
        });
      } else {
        throw new Error(data?.error || 'Build failed');
      }
    } catch (error) {
      console.error('Build error:', error);
      toast({
        title: "Build Error",
        description: error instanceof Error ? error.message : "Failed to start build. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsBuilding(false);
    }
  };

  const handleStartOver = () => {
    setCurrentStep(1);
    setBuildComplete(false);
    setWebsiteUrl("");
    setAppName("");
    setPackageId("");
    setAppDescription("");
    setAppIcon(null);
    setSplashConfig({ image: null, backgroundColor: "#ffffff", resizeMode: "contain" });
    setEnableNavigation(false);
    setNavigationType("tabs");
    setNavItems([{ id: "1", label: "Home", url: "/", icon: "home" }]);
    setNavBarStyle({
      backgroundColor: "#1a1a1a",
      activeIconColor: "#007AFF",
      inactiveIconColor: "#8E8E93",
      activeTextColor: "#007AFF",
      inactiveTextColor: "#8E8E93",
    });
    setGenerateKeystore(false);
    setKeystoreConfig({
      alias: "",
      password: "",
      validity: "25",
      organization: "",
      country: "",
    });
    setSelectedPlatforms([]);
  };

  const renderStep = () => {
    if (buildComplete) {
      return (
        <BuildSuccessStep
          selectedPlatforms={selectedPlatforms}
          appName={appName}
          onStartOver={handleStartOver}
          buildResults={buildResults}
        />
      );
    }

    switch (currentStep) {
      case 1:
        return (
          <WebsiteUrlStep
            websiteUrl={websiteUrl}
            setWebsiteUrl={setWebsiteUrl}
          />
        );
      case 2:
        return (
          <AppDetailsStep
            appName={appName}
            setAppName={setAppName}
            packageId={packageId}
            setPackageId={setPackageId}
            appDescription={appDescription}
            setAppDescription={setAppDescription}
          />
        );
      case 3:
        return <IconUploadStep appIcon={appIcon} setAppIcon={setAppIcon} />;
      case 4:
        return <SplashScreenStep splashConfig={splashConfig} setSplashConfig={setSplashConfig} />;
      case 5:
        return (
          <NavigationStep
            enableNavigation={enableNavigation}
            setEnableNavigation={setEnableNavigation}
            navItems={navItems}
            setNavItems={setNavItems}
            navigationType={navigationType}
            setNavigationType={setNavigationType}
            navBarStyle={navBarStyle}
            setNavBarStyle={setNavBarStyle}
          />
        );
      case 6:
        return (
          <KeystoreStep
            generateKeystore={generateKeystore}
            setGenerateKeystore={setGenerateKeystore}
            keystoreConfig={keystoreConfig}
            setKeystoreConfig={setKeystoreConfig}
          />
        );
      case 7:
        return (
          <PlatformStep
            selectedPlatforms={selectedPlatforms}
            setSelectedPlatforms={setSelectedPlatforms}
            isBuilding={isBuilding}
            onBuild={handleBuild}
            websiteUrl={websiteUrl}
            appName={appName}
            enableNavigation={enableNavigation}
            navItems={navItems}
          />
        );
      default:
        return null;
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 pt-24 pb-12">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Step Indicator */}
          {!buildComplete && (
            <div className="mb-12">
              <StepIndicator steps={steps} currentStep={currentStep} />
            </div>
          )}

          {/* Step Content */}
          <div className="glass-card rounded-2xl p-6 md:p-10 min-h-[500px]">
            {renderStep()}
          </div>

          {/* Navigation Buttons */}
          {!buildComplete && currentStep !== 7 && (
            <div className="flex justify-between mt-6">
              <Button
                variant="ghost"
                onClick={prevStep}
                disabled={currentStep === 1}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>

              <Button
                variant="hero"
                onClick={nextStep}
                disabled={!canProceed()}
              >
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}

          {!buildComplete && currentStep === 7 && (
            <div className="flex justify-start mt-6">
              <Button variant="ghost" onClick={prevStep}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Builder;
