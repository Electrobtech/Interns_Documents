"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Target } from "lucide-react";

function useTicker(base: number, spread: number, interval = 2000) {
  const [value, setValue] = useState(base);
  useEffect(() => {
    const id = setInterval(() => {
      setValue(base + Math.floor(Math.random() * spread));
    }, interval);
    return () => clearInterval(id);
  }, [base, spread, interval]);
  return value;
}

export function OutcomesSection() {
  const done = useTicker(1040, 40);
  const waiting = useTicker(78, 14, 2600);
  const qualified = useTicker(128, 20, 3000);

  const cards = [
    {
      icon: CheckCircle2,
      tone: "accent",
      status: "Done — nobody touched it",
      value: done.toLocaleString(),
      unit: "in the last minute",
      foot: "82.6% of everything",
    },
    {
      icon: Clock,
      tone: "primary",
      status: "Your turn — reply is drafted",
      value: waiting.toString(),
      unit: "waiting",
      foot: "median wait 2m 11s",
    },
    {
      icon: Target,
      tone: "accent",
      status: "Real buyer — sent to sales",
      value: qualified.toString(),
      unit: "qualified",
      foot: "₹42.8L pipeline added",
    },
  ];

  return (
    <section className="relative py-8">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
        <div className="overflow-hidden rounded-2xl border border-border bg-card/50">
          <div className="flex items-center gap-2 border-b border-border/60 px-6 py-3">
            <span className="live-dot h-2 w-2 rounded-full bg-accent" />
            <span className="font-mono text-xs uppercase tracking-widest text-accent">Live outcomes</span>
            <span className="ml-auto font-mono text-xs text-muted-foreground">updating every few seconds</span>
          </div>
          <div className="grid divide-y divide-border/60 md:grid-cols-3 md:divide-x md:divide-y-0">
            {cards.map((c) => (
              <div key={c.status} className="p-6">
                <div className="flex items-center gap-2">
                  <c.icon
                    className={`h-4 w-4 ${c.tone === "accent" ? "text-accent" : "text-primary"}`}
                  />
                  <p className="text-sm font-medium text-foreground">{c.status}</p>
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-4xl font-semibold tabular-nums tracking-tight">{c.value}</span>
                  <span className="text-sm text-muted-foreground">{c.unit}</span>
                </div>
                <span
                  className={`mt-3 inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
                    c.tone === "accent"
                      ? "bg-accent/10 text-accent"
                      : "bg-primary/15 text-primary-foreground"
                  }`}
                >
                  {c.foot}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
