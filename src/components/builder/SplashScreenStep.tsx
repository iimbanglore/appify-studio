import { useState, useRef } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Monitor, Upload, X } from "lucide-react";

export interface SplashConfig {
  image: string | null;
  backgroundColor: string;
  resizeMode: "contain" | "cover" | "native";
}

interface SplashScreenStepProps {
  splashConfig: SplashConfig;
  setSplashConfig: (config: SplashConfig) => void;
}

const SplashScreenStep = ({ splashConfig, setSplashConfig }: SplashScreenStepProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = (file: File) => {
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setSplashConfig({ ...splashConfig, image: e.target?.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const resizeModes: { value: SplashConfig["resizeMode"]; label: string; description: string }[] = [
    { value: "contain", label: "Contain", description: "Image fits within screen bounds" },
    { value: "cover", label: "Cover", description: "Image covers entire screen" },
    { value: "native", label: "Native", description: "Platform default behavior" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Monitor className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Splash Screen</h2>
        <p className="text-muted-foreground">
          Customize the loading screen users see when opening your app
        </p>
      </div>

      <div className="max-w-lg mx-auto space-y-6">
        {/* Splash Image Upload */}
        <div className="space-y-3">
          <Label className="text-base font-medium">Splash Image</Label>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
            className="hidden"
          />

          {splashConfig.image ? (
            <div className="text-center space-y-4">
              <div className="relative inline-block">
                <div 
                  className="w-48 h-80 rounded-3xl shadow-lg overflow-hidden mx-auto border-4 border-foreground/10"
                  style={{ backgroundColor: splashConfig.backgroundColor }}
                >
                  <img
                    src={splashConfig.image}
                    alt="Splash Preview"
                    className={`w-full h-full ${
                      splashConfig.resizeMode === "contain" ? "object-contain" : 
                      splashConfig.resizeMode === "cover" ? "object-cover" : "object-contain"
                    }`}
                  />
                </div>
                <button
                  onClick={() => setSplashConfig({ ...splashConfig, image: null })}
                  className="absolute -top-2 -right-2 w-8 h-8 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:bg-destructive/90 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                size="sm"
              >
                Change Image
              </Button>
            </div>
          ) : (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 ${
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-accent/50"
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
                <Upload className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-foreground font-medium mb-1">
                Drop splash image or click to browse
              </p>
              <p className="text-sm text-muted-foreground">
                PNG recommended • 1242x2436 for best quality
              </p>
            </div>
          )}
        </div>

        {/* Background Color */}
        <div className="space-y-3">
          <Label htmlFor="bgColor" className="text-base font-medium">Background Color</Label>
          <div className="flex gap-3">
            <div 
              className="w-12 h-12 rounded-xl border-2 border-border overflow-hidden cursor-pointer"
              style={{ backgroundColor: splashConfig.backgroundColor }}
              onClick={() => document.getElementById("colorPicker")?.click()}
            >
              <input
                id="colorPicker"
                type="color"
                value={splashConfig.backgroundColor}
                onChange={(e) => setSplashConfig({ ...splashConfig, backgroundColor: e.target.value })}
                className="opacity-0 cursor-pointer w-full h-full"
              />
            </div>
            <Input
              id="bgColor"
              value={splashConfig.backgroundColor}
              onChange={(e) => setSplashConfig({ ...splashConfig, backgroundColor: e.target.value })}
              placeholder="#ffffff"
              className="flex-1 font-mono"
            />
          </div>
          <p className="text-sm text-muted-foreground">
            This color appears behind your splash image
          </p>
        </div>

        {/* Resize Mode */}
        <div className="space-y-3">
          <Label className="text-base font-medium">Resize Mode</Label>
          <div className="grid grid-cols-3 gap-3">
            {resizeModes.map((mode) => (
              <button
                key={mode.value}
                onClick={() => setSplashConfig({ ...splashConfig, resizeMode: mode.value })}
                className={`p-3 rounded-xl border-2 text-center transition-all ${
                  splashConfig.resizeMode === mode.value
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <p className="font-medium text-sm">{mode.label}</p>
                <p className="text-xs text-muted-foreground mt-1">{mode.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div className="bg-accent/50 rounded-lg p-4">
          <p className="text-sm text-accent-foreground">
            <strong>Tip:</strong> For the best experience, use a centered logo on a solid 
            background that matches your app's branding.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SplashScreenStep;