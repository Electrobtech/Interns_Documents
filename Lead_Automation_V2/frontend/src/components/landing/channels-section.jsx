import {
  MessageCircle,
  Instagram,
  MessagesSquare,
  Send,
  Globe,
  Mail,
  Smartphone,
  Phone,
  Video,
  Plug,
} from "lucide-react";

const channels = [
  { icon: MessageCircle, name: "WhatsApp", detail: "Official BSP · templates" },
  { icon: Instagram, name: "Instagram", detail: "DMs · story replies" },
  { icon: MessagesSquare, name: "Messenger", detail: "Pages · comments" },
  { icon: Send, name: "Telegram", detail: "Bots · groups" },
  { icon: Globe, name: "Web chat", detail: "Embed · one script tag" },
  { icon: Mail, name: "Email", detail: "Shared inboxes" },
  { icon: Smartphone, name: "SMS", detail: "DLT registered" },
  { icon: Phone, name: "Voice", detail: "Real-time · 11 languages" },
  { icon: Video, name: "Video", detail: "Scheduled · recorded" },
  { icon: Plug, name: "Yours", detail: "API · bring a channel" },
];

const integrations = [
  "WhatsApp Business API", "Meta", "Shopify", "Razorpay", "Stripe", "Zoho CRM", "Salesforce", "HubSpot",
  "LeadSquared", "Google Workspace", "Microsoft 365", "Slack", "Zapier", "OpenAI", "Claude", "Gemini",
  "AWS", "Webhooks",
];

export function ChannelsSection() {
  return (
    <section id="channels" className="relative border-t border-border/60 py-24 lg:py-32">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
        <div className="max-w-2xl">
          <h2 className="text-balance text-3xl font-semibold tracking-tight lg:text-4xl">Channels</h2>
          <p className="mt-3 text-lg text-muted-foreground">
            Wherever they message you, it&apos;s the same conversation.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {channels.map((c) => (
            <div key={c.name} className="hover-lift rounded-xl border border-border bg-card/60 p-5">
              <c.icon className="h-5 w-5 text-accent" />
              <p className="mt-4 text-base font-medium">{c.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{c.detail}</p>
            </div>
          ))}
        </div>

        <div className="mt-14 rounded-2xl border border-border bg-card/40 p-7">
          <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            Works with your stack
          </p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            {integrations.map((name) => (
              <span
                key={name}
                className="rounded-full border border-border bg-background/60 px-3 py-1.5 text-sm text-foreground/80"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
