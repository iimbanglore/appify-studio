import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Play, Apple } from "lucide-react";
import { Link } from "react-router-dom";

const CTASection = () => {
  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-foreground via-foreground to-foreground/95" />
      
      {/* Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-primary/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
        
        {/* Floating Icons */}
        <div className="absolute top-1/4 left-10 w-16 h-16 rounded-2xl bg-primary/20 backdrop-blur flex items-center justify-center animate-float opacity-60">
          <Play className="w-8 h-8 text-primary" />
        </div>
        <div className="absolute bottom-1/4 right-10 w-16 h-16 rounded-2xl bg-primary/20 backdrop-blur flex items-center justify-center animate-float opacity-60" style={{ animationDelay: '2s' }}>
          <Apple className="w-8 h-8 text-primary" />
        </div>
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20 text-primary text-sm font-medium mb-8">
            <Sparkles className="w-4 h-4" />
            Ready to Transform Your Business?
          </div>

          {/* Heading */}
          <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold text-background mb-6 leading-tight">
            Convert Your Website Into a
            <span className="block text-primary"> Store-Ready App Today</span>
          </h2>

          {/* Description */}
          <p className="text-lg md:text-xl text-background/70 max-w-2xl mx-auto mb-10">
            Join thousands of businesses who have already expanded their reach with mobile apps. 
            No developers needed. No monthly fees. Just results.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link to="/builder">
              <Button 
                size="xl" 
                className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              >
                <Sparkles className="w-5 h-5" />
                Start Building Free
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <Button 
              size="xl" 
              variant="outline"
              className="w-full sm:w-auto border-background/20 text-background hover:bg-background/10"
            >
              Watch Demo
            </Button>
          </div>

          {/* Trust Indicators */}
          <div className="flex flex-wrap items-center justify-center gap-8 text-background/50 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              No credit card required
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              5-minute setup
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              Cancel anytime
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
