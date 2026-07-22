import { Star } from "lucide-react";

const logos = ["Trident Systems", "Padmini Décor", "VOC Automotive", "Skillfinity", "Rankzy", "Vertex Labs"];

const testimonials = [
  {
    company: "VOC Automotive",
    quote:
      "It refuses to invent discounts. When it doesn't know, it says so and pulls in a human — that alone rebuilt our trust in automation.",
  },
  {
    company: "Padmini Décor",
    quote:
      "Our CRM is finally correct, because nobody maintains it. Every conversation updates the record while it happens.",
  },
  {
    company: "Trident Systems",
    quote:
      "We stopped running a night shift. Mornings start with pipeline, not a backlog of missed messages.",
  },
];

const metrics = [
  { value: "82.6%", label: "of conversations closed without a human ever opening them" },
  { value: "2m 11s", label: "median wait for the ones that do need a person" },
  { value: "4.7 / 5", label: "CSAT across 2,140 ratings" },
  { value: "₹42.8L", label: "pipeline added from threads that used to be support tickets" },
];

export function CustomersSection() {
  return (
    <section id="customers" className="relative border-t border-border/60 py-24 lg:py-32">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
        <p className="text-center text-sm font-medium uppercase tracking-widest text-muted-foreground">
          Answering for teams at
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
          {logos.map((name) => (
            <span key={name} className="text-lg font-semibold tracking-tight text-foreground/50">
              {name}
            </span>
          ))}
        </div>

        <div className="mt-16 grid gap-5 md:grid-cols-3">
          {testimonials.map((t) => (
            <figure key={t.company} className="rounded-2xl border border-border bg-card/60 p-7">
              <div className="flex gap-0.5 text-accent">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <blockquote className="mt-4 text-pretty leading-relaxed text-foreground/90">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-5 text-sm font-medium text-muted-foreground">{t.company}</figcaption>
            </figure>
          ))}
        </div>

        <div className="mt-8 flex justify-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-1.5 text-xs font-medium text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Ninety days in, across 40 workspaces
          </span>
        </div>

        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((m) => (
            <div key={m.value} className="bg-card/60 p-7">
              <p className="text-3xl font-semibold tracking-tight text-foreground">{m.value}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{m.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
