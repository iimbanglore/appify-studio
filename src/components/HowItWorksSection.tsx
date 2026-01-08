import { Globe, Settings, Rocket, Download, ArrowRight } from "lucide-react";

const steps = [
  {
    step: "01",
    icon: Globe,
    title: "Enter Your Website URL",
    description: "Simply paste your website URL. Our engine instantly analyzes your site structure, content, and design to prepare for conversion.",
    color: "from-cyan-500 to-blue-500",
  },
  {
    step: "02",
    icon: Settings,
    title: "Customize Your App",
    description: "Upload your app icon, configure splash screens, add navigation menus, and set your app name and package ID.",
    color: "from-blue-500 to-indigo-500",
  },
  {
    step: "03",
    icon: Rocket,
    title: "Build in Minutes",
    description: "Our cloud-powered build system generates your APK, AAB, and IPA files. No coding, no SDK installations required.",
    color: "from-indigo-500 to-purple-500",
  },
  {
    step: "04",
    icon: Download,
    title: "Download & Publish",
    description: "Download your store-ready app files instantly. Upload directly to Google Play Store and Apple App Store.",
    color: "from-purple-500 to-pink-500",
  },
];

const HowItWorksSection = () => {
  return (
    <section id="how-it-works" className="py-24 bg-background relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent text-accent-foreground text-sm font-medium mb-6">
            <Rocket className="w-4 h-4" />
            Simple 4-Step Process
          </div>
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            From Website to App in
            <span className="gradient-text"> Under 5 Minutes</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            No coding skills required. No complicated SDKs. Just paste your URL and let Appify do the heavy lifting.
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <div key={index} className="relative group">
              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-12 left-[60%] w-full h-0.5 bg-gradient-to-r from-border to-transparent z-0">
                  <ArrowRight className="absolute -right-2 -top-2 w-5 h-5 text-muted-foreground/30" />
                </div>
              )}

              <div className="relative z-10 text-center lg:text-left">
                {/* Step Number */}
                <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-br mb-6 shadow-lg group-hover:scale-105 transition-transform"
                  style={{ background: `linear-gradient(135deg, var(--tw-gradient-stops))` }}
                >
                  <div className={`w-full h-full rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center`}>
                    <step.icon className="w-10 h-10 text-white" />
                  </div>
                </div>

                {/* Content */}
                <div className="space-y-3">
                  <span className="text-sm font-bold text-primary">{step.step}</span>
                  <h3 className="text-xl font-bold">{step.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{step.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
