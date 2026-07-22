import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function CtaSection() {
  return (
    <section className="relative border-t border-border/60 py-24 lg:py-32">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-card/60 px-8 py-16 text-center lg:px-16 lg:py-20">
          <div className="grid-bg pointer-events-none absolute inset-0 opacity-50" />
          <div className="pointer-events-none absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 rounded-full bg-primary/20 blur-[100px]" />

          <div className="relative z-10 mx-auto max-w-2xl">
            <h2 className="text-balance text-3xl font-semibold leading-tight tracking-tight lg:text-5xl">
              Tonight, 400 people will message you. Someone should answer.
            </h2>
            <p className="mt-5 text-pretty text-lg leading-relaxed text-muted-foreground">
              Bring a week of your real messages. We&apos;ll run an agent live and show you exactly what would have
              resolved, escalated, and sold — before you commit to anything.
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button size="lg" className="group h-13 rounded-full bg-primary px-8 text-base text-primary-foreground hover:bg-primary/90">
                Book a demo
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
              <Button size="lg" variant="outline" className="h-13 rounded-full border-border px-8 text-base hover:bg-background">
                Talk to an engineer
              </Button>
            </div>

            <p className="mt-5 font-mono text-xs text-muted-foreground">
              20 minutes · no slides · we&apos;ll quote you on the call
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
