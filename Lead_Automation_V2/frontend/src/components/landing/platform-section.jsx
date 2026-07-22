import { Inbox, Bot, Workflow, Database, Megaphone } from "lucide-react";

const pillars = [
  {
    icon: Inbox,
    title: "Omnichannel inbox",
    copy: "WhatsApp, Instagram, email, voice and more in one thread view — every message from a customer, unified.",
  },
  {
    icon: Bot,
    title: "AI agents",
    copy: "Agents that answer within your policies, know when to escalate, and hand off with the full context attached.",
  },
  {
    icon: Workflow,
    title: "Workflows",
    copy: "Route, tag, assign and follow up automatically. What used to need a rules engine now runs in the background.",
  },
  {
    icon: Database,
    title: "CRM & pipeline",
    copy: "Records and deals stay current because the conversation updates them — no manual data entry, ever.",
  },
  {
    icon: Megaphone,
    title: "Campaigns",
    copy: "Outbound that follows up based on what was actually said in the thread, not a stale segment.",
  },
];

const inbox = [
  { name: "Ramesh", snippet: "Is the 5-ton unit in stock for Whitefield?", time: "02:14" },
  { name: "Ananya", snippet: "Can I reschedule the site visit to Friday?", time: "08:47" },
  { name: "Trident Systems", snippet: "Renewal quote for 40 seats please", time: "09:02" },
  { name: "Divya", snippet: "Refund status for order #40118", time: "09:15" },
  { name: "Karthik", snippet: "Do you integrate with Zoho?", time: "09:21" },
];

export function PlatformSection() {
  return (
    <section id="platform" className="relative border-t border-border/60 py-24 lg:py-32">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
        <div className="max-w-2xl">
          <h2 className="text-balance text-3xl font-semibold tracking-tight lg:text-4xl">Inside the platform</h2>
          <p className="mt-3 text-lg text-muted-foreground">Five things that used to be five tools.</p>
        </div>

        <div className="mt-14 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
          <div className="grid gap-5 sm:grid-cols-2">
            {pillars.map((p) => (
              <div key={p.title} className="hover-lift rounded-2xl border border-border bg-card/60 p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background text-primary">
                  <p.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold tracking-tight">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.copy}</p>
              </div>
            ))}
            <div className="hidden rounded-2xl border border-dashed border-border bg-transparent p-6 sm:block">
              <p className="text-sm leading-relaxed text-muted-foreground">
                One record for every customer. One place for every team. Nothing to stitch together.
              </p>
            </div>
          </div>

          {/* Live inbox */}
          <div className="rounded-2xl border border-border bg-card/60 p-4">
            <div className="mb-3 flex items-center gap-2 px-2 pt-1">
              <span className="live-dot h-2 w-2 rounded-full bg-accent" />
              <span className="font-mono text-xs uppercase tracking-widest text-accent">Live inbox</span>
            </div>
            <ul className="flex flex-col gap-2">
              {inbox.map((item) => (
                <li
                  key={item.name + item.time}
                  className="flex items-start gap-3 rounded-xl border border-border bg-background/50 p-3"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-medium text-foreground">
                    {item.name.charAt(0)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{item.name}</p>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">{item.time}</span>
                    </div>
                    <p className="truncate text-sm text-muted-foreground">{item.snippet}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
