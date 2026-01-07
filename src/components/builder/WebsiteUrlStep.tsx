import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Globe, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WebsiteUrlStepProps {
  websiteUrl: string;
  setWebsiteUrl: (url: string) => void;
}

const WebsiteUrlStep = ({ websiteUrl, setWebsiteUrl }: WebsiteUrlStepProps) => {
  const previewUrl = () => {
    if (websiteUrl) {
      window.open(websiteUrl, "_blank");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Globe className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Enter Your Website URL</h2>
        <p className="text-muted-foreground">
          Provide the website URL you want to convert into a mobile app
        </p>
      </div>

      <div className="space-y-4 max-w-md mx-auto">
        <div className="space-y-2">
          <Label htmlFor="website-url">Website URL</Label>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              id="website-url"
              type="url"
              placeholder="https://example.com"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              className="pl-10 h-12"
            />
          </div>
        </div>

        {websiteUrl && (
          <Button
            variant="outline"
            onClick={previewUrl}
            className="w-full"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Preview Website
          </Button>
        )}

        <div className="bg-accent/50 rounded-lg p-4">
          <p className="text-sm text-accent-foreground">
            <strong>Tip:</strong> Make sure your website is responsive and 
            mobile-friendly for the best app experience.
          </p>
        </div>
      </div>
    </div>
  );
};

export default WebsiteUrlStep;
