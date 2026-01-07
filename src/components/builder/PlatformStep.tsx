import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Smartphone, Apple, Play, Check, Download, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import ExpoSnackPreview from "./ExpoSnackPreview";

interface NavItem {
  id: string;
  label: string;
  url: string;
  icon: string;
}

interface PlatformStepProps {
  selectedPlatforms: string[];
  setSelectedPlatforms: (platforms: string[]) => void;
  isBuilding: boolean;
  onBuild: () => void;
  websiteUrl: string;
  appName: string;
  enableNavigation: boolean;
  navItems: NavItem[];
}

const platforms = [
  {
    id: "android",
    name: "Android",
    icon: Play,
    description: "Generate APK file for Google Play Store",
    badge: "APK",
    color: "bg-green-500/10 text-green-600 border-green-200",
  },
  {
    id: "ios",
    name: "iOS",
    icon: Apple,
    description: "Generate IPA file for Apple App Store",
    badge: "IPA",
    color: "bg-blue-500/10 text-blue-600 border-blue-200",
  },
];

const PlatformStep = ({
  selectedPlatforms,
  setSelectedPlatforms,
  isBuilding,
  onBuild,
  websiteUrl,
  appName,
  enableNavigation,
  navItems,
}: PlatformStepProps) => {
  const togglePlatform = (platformId: string) => {
    if (selectedPlatforms.includes(platformId)) {
      setSelectedPlatforms(selectedPlatforms.filter((p) => p !== platformId));
    } else {
      setSelectedPlatforms([...selectedPlatforms, platformId]);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center mb-6">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Smartphone className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Build & Preview</h2>
        <p className="text-muted-foreground">
          Preview your app in real-time and select platforms to build
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Live Preview */}
        <div className="order-2 lg:order-1">
          <div className="flex items-center gap-2 mb-3">
            <Eye className="w-4 h-4 text-primary" />
            <Label className="text-sm font-medium">Live Preview</Label>
          </div>
          <div className="bg-card rounded-xl border p-4 h-[450px]">
            <ExpoSnackPreview
              websiteUrl={websiteUrl}
              appName={appName}
              enableNavigation={enableNavigation}
              navItems={navItems.map(item => ({ 
                label: item.label, 
                url: item.url, 
                icon: item.icon 
              }))}
            />
          </div>
        </div>

        {/* Platform Selection & Build */}
        <div className="order-1 lg:order-2 space-y-4">
          <div>
            <Label className="text-sm font-medium mb-3 block">Select Platforms</Label>
            <div className="space-y-3">
              {platforms.map((platform) => {
                const isSelected = selectedPlatforms.includes(platform.id);
                return (
                  <button
                    key={platform.id}
                    onClick={() => togglePlatform(platform.id)}
                    className={cn(
                      "flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 text-left w-full",
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30"
                    )}
                  >
                    <div
                      className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center",
                        platform.color
                      )}
                    >
                      <platform.icon className="w-5 h-5" />
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{platform.name}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                          {platform.badge}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {platform.description}
                      </p>
                    </div>

                    <div
                      className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                        isSelected
                          ? "border-primary bg-primary"
                          : "border-muted-foreground/30"
                      )}
                    >
                      {isSelected && (
                        <Check className="w-3 h-3 text-primary-foreground" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Build Button */}
          <Button
            variant="hero"
            size="lg"
            onClick={onBuild}
            disabled={selectedPlatforms.length === 0 || isBuilding}
            className="w-full"
          >
            {isBuilding ? (
              <>
                <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                Building with AppdesignLab Engine...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Build App{selectedPlatforms.length > 1 ? "s" : ""}
              </>
            )}
          </Button>

          {/* Info */}
          <div className="bg-accent/50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">
              Builds are processed via AppdesignLab Engine by Ask2mesolution. Estimated time: 5-15 minutes per platform.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlatformStep;
