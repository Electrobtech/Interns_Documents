"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play } from "lucide-react";

const channels = [
  { name: "WhatsApp", base: 148 },
  { name: "Instagram", base: 92 },
  { name: "Messenger", base: 41 },
  { name: "Telegram", base: 33 },
  { name: "Web chat", base: 61 },
  { name: "Email", base: 74 },
  { name: "SMS", base: 22 },
  { name: "Voice", base: 18 },
  { name: "Video", base: 7 },
];

export function HeroSection() {
  const [isVisible, setIsVisible] = useState(false);
  const [counts, setCounts] = useState(channels.map((c) => c.base));

  useEffect(() => setIsVisible(true), []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCounts(channels.map((c) => c.base + Math.floor(Math.random() * 24 - 8)));
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative flex min-h-screen items-center overflow-hidden pt-28">
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-60" />
      <div className="pointer-events-none absolute -left-40 top-20 h-[420px] w-[420px] rounded-full bg-primary/20 blur-[120px]" />
      <div className="pointer-events-none absolute -right-32 bottom-0 h-[360px] w-[360px] rounded-full bg-accent/10 blur-[120px]" />

      <div className="relative z-10 mx-auto grid w-full max-w-[1400px] items-center gap-16 px-6 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:px-12">
        {/* Left copy */}
        <div>
          <div
            className={`mb-6 transition-all duration-700 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground">
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-accent" />
              Enterprise AI engagement platform
            </span>
          </div>

          <h1
            className={`text-balance text-[clamp(2.5rem,6vw,4.75rem)] font-semibold leading-[1.02] tracking-tight transition-all duration-1000 ${
              isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
            }`}
          >
            Every channel, every customer,{" "}
            <span className="text-accent">one platform</span>
          </h1>

          <p
            className={`mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground transition-all delay-200 duration-700 ${
              isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
            }`}
          >
            WhatsApp, Instagram, email, calls — they all land in the same place. The AI answers 82% of them on its
            own, keeps your CRM current while it does it, and hands you only what&apos;s worth your time.
          </p>

          <div
            className={`mt-8 flex flex-col items-start gap-4 transition-all delay-300 duration-700 sm:flex-row sm:items-center ${
              isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
            }`}
          >
            <Button size="lg" className="group h-13 rounded-full bg-primary px-7 text-base text-primary-foreground hover:bg-primary/90">
              Book a demo
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button size="lg" variant="outline" className="h-13 rounded-full border-border px-7 text-base hover:bg-card">
              <Play className="mr-2 h-4 w-4" />
              See the platform
            </Button>
          </div>

          <p className="mt-4 font-mono text-xs text-muted-foreground">
            20 minutes · we&apos;ll run it on your own messages
          </p>
        </div>

        {/* Right dashboard card */}
        <div
          className={`transition-all delay-200 duration-1000 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}
        >
          <div className="rounded-2xl border border-border bg-card/70 p-5 shadow-2xl backdrop-blur-sm glow-primary">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="live-dot h-2 w-2 rounded-full bg-accent" />
                <span className="font-mono text-xs uppercase tracking-widest text-accent">Live</span>
              </div>
              <span className="font-mono text-xs text-muted-foreground">rolling 60 seconds · anonymized</span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {channels.map((c, i) => (
                <div key={c.name} className="rounded-xl border border-border bg-background/50 p-3">
                  <p className="font-mono text-[11px] text-muted-foreground">{c.name}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">{counts[i]}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between rounded-xl border border-primary/30 bg-primary/10 px-4 py-3">
              <div>
                <p className="text-xs text-muted-foreground">Auto-resolved</p>
                <p className="text-lg font-semibold text-foreground">82.6%</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Median first reply</p>
                <p className="text-lg font-semibold text-accent">3.1s</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
