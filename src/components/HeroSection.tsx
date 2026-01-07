import { Button } from "@/components/ui/button";
import { ArrowRight, Smartphone, Apple, Play, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import appifyLogo from "@/assets/appify-logo.png";

const HeroSection = () => {
  return (
    <section className="relative min-h-screen hero-gradient overflow-hidden pt-24">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/3 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col lg:flex-row items-center gap-12 py-16 lg:py-24">
          {/* Left Content */}
          <div className="flex-1 text-center lg:text-left animate-slide-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent text-accent-foreground text-sm font-medium mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              Powered by Ask2mesolution.com
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              <span className="gradient-text">Appify</span> Your Website Into a
              <span className="gradient-text"> Native App</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0 mb-8">
              Transform any website into a professional mobile app in minutes with Appify. 
              Generate store-ready APK and IPA files with custom icons, splash screens, and seamless navigation.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-12">
              <Link to="/builder">
                <Button variant="hero" size="xl" className="w-full sm:w-auto">
                  <Zap className="w-5 h-5" />
                  Start Building Now
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <Button variant="hero-outline" size="xl" className="w-full sm:w-auto">
                See How It Works
              </Button>
            </div>

            {/* Platform Badges */}
            <div className="flex items-center gap-6 justify-center lg:justify-start text-muted-foreground">
              <div className="flex items-center gap-2">
                <Play className="w-5 h-5" />
                <span className="text-sm font-medium">Play Store Ready</span>
              </div>
              <div className="flex items-center gap-2">
                <Apple className="w-5 h-5" />
                <span className="text-sm font-medium">App Store Ready</span>
              </div>
            </div>
          </div>

          {/* Right Content - Phone Mockup */}
          <div className="flex-1 relative animate-float">
            <div className="relative mx-auto w-72 md:w-80">
              {/* Phone Frame */}
              <div className="relative bg-foreground rounded-[3rem] p-3 shadow-2xl glow-effect">
                <div className="absolute top-6 left-1/2 -translate-x-1/2 w-20 h-6 bg-foreground rounded-full z-10" />
                <div className="bg-card rounded-[2.5rem] overflow-hidden aspect-[9/19.5]">
                  {/* Screen Content */}
                  <div className="h-full bg-gradient-to-br from-primary/20 to-primary/5 p-4 pt-10">
                    <div className="bg-card rounded-xl p-4 shadow-lg mb-4">
                      <div className="flex items-center gap-3 mb-3">
                        <img src={appifyLogo} alt="Appify" className="w-10 h-10 rounded-xl" />
                        <div>
                          <div className="text-xs font-semibold text-foreground">Appify</div>
                          <div className="text-[10px] text-muted-foreground">by Ask2mesolution</div>
                        </div>
                      </div>
                      <div className="h-2 w-full bg-foreground/5 rounded mb-2" />
                      <div className="h-2 w-3/4 bg-foreground/5 rounded" />
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3">
                      {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div
                          key={i}
                          className="aspect-square rounded-xl bg-card/80 shadow-sm flex items-center justify-center"
                        >
                          <div className="w-8 h-8 rounded-lg bg-primary/20" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating Elements */}
              <div className="absolute -right-8 top-1/4 glass-card rounded-xl p-3 animate-fade-in" style={{ animationDelay: '0.3s' }}>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <Play className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs font-medium">APK Ready</p>
                    <p className="text-[10px] text-muted-foreground">12.4 MB</p>
                  </div>
                </div>
              </div>

              <div className="absolute -left-8 bottom-1/3 glass-card rounded-xl p-3 animate-fade-in" style={{ animationDelay: '0.5s' }}>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <Apple className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs font-medium">IPA Ready</p>
                    <p className="text-[10px] text-muted-foreground">18.2 MB</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
