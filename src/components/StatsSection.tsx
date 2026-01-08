import { TrendingUp, Clock, Users, Star } from "lucide-react";

const stats = [
  {
    icon: Clock,
    value: "< 5 min",
    label: "Average Build Time",
    description: "Lightning-fast conversion",
  },
  {
    icon: Users,
    value: "10,000+",
    label: "Apps Generated",
    description: "Trusted by businesses worldwide",
  },
  {
    icon: TrendingUp,
    value: "99.9%",
    label: "Success Rate",
    description: "Reliable builds every time",
  },
  {
    icon: Star,
    value: "4.9/5",
    label: "User Rating",
    description: "Loved by developers",
  },
];

const StatsSection = () => {
  return (
    <section className="py-16 relative overflow-hidden">
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/90 to-primary" />
      
      {/* Pattern Overlay */}
      <div className="absolute inset-0 opacity-10">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="text-center text-white group"
            >
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-white/10 backdrop-blur mb-4 group-hover:bg-white/20 transition-colors">
                <stat.icon className="w-7 h-7" />
              </div>
              <div className="text-3xl md:text-4xl font-bold mb-1">{stat.value}</div>
              <div className="text-white/90 font-medium mb-1">{stat.label}</div>
              <div className="text-white/60 text-sm">{stat.description}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StatsSection;
