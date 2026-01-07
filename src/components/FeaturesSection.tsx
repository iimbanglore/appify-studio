import { 
  Globe, 
  Smartphone, 
  Key, 
  Image, 
  Menu, 
  Download,
  Zap,
  Shield,
  Palette
} from "lucide-react";

const features = [
  {
    icon: Globe,
    title: "Any Website",
    description: "Convert any website URL into a fully functional mobile application with WebView technology.",
  },
  {
    icon: Smartphone,
    title: "APK & IPA Export",
    description: "Generate production-ready APK for Android and IPA for iOS, ready for store submission.",
  },
  {
    icon: Key,
    title: "JKS Key Generator",
    description: "Built-in keystore generator for signing your Android apps securely.",
  },
  {
    icon: Image,
    title: "Custom App Icons",
    description: "Upload and configure custom app icons that look perfect on all devices.",
  },
  {
    icon: Menu,
    title: "Navigation Menu",
    description: "Add custom navigation bars and menus to enhance your app's user experience.",
  },
  {
    icon: Download,
    title: "Instant Download",
    description: "Download your converted app files instantly with no waiting time.",
  },
  {
    icon: Zap,
    title: "Fast Conversion",
    description: "Our optimized pipeline converts your website to an app in under 5 minutes.",
  },
  {
    icon: Shield,
    title: "Store Compliance",
    description: "Generated apps meet all Google Play Store and Apple App Store requirements.",
  },
  {
    icon: Palette,
    title: "Customization",
    description: "Customize splash screens, colors, orientation, and more app settings.",
  },
];

const FeaturesSection = () => {
  return (
    <section id="features" className="py-24 bg-background">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Everything You Need to
            <span className="gradient-text"> Build Apps</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Powerful features to convert, customize, and deploy your website as a native mobile application.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group p-6 rounded-2xl card-gradient border border-border/50 hover:border-primary/30 hover:shadow-lg transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
