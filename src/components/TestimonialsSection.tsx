import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    name: "Sarah Johnson",
    role: "Founder, TechStartup",
    content: "Appify saved us months of development time. We converted our e-commerce site to an app in literally 5 minutes. Our mobile sales increased by 40%!",
    rating: 5,
    avatar: "SJ",
  },
  {
    name: "Michael Chen",
    role: "Marketing Director",
    content: "I was skeptical at first, but the app Appify generated looks completely professional. Our customers love it, and we didn't spend a fortune on developers.",
    rating: 5,
    avatar: "MC",
  },
  {
    name: "Emma Williams",
    role: "Small Business Owner",
    content: "As a non-technical person, I never thought I could have my own app. Appify made it possible. The whole process was incredibly simple.",
    rating: 5,
    avatar: "EW",
  },
];

const TestimonialsSection = () => {
  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent text-accent-foreground text-sm font-medium mb-6">
            <Star className="w-4 h-4 fill-current" />
            Customer Stories
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Trusted by
            <span className="gradient-text"> 10,000+ Businesses</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            See what our customers say about their experience with Appify.
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="relative p-8 rounded-2xl card-gradient border border-border/50 hover:border-primary/30 hover:shadow-xl transition-all duration-300 group"
            >
              {/* Quote Icon */}
              <div className="absolute -top-4 -left-2 w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                <Quote className="w-5 h-5 text-primary-foreground" />
              </div>

              {/* Rating */}
              <div className="flex gap-1 mb-4 pt-2">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 text-yellow-500 fill-current" />
                ))}
              </div>

              {/* Content */}
              <p className="text-muted-foreground mb-6 leading-relaxed">
                "{testimonial.content}"
              </p>

              {/* Author */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                  {testimonial.avatar}
                </div>
                <div>
                  <div className="font-semibold">{testimonial.name}</div>
                  <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
