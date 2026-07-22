import { Headset, TrendingUp, Sparkles } from "lucide-react";

const layers = [
  {
    icon: Headset,
    label: "Support",
    stat: "3.1 seconds",
    statLabel: "Median first reply",
    copy: "Every inbound question answered instantly, with the AI resolving the routine and escalating the rest.",
  },
  {
    icon: TrendingUp,
    label: "Sales",
    stat: "2.4× better fit",
    statLabel: "Leads reaching a rep",
    copy: "Real buyers are qualified in the thread and routed to sales with full context — no lead ever goes cold.",
  },
  {
    icon: Sparkles,
    label: "Growth",
    stat: "−41%",
    statLabel: "Wasted campaign spend",
    copy: "Campaigns follow up based on what was actually said, so you stop paying to talk to the wrong people.",
  },
];

export function LayersSection() {
  return (
    <section className="relative border-t border-border/60 py-24 lg:py-32">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
        <div className="max-w-2xl">
          <h2 className="text-balance text-3xl font-semibold tracking-tight lg:text-4xl">
            One platform, three layers, nothing to integrate
          </h2>
          <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
            Support, sales, and growth run in a single stack instead of three disconnected tools. The same
            conversation moves between jobs without a handoff, an export, or a dropped context.
          </p>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {layers.map((layer) => (
            <div
              key={layer.label}
              className="hover-lift rounded-2xl border border-border bg-card/60 p-7"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-background text-accent">
                <layer.icon className="h-5 w-5" />
              </div>
              <p className="mt-5 text-sm font-medium uppercase tracking-widest text-muted-foreground">
                {layer.label}
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight">{layer.stat}</p>
              <p className="text-sm text-accent">{layer.statLabel}</p>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{layer.copy}</p>
            </div>
          ))}
        </div>

        <p className="mt-8 font-mono text-sm text-muted-foreground">
          Three jobs, one system, no handoff tax.
        </p>
      </div>
    </section>
  );
}
