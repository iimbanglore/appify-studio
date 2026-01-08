import { 
  Zap, 
  Shield, 
  Code2, 
  Smartphone, 
  RefreshCw, 
  HeadphonesIcon,
  CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const benefits = [
  {
    icon: Zap,
    title: "Instant Conversion",
    description: "No waiting. Our cloud infrastructure converts your website to a fully functional app in under 5 minutes.",
  },
  {
    icon: Code2,
    title: "Zero Coding Required",
    description: "You don't need to write a single line of code. Just configure and download your ready-to-publish app.",
  },
  {
    icon: Shield,
    title: "Store-Ready Output",
    description: "Generated APK, AAB, and IPA files meet all Google Play Store and Apple App Store requirements.",
  },
  {
    icon: RefreshCw,
    title: "Real-Time Updates",
    description: "Your app content updates automatically when you update your website. No need to republish.",
  },
  {
    icon: Smartphone,
    title: "Native Experience",
    description: "WebView technology ensures your app looks and feels native on both Android and iOS devices.",
  },
  {
    icon: HeadphonesIcon,
    title: "24/7 Support",
    description: "Our dedicated support team is always ready to help you with any questions or issues.",
  },
];

const checklist = [
  "APK file for Android devices",
  "AAB bundle for Google Play Store",
  "IPA file for iOS devices",
  "Custom app icons and splash screens",
  "Secure JKS keystore generation",
  "Navigation bar customization",
];

const WhyChooseSection = () => {
  return (
    <section className="py-24 bg-muted/30 relative overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left Content */}
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent text-accent-foreground text-sm font-medium mb-6">
              <Shield className="w-4 h-4" />
              Why Choose Appify
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              The Fastest Way to
              <span className="gradient-text"> Grow Your Business</span>
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              In today's mobile-first world, having an app is essential. Appify eliminates the complexity and cost of traditional app development, letting you reach your mobile audience in minutes, not months.
            </p>

            {/* Checklist */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
              {checklist.map((item, index) => (
                <div key={index} className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">{item}</span>
                </div>
              ))}
            </div>

            <Link to="/builder">
              <Button variant="hero" size="lg">
                <Zap className="w-5 h-5" />
                Start Converting Now
              </Button>
            </Link>
          </div>

          {/* Right Content - Benefits Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {benefits.map((benefit, index) => (
              <div
                key={index}
                className="p-6 rounded-2xl card-gradient border border-border/50 hover:border-primary/30 hover:shadow-lg transition-all duration-300 group"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <benefit.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{benefit.title}</h3>
                <p className="text-sm text-muted-foreground">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default WhyChooseSection;
