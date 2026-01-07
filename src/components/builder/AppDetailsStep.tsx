import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Smartphone, Package } from "lucide-react";

interface AppDetailsStepProps {
  appName: string;
  setAppName: (name: string) => void;
  packageId: string;
  setPackageId: (id: string) => void;
  appDescription: string;
  setAppDescription: (desc: string) => void;
}

const AppDetailsStep = ({
  appName,
  setAppName,
  packageId,
  setPackageId,
  appDescription,
  setAppDescription,
}: AppDetailsStepProps) => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Smartphone className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold mb-2">App Details</h2>
        <p className="text-muted-foreground">
          Configure the basic information for your mobile app
        </p>
      </div>

      <div className="space-y-4 max-w-md mx-auto">
        <div className="space-y-2">
          <Label htmlFor="app-name">App Name</Label>
          <Input
            id="app-name"
            placeholder="My Awesome App"
            value={appName}
            onChange={(e) => setAppName(e.target.value)}
            className="h-12"
          />
          <p className="text-xs text-muted-foreground">
            This name will appear on the home screen
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="package-id">Package ID</Label>
          <div className="relative">
            <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              id="package-id"
              placeholder="com.example.myapp"
              value={packageId}
              onChange={(e) => setPackageId(e.target.value)}
              className="pl-10 h-12"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Unique identifier for app stores (e.g., com.company.appname)
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="app-description">App Description</Label>
          <Textarea
            id="app-description"
            placeholder="Describe your app in a few sentences..."
            value={appDescription}
            onChange={(e) => setAppDescription(e.target.value)}
            rows={4}
          />
        </div>
      </div>
    </div>
  );
};

export default AppDetailsStep;
