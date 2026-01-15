import { useState, useEffect } from "react";
import { Smartphone, Monitor, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ExpoSnackPreviewProps {
  websiteUrl: string;
  appName: string;
  enableNavigation: boolean;
  navItems: Array<{ label: string; url: string; icon: string }>;
}

type DeviceType = "iphone" | "android" | "desktop";

const ExpoSnackPreview = ({
  websiteUrl,
  appName,
  enableNavigation,
  navItems,
}: ExpoSnackPreviewProps) => {
  const [device, setDevice] = useState<DeviceType>("iphone");
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState(0);
  const [currentUrl, setCurrentUrl] = useState(websiteUrl || "https://example.com");

  useEffect(() => {
    if (websiteUrl) {
      setCurrentUrl(websiteUrl);
      setLoading(true);
    }
  }, [websiteUrl]);

  const handleRefresh = () => {
    setLoading(true);
    setKey((prev) => prev + 1);
  };

  const getDeviceStyles = () => {
    switch (device) {
      case "iphone":
        return {
          frame: "w-[280px] h-[580px] bg-black rounded-[45px] p-[12px] shadow-2xl relative",
          screen: "w-full h-full bg-white rounded-[35px] overflow-hidden relative",
          notch: "absolute top-0 left-1/2 -translate-x-1/2 w-[120px] h-[28px] bg-black rounded-b-[18px] z-20",
          homeIndicator: "absolute bottom-[8px] left-1/2 -translate-x-1/2 w-[100px] h-[4px] bg-gray-300 rounded-full z-20",
        };
      case "android":
        return {
          frame: "w-[280px] h-[580px] bg-gray-900 rounded-[25px] p-[10px] shadow-2xl relative",
          screen: "w-full h-full bg-white rounded-[18px] overflow-hidden relative",
          notch: "absolute top-[6px] left-1/2 -translate-x-1/2 w-[8px] h-[8px] bg-gray-700 rounded-full z-20",
          homeIndicator: "",
        };
      case "desktop":
        return {
          frame: "w-full max-w-[600px] h-[400px] bg-gray-800 rounded-t-lg shadow-2xl relative",
          screen: "w-full h-full bg-white overflow-hidden",
          notch: "",
          homeIndicator: "",
        };
    }
  };

  const styles = getDeviceStyles();

  // Format the URL properly
  const getIframeUrl = () => {
    if (!currentUrl) return "about:blank";
    try {
      const url = new URL(currentUrl.startsWith("http") ? currentUrl : `https://${currentUrl}`);
      return url.toString();
    } catch {
      return "about:blank";
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Device Selection Controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button
            variant={device === "iphone" ? "default" : "outline"}
            size="sm"
            onClick={() => setDevice("iphone")}
          >
            <Smartphone className="w-4 h-4 mr-1" />
            iPhone
          </Button>
          <Button
            variant={device === "android" ? "default" : "outline"}
            size="sm"
            onClick={() => setDevice("android")}
          >
            <Smartphone className="w-4 h-4 mr-1" />
            Android
          </Button>
          <Button
            variant={device === "desktop" ? "default" : "outline"}
            size="sm"
            onClick={() => setDevice("desktop")}
          >
            <Monitor className="w-4 h-4 mr-1" />
            Desktop
          </Button>
        </div>

        <Button variant="ghost" size="sm" onClick={handleRefresh}>
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Preview Container */}
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-muted/50 to-muted rounded-xl p-6 min-h-[500px]">
        <div className={styles.frame}>
          {/* Notch / Camera */}
          {styles.notch && <div className={styles.notch} />}
          
          {/* Screen */}
          <div className={styles.screen}>
            {/* Loading Overlay */}
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/90 z-30">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                  <p className="text-sm text-muted-foreground mt-2">Loading preview...</p>
                </div>
              </div>
            )}

            {/* Status Bar for Mobile */}
            {device !== "desktop" && (
              <div className="absolute top-0 left-0 right-0 h-[44px] bg-white/95 backdrop-blur-sm z-10 flex items-center justify-between px-6 text-xs">
                <span className="font-medium">9:41</span>
                <div className="flex items-center gap-1">
                  <div className="flex gap-[2px]">
                    <div className="w-[3px] h-[8px] bg-gray-800 rounded-sm" />
                    <div className="w-[3px] h-[10px] bg-gray-800 rounded-sm" />
                    <div className="w-[3px] h-[12px] bg-gray-800 rounded-sm" />
                    <div className="w-[3px] h-[14px] bg-gray-800 rounded-sm" />
                  </div>
                  <span className="ml-1 font-medium">5G</span>
                  <div className="ml-2 w-[22px] h-[11px] border border-gray-800 rounded-[3px] relative">
                    <div className="absolute inset-[2px] bg-green-500 rounded-[1px]" />
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Bar (if enabled) */}
            {enableNavigation && navItems.length > 0 && device !== "desktop" && (
              <div className="absolute bottom-0 left-0 right-0 h-[56px] bg-white/95 backdrop-blur-sm border-t border-gray-200 z-10 flex items-center justify-around px-4">
                {navItems.slice(0, 5).map((item, index) => (
                  <div key={index} className="flex flex-col items-center gap-1">
                    <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                      <span className="text-xs">{item.icon || "🏠"}</span>
                    </div>
                    <span className="text-[10px] text-gray-600 truncate max-w-[50px]">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Website Iframe */}
            <iframe
              key={key}
              src={getIframeUrl()}
              className={`w-full h-full border-0 ${device !== "desktop" ? "pt-[44px]" : ""} ${enableNavigation && navItems.length > 0 && device !== "desktop" ? "pb-[56px]" : ""}`}
              onLoad={() => setLoading(false)}
              onError={() => setLoading(false)}
              title="App Preview"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          </div>

          {/* Home Indicator */}
          {styles.homeIndicator && <div className={styles.homeIndicator} />}

          {/* Desktop Stand */}
          {device === "desktop" && (
            <>
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-[120px] h-[60px] bg-gray-700 rounded-b-lg" />
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-[200px] h-[12px] bg-gray-600 rounded-full" />
            </>
          )}
        </div>
      </div>

      {/* App Name & URL Info */}
      <div className="mt-4 text-center">
        <p className="font-medium text-sm">{appName || "Your App"}</p>
        <p className="text-xs text-muted-foreground truncate max-w-[300px] mx-auto">
          {currentUrl || "Enter a website URL to preview"}
        </p>
      </div>

      {/* Info */}
      <p className="text-xs text-muted-foreground mt-2 text-center">
        This preview shows how your website will appear inside the native app wrapper.
      </p>
    </div>
  );
};

export default ExpoSnackPreview;
