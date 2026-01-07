import { useState, useRef } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Image, Upload, X } from "lucide-react";

interface IconUploadStepProps {
  appIcon: string | null;
  setAppIcon: (icon: string | null) => void;
}

const IconUploadStep = ({ appIcon, setAppIcon }: IconUploadStepProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = (file: File) => {
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setAppIcon(e.target?.result as string);
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Image className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Upload App Icon</h2>
        <p className="text-muted-foreground">
          Upload a custom icon for your mobile app (recommended: 512x512 PNG)
        </p>
      </div>

      <div className="max-w-md mx-auto">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
          className="hidden"
        />

        {appIcon ? (
          <div className="text-center space-y-4">
            <div className="relative inline-block">
              <img
                src={appIcon}
                alt="App Icon Preview"
                className="w-32 h-32 rounded-3xl shadow-lg object-cover mx-auto"
              />
              <button
                onClick={() => setAppIcon(null)}
                className="absolute -top-2 -right-2 w-8 h-8 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:bg-destructive/90 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto rounded-xl overflow-hidden shadow-md mb-2">
                  <img src={appIcon} alt="Small" className="w-full h-full object-cover" />
                </div>
                <p className="text-xs text-muted-foreground">Small</p>
              </div>
              <div className="text-center">
                <div className="w-20 h-20 mx-auto rounded-2xl overflow-hidden shadow-md mb-2">
                  <img src={appIcon} alt="Medium" className="w-full h-full object-cover" />
                </div>
                <p className="text-xs text-muted-foreground">Medium</p>
              </div>
              <div className="text-center">
                <div className="w-24 h-24 mx-auto rounded-3xl overflow-hidden shadow-md mb-2">
                  <img src={appIcon} alt="Large" className="w-full h-full object-cover" />
                </div>
                <p className="text-xs text-muted-foreground">Large</p>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="mt-4"
            >
              Change Icon
            </Button>
          </div>
        ) : (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200 ${
              isDragging
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-accent/50"
            }`}
          >
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Upload className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-foreground font-medium mb-1">
              Drop your icon here or click to browse
            </p>
            <p className="text-sm text-muted-foreground">
              PNG, JPG, or SVG • 512x512 recommended
            </p>
          </div>
        )}

        <div className="bg-accent/50 rounded-lg p-4 mt-6">
          <p className="text-sm text-accent-foreground">
            <strong>Tip:</strong> Use a square image with a transparent background 
            for the best results across all devices.
          </p>
        </div>
      </div>
    </div>
  );
};

export default IconUploadStep;
