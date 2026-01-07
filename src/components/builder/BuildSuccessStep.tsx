import { Button } from "@/components/ui/button";
import { CheckCircle, Download, ExternalLink, Play, Apple } from "lucide-react";

interface BuildSuccessStepProps {
  selectedPlatforms: string[];
  appName: string;
  onStartOver: () => void;
}

const BuildSuccessStep = ({
  selectedPlatforms,
  appName,
  onStartOver,
}: BuildSuccessStepProps) => {
  return (
    <div className="space-y-6 animate-fade-in text-center">
      <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
        <CheckCircle className="w-10 h-10 text-green-500" />
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-2">Build Successful!</h2>
        <p className="text-muted-foreground">
          Your app "{appName}" has been built successfully
        </p>
      </div>

      {/* Download Links */}
      <div className="max-w-md mx-auto space-y-3">
        {selectedPlatforms.includes("android") && (
          <Button variant="glass" size="lg" className="w-full justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Play className="w-5 h-5 text-green-600" />
              </div>
              <div className="text-left">
                <p className="font-medium">Android APK</p>
                <p className="text-xs text-muted-foreground">Ready for Play Store</p>
              </div>
            </div>
            <Download className="w-5 h-5" />
          </Button>
        )}

        {selectedPlatforms.includes("ios") && (
          <Button variant="glass" size="lg" className="w-full justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Apple className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-left">
                <p className="font-medium">iOS IPA</p>
                <p className="text-xs text-muted-foreground">Ready for App Store</p>
              </div>
            </div>
            <Download className="w-5 h-5" />
          </Button>
        )}
      </div>

      {/* Next Steps */}
      <div className="bg-accent/50 rounded-xl p-6 max-w-md mx-auto text-left">
        <h3 className="font-semibold mb-3">Next Steps</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs mt-0.5">1</span>
            <span>Download your app file(s)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs mt-0.5">2</span>
            <span>Test on a device or emulator</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs mt-0.5">3</span>
            <span>Submit to the app store of your choice</span>
          </li>
        </ul>
      </div>

      {/* Documentation Links */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
        <Button variant="outline" className="flex-1">
          <ExternalLink className="w-4 h-4 mr-2" />
          Play Store Guide
        </Button>
        <Button variant="outline" className="flex-1">
          <ExternalLink className="w-4 h-4 mr-2" />
          App Store Guide
        </Button>
      </div>

      <div className="pt-6">
        <Button variant="ghost" onClick={onStartOver}>
          Create Another App
        </Button>
      </div>
    </div>
  );
};

export default BuildSuccessStep;
