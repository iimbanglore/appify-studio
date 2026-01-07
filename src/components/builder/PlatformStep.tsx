import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Smartphone, Apple, Play, Check, Download } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlatformStepProps {
  selectedPlatforms: string[];
  setSelectedPlatforms: (platforms: string[]) => void;
  isBuilding: boolean;
  onBuild: () => void;
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
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Smartphone className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Select Platforms</h2>
        <p className="text-muted-foreground">
          Choose the platforms you want to build your app for
        </p>
      </div>

      <div className="max-w-lg mx-auto space-y-6">
        {/* Platform Selection */}
        <div className="grid gap-4">
          {platforms.map((platform) => {
            const isSelected = selectedPlatforms.includes(platform.id);
            return (
              <button
                key={platform.id}
                onClick={() => togglePlatform(platform.id)}
                className={cn(
                  "flex items-center gap-4 p-5 rounded-2xl border-2 transition-all duration-200 text-left",
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/30"
                )}
              >
                <div
                  className={cn(
                    "w-14 h-14 rounded-xl flex items-center justify-center",
                    platform.color
                  )}
                >
                  <platform.icon className="w-7 h-7" />
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-lg">{platform.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                      {platform.badge}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {platform.description}
                  </p>
                </div>

                <div
                  className={cn(
                    "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors",
                    isSelected
                      ? "border-primary bg-primary"
                      : "border-muted-foreground/30"
                  )}
                >
                  {isSelected && (
                    <Check className="w-4 h-4 text-primary-foreground" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Build Button */}
        <Button
          variant="hero"
          size="xl"
          onClick={onBuild}
          disabled={selectedPlatforms.length === 0 || isBuilding}
          className="w-full"
        >
          {isBuilding ? (
            <>
              <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              Building Your App...
            </>
          ) : (
            <>
              <Download className="w-5 h-5" />
              Build App{selectedPlatforms.length > 1 ? "s" : ""}
            </>
          )}
        </Button>

        {/* Info */}
        <div className="bg-accent/50 rounded-xl p-4 text-center">
          <p className="text-sm text-muted-foreground">
            Build time is approximately 2-5 minutes per platform
          </p>
        </div>
      </div>
    </div>
  );
};

export default PlatformStep;
