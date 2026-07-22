import { Pin } from "lucide-react";

const timeline = [
  { time: "02:14", title: "It arrives", copy: "A WhatsApp message lands while your team is asleep." },
  { time: "02:14", title: "It's understood", copy: "The AI reads intent, history, and account in one pass." },
  { time: "02:15", title: "It's answered honestly", copy: "A correct reply goes out — no invented promises." },
  { time: "09:02", title: "It's waiting, not lost", copy: "The one decision left for a human is pinned and ready." },
];

export function StorySection() {
  return (
    <section id="story" className="relative border-t border-border/60 py-24 lg:py-32">
      <div className="mx-auto grid max-w-[1400px] gap-12 px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-12">
        {/* Left narrative */}
        <div>
          <h2 className="text-balance text-3xl font-semibold tracking-tight lg:text-4xl">
            One real thread, start to finish
          </h2>
          <p className="mt-5 text-pretty text-lg leading-relaxed text-muted-foreground">
            A WhatsApp message at 2:14 AM. By 9 it&apos;s a qualified opportunity sitting in front of the right
            rep — resolved where it could be, escalated where it mattered, and logged the whole way through.
          </p>

          <ol className="mt-10 space-y-6 border-l border-border pl-6">
            {timeline.map((step) => (
              <li key={step.time + step.title} className="relative">
                <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-accent bg-background" />
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-sm text-accent">{step.time}</span>
                  <span className="text-sm font-medium">{step.title}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{step.copy}</p>
              </li>
            ))}
          </ol>
        </div>

        {/* Right conversation card */}
        <div className="rounded-2xl border border-border bg-card/60 p-5">
          <div className="mb-4 flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-sm font-medium">
                R
              </span>
              <div>
                <p className="text-sm font-medium">Ramesh</p>
                <p className="font-mono text-xs text-muted-foreground">WhatsApp · +91 ••• 2140</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-accent">
              <Pin className="h-3 w-3" />
              Pinned
            </span>
          </div>

          <div className="flex flex-col gap-3">
            <Bubble side="in" meta="02:14">
              Is the 5-ton AC unit available for a Whitefield install this week? Need it before Saturday.
            </Bubble>
            <Bubble side="out" meta="02:15 · AI agent">
              Yes — the 5-ton unit is in stock. Installation slots are open Thu and Fri in Whitefield. I&apos;ve
              held a provisional Friday slot for you. Shall I confirm?
            </Bubble>
            <Bubble side="in" meta="08:59">
              Friday works. Can someone confirm the final price with the AMC?
            </Bubble>
            <div className="rounded-xl border border-primary/30 bg-primary/10 p-3">
              <p className="text-xs font-medium text-foreground">Escalated to Sangeetha · Sales</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Draft reply prepared with AMC pricing. Waiting on rep confirmation — median wait 2m 11s.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Bubble({
  side,
  meta,
  children,
}: {
  side: "in" | "out";
  meta: string;
  children: React.ReactNode;
}) {
  const isOut = side === "out";
  return (
    <div className={`flex flex-col ${isOut ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isOut
            ? "rounded-br-sm bg-primary text-primary-foreground"
            : "rounded-bl-sm border border-border bg-background text-foreground"
        }`}
      >
        {children}
      </div>
      <span className="mt-1 font-mono text-[10px] text-muted-foreground">{meta}</span>
    </div>
  );
}
