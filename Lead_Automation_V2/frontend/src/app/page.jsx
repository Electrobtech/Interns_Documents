'use client';

import Link from 'next/link';
import { ArrowRight, Zap, Play, Inbox, Bot, Workflow, Database, Megaphone, Pin, Headset, TrendingUp, Sparkles, CheckCircle2, Clock, Target, Star, MessageCircle, Instagram as InstagramIcon, MessagesSquare, Send, Globe, Mail, Smartphone, Phone, Video, Plug, HelpCircle } from 'lucide-react';

export default function Landing() {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-slate-950 text-white">
      {/* Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-6 lg:px-12">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 text-white">
              <Zap className="h-4 w-4" />
            </span>
            <span className="text-lg font-semibold tracking-tight">Lead Automation</span>
          </Link>

          <div className="hidden items-center gap-10 md:flex">
            <a href="#platform" className="text-sm text-slate-300 transition-colors hover:text-white">Platform</a>
            <a href="#story" className="text-sm text-slate-300 transition-colors hover:text-white">How it works</a>
            <a href="#channels" className="text-sm text-slate-300 transition-colors hover:text-white">Channels</a>
            <a href="#customers" className="text-sm text-slate-300 transition-colors hover:text-white">Customers</a>
          </div>

          <div className="hidden items-center gap-4 md:flex">
            <Link href="/login" className="text-sm text-slate-300 transition-colors hover:text-white">
              Sign in
            </Link>
            <Link href="/login" className="inline-flex items-center justify-center rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative flex min-h-screen items-center overflow-hidden pt-28">
        <div className="pointer-events-none absolute -left-40 top-20 h-[420px] w-[420px] rounded-full bg-blue-600/20 blur-[120px]" />
        <div className="pointer-events-none absolute -right-32 bottom-0 h-[360px] w-[360px] rounded-full bg-purple-600/10 blur-[120px]" />

        <div className="relative z-10 mx-auto grid w-full max-w-[1400px] items-center gap-16 px-6 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:px-12">
          <div>
            <div className="mb-6">
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-xs font-medium text-slate-300">
                <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                Enterprise AI engagement platform
              </span>
            </div>

            <h1 className="text-[clamp(2.5rem,6vw,4.75rem)] font-semibold leading-[1.02] tracking-tight">
              Every channel, every customer,{' '}
              <span className="text-blue-400">one platform</span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-400">
              WhatsApp, Instagram, email, calls — they all land in the same place. The AI answers 82% of them on its
              own, keeps your CRM current while it does it, and hands you only what&apos;s worth your time.
            </p>

            <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <Link href="/login" className="inline-flex items-center justify-center rounded-full bg-blue-600 px-7 py-3 text-base font-semibold text-white hover:bg-blue-700 transition-colors">
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <button className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-900/50 px-7 py-3 text-base font-semibold text-white hover:bg-slate-800 transition-colors">
                <Play className="mr-2 h-4 w-4" />
                See the platform
              </button>
            </div>
          </div>

          {/* Dashboard Preview */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl backdrop-blur-sm">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                <span className="font-mono text-xs uppercase tracking-widest text-green-400">Live</span>
              </div>
              <span className="font-mono text-xs text-slate-400">rolling 60 seconds · anonymized</span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {['WhatsApp', 'Instagram', 'Email', 'SMS', 'Web chat', 'Voice'].map((channel, i) => (
                <div key={channel} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                  <p className="font-mono text-[11px] text-slate-400">{channel}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">{Math.floor(Math.random() * 100 + 50)}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3">
              <div>
                <p className="text-xs text-slate-400">Auto-resolved</p>
                <p className="text-lg font-semibold text-white">82.6%</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Median first reply</p>
                <p className="text-lg font-semibold text-blue-400">3.1s</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Layers Section */}
      <section className="relative border-t border-slate-800/60 py-24 lg:py-32">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight lg:text-4xl">
              One platform, three layers, nothing to integrate
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-400">
              Support, sales, and growth run in a single stack instead of three disconnected tools. The same
              conversation moves between jobs without a handoff, an export, or a dropped context.
            </p>
          </div>

          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {[
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
            ].map((layer) => (
              <div
                key={layer.label}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-7 hover:border-slate-700 transition-colors"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-800 bg-slate-950 text-blue-400">
                  <layer.icon className="h-5 w-5" />
                </div>
                <p className="mt-5 text-sm font-medium uppercase tracking-widest text-slate-400">
                  {layer.label}
                </p>
                <p className="mt-2 text-3xl font-semibold tracking-tight">{layer.stat}</p>
                <p className="text-sm text-blue-400">{layer.statLabel}</p>
                <p className="mt-4 text-sm leading-relaxed text-slate-400">{layer.copy}</p>
              </div>
            ))}
          </div>

          <p className="mt-8 font-mono text-sm text-slate-400">
            Three jobs, one system, no handoff tax.
          </p>
        </div>
      </section>

      {/* Outcomes Section */}
      <section className="relative py-8">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50">
            <div className="flex items-center gap-2 border-b border-slate-800/60 px-6 py-3">
              <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
              <span className="font-mono text-xs uppercase tracking-widest text-green-400">Live outcomes</span>
              <span className="ml-auto font-mono text-xs text-slate-400">updating every few seconds</span>
            </div>
            <div className="grid divide-y divide-slate-800/60 md:grid-cols-3 md:divide-x md:divide-y-0">
              {[
                {
                  icon: CheckCircle2,
                  tone: "accent",
                  status: "Done — nobody touched it",
                  value: "1,040",
                  unit: "in the last minute",
                  foot: "82.6% of everything",
                },
                {
                  icon: Clock,
                  tone: "primary",
                  status: "Your turn — reply is drafted",
                  value: "78",
                  unit: "waiting",
                  foot: "median wait 2m 11s",
                },
                {
                  icon: Target,
                  tone: "accent",
                  status: "Real buyer — sent to sales",
                  value: "128",
                  unit: "qualified",
                  foot: "₹42.8L pipeline added",
                },
              ].map((c) => (
                <div key={c.status} className="p-6">
                  <div className="flex items-center gap-2">
                    <c.icon className="h-4 w-4 text-green-400" />
                    <p className="text-sm font-medium text-white">{c.status}</p>
                  </div>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-4xl font-semibold tabular-nums tracking-tight">{c.value}</span>
                    <span className="text-sm text-slate-400">{c.unit}</span>
                  </div>
                  <span className="mt-3 inline-block rounded-full bg-green-400/10 px-2.5 py-1 text-xs font-medium text-green-400">
                    {c.foot}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Customers Section */}
      <section id="customers" className="relative border-t border-slate-800/60 py-24 lg:py-32">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
          <p className="text-center text-sm font-medium uppercase tracking-widest text-slate-400">
            Answering for teams at
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
            {["Trident Systems", "Padmini Décor", "VOC Automotive", "Skillfinity", "Rankzy", "Vertex Labs"].map((name) => (
              <span key={name} className="text-lg font-semibold tracking-tight text-slate-500">
                {name}
              </span>
            ))}
          </div>

          <div className="mt-16 grid gap-5 md:grid-cols-3">
            {[
              {
                company: "VOC Automotive",
                quote: "It refuses to invent discounts. When it doesn't know, it says so and pulls in a human — that alone rebuilt our trust in automation.",
              },
              {
                company: "Padmini Décor",
                quote: "Our CRM is finally correct, because nobody maintains it. Every conversation updates the record while it happens.",
              },
              {
                company: "Trident Systems",
                quote: "We stopped running a night shift. Mornings start with pipeline, not a backlog of missed messages.",
              },
            ].map((t) => (
              <figure key={t.company} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-7">
                <div className="flex gap-0.5 text-green-400">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <blockquote className="mt-4 leading-relaxed text-slate-200">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-5 text-sm font-medium text-slate-400">{t.company}</figcaption>
              </figure>
            ))}
          </div>

          <div className="mt-8 flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/60 px-4 py-1.5 text-xs font-medium text-slate-400">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
              Ninety days in, across 40 workspaces
            </span>
          </div>

          <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-slate-800 bg-slate-800 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { value: "82.6%", label: "of conversations closed without a human ever opening them" },
              { value: "2m 11s", label: "median wait for the ones that do need a person" },
              { value: "4.7 / 5", label: "CSAT across 2,140 ratings" },
              { value: "₹42.8L", label: "pipeline added from threads that used to be support tickets" },
            ].map((m) => (
              <div key={m.value} className="bg-slate-900/60 p-7">
                <p className="text-3xl font-semibold tracking-tight text-white">{m.value}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{m.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Platform Section */}
      <section id="platform" className="relative border-t border-slate-800/60 py-24 lg:py-32">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight lg:text-4xl">Inside the platform</h2>
            <p className="mt-3 text-lg text-slate-400">Five things that used to be five tools.</p>
          </div>

          <div className="mt-14 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
            <div className="grid gap-5 sm:grid-cols-2">
              {[
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
              ].map((p) => (
                <div key={p.title} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 hover:border-slate-700 transition-colors">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-800 bg-slate-950 text-blue-400">
                    <p.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold tracking-tight">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{p.copy}</p>
                </div>
              ))}
              <div className="hidden rounded-2xl border border-dashed border-slate-800 bg-transparent p-6 sm:block">
                <p className="text-sm leading-relaxed text-slate-400">
                  One record for every customer. One place for every team. Nothing to stitch together.
                </p>
              </div>
            </div>

            {/* Live inbox */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="mb-3 flex items-center gap-2 px-2 pt-1">
                <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                <span className="font-mono text-xs uppercase tracking-widest text-green-400">Live inbox</span>
              </div>
              <ul className="flex flex-col gap-2">
                {[
                  { name: "Ramesh", snippet: "Is the 5-ton unit in stock for Whitefield?", time: "02:14" },
                  { name: "Ananya", snippet: "Can I reschedule the site visit to Friday?", time: "08:47" },
                  { name: "Trident Systems", snippet: "Renewal quote for 40 seats please", time: "09:02" },
                  { name: "Divya", snippet: "Refund status for order #40118", time: "09:15" },
                  { name: "Karthik", snippet: "Do you integrate with Zoho?", time: "09:21" },
                ].map((item) => (
                  <li
                    key={item.name + item.time}
                    className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600/20 text-sm font-medium text-white">
                      {item.name.charAt(0)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium">{item.name}</p>
                        <span className="shrink-0 font-mono text-xs text-slate-400">{item.time}</span>
                      </div>
                      <p className="truncate text-sm text-slate-400">{item.snippet}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Story Section */}
      <section id="story" className="relative border-t border-slate-800/60 py-24 lg:py-32">
        <div className="mx-auto grid max-w-[1400px] gap-12 px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-12">
          {/* Left narrative */}
          <div>
            <h2 className="text-3xl font-semibold tracking-tight lg:text-4xl">
              One real thread, start to finish
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-slate-400">
              A WhatsApp message at 2:14 AM. By 9 it&apos;s a qualified opportunity sitting in front of the right
              rep — resolved where it could be, escalated where it mattered, and logged the whole way through.
            </p>

            <ol className="mt-10 space-y-6 border-l border-slate-800 pl-6">
              {[
                { time: "02:14", title: "It arrives", copy: "A WhatsApp message lands while your team is asleep." },
                { time: "02:14", title: "It's understood", copy: "The AI reads intent, history, and account in one pass." },
                { time: "02:15", title: "It's answered honestly", copy: "A correct reply goes out — no invented promises." },
                { time: "09:02", title: "It's waiting, not lost", copy: "The one decision left for a human is pinned and ready." },
              ].map((step) => (
                <li key={step.time + step.title} className="relative">
                  <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-green-400 bg-slate-950" />
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-sm text-green-400">{step.time}</span>
                    <span className="text-sm font-medium">{step.title}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-400">{step.copy}</p>
                </li>
              ))}
            </ol>
          </div>

          {/* Right conversation card */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="mb-4 flex items-center justify-between border-b border-slate-800/60 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600/20 text-sm font-medium">
                  R
                </span>
                <div>
                  <p className="text-sm font-medium">Ramesh</p>
                  <p className="font-mono text-xs text-slate-400">WhatsApp · +91 ••• 2140</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-green-400/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-green-400">
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
              <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3">
                <p className="text-xs font-medium text-white">Escalated to Sangeetha · Sales</p>
                <p className="mt-1 text-sm text-slate-400">
                  Draft reply prepared with AMC pricing. Waiting on rep confirmation — median wait 2m 11s.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Channels Section */}
      <section id="channels" className="relative border-t border-slate-800/60 py-24 lg:py-32">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight lg:text-4xl">Channels</h2>
            <p className="mt-3 text-lg text-slate-400">
              Wherever they message you, it&apos;s the same conversation.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { icon: MessageCircle, name: "WhatsApp", detail: "Official BSP · templates" },
              { icon: InstagramIcon, name: "Instagram", detail: "DMs · story replies" },
              { icon: MessagesSquare, name: "Messenger", detail: "Pages · comments" },
              { icon: Send, name: "Telegram", detail: "Bots · groups" },
              { icon: Globe, name: "Web chat", detail: "Embed · one script tag" },
              { icon: Mail, name: "Email", detail: "Shared inboxes" },
              { icon: Smartphone, name: "SMS", detail: "DLT registered" },
              { icon: Phone, name: "Voice", detail: "Real-time · 11 languages" },
              { icon: Video, name: "Video", detail: "Scheduled · recorded" },
              { icon: Plug, name: "Yours", detail: "API · bring a channel" },
            ].map((c) => (
              <div key={c.name} className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 hover:border-slate-700 transition-colors">
                <c.icon className="h-5 w-5 text-green-400" />
                <p className="mt-4 text-base font-medium">{c.name}</p>
                <p className="mt-1 text-xs text-slate-400">{c.detail}</p>
              </div>
            ))}
          </div>

          <div className="mt-14 rounded-2xl border border-slate-800 bg-slate-900/40 p-7">
            <p className="text-sm font-medium uppercase tracking-widest text-slate-400">
              Works with your stack
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              {["WhatsApp Business API", "Meta", "Shopify", "Razorpay", "Stripe", "Zoho CRM", "Salesforce", "HubSpot", "LeadSquared", "Google Workspace", "Microsoft 365", "Slack", "Zapier", "OpenAI", "Claude", "Gemini", "AWS", "Webhooks"].map((name) => (
                <span
                  key={name}
                  className="rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1.5 text-sm text-slate-300"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="relative border-t border-slate-800/60 py-24 lg:py-32">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight lg:text-4xl">FAQ</h2>
            <p className="mt-3 text-lg text-slate-400">Common questions about Lead Automation</p>
          </div>

          <div className="mt-12 max-w-3xl space-y-4">
            {[
              {
                q: "How does the AI know when to escalate?",
                a: "The AI is trained on your company's policies and past conversations. It recognizes patterns that require human intervention and escalates with full context attached.",
              },
              {
                q: "What channels do you support?",
                a: "We support WhatsApp, Instagram, Messenger, Telegram, Web chat, Email, SMS, Voice, and Video. You can also bring your own channel via our API.",
              },
              {
                q: "How long does it take to set up?",
                a: "Most teams are up and running within 2-3 hours. We handle the integration and provide training for your team.",
              },
              {
                q: "Is my data secure?",
                a: "Yes. We use enterprise-grade encryption, and your data is stored in secure databases. We're SOC 2 Type II compliant.",
              },
            ].map((faq, i) => (
              <div key={i} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                <div className="flex items-start gap-4">
                  <HelpCircle className="h-5 w-5 text-blue-400 mt-0.5 shrink-0" />
                  <div>
                    <h3 className="font-semibold">{faq.q}</h3>
                    <p className="mt-2 text-slate-400">{faq.a}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6">
        <div className="mx-auto max-w-[1400px] rounded-2xl border border-slate-800 bg-slate-900/50 p-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight">Ready to transform your customer engagement?</h2>
          <p className="mt-4 text-slate-400">Start your free trial today and see the difference AI can make.</p>
          <Link href="/login" className="mt-8 inline-flex items-center justify-center rounded-full bg-blue-600 px-8 py-3 text-base font-semibold text-white hover:bg-blue-700 transition-colors">
            Get Started Now
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-12 px-6">
        <div className="mx-auto max-w-[1400px] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 text-white">
              <Zap className="h-4 w-4" />
            </span>
            <span className="text-lg font-semibold tracking-tight">Lead Automation</span>
          </div>
          <p className="text-sm text-slate-400">© 2026 Electrobtech Innovations Pvt Ltd</p>
        </div>
      </footer>
    </main>
  );
}

function Bubble({ side, meta, children }) {
  const isOut = side === "out";
  return (
    <div className={`flex flex-col ${isOut ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isOut
            ? "rounded-br-sm bg-blue-600 text-white"
            : "rounded-bl-sm border border-slate-800 bg-slate-950 text-white"
        }`}
      >
        {children}
      </div>
      <span className="mt-1 font-mono text-[10px] text-slate-400">{meta}</span>
    </div>
  );
}
