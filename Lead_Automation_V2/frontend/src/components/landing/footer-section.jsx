import { Zap } from "lucide-react";

const footerLinks = {
  Platform: [
    { name: "Inbox", href: "#platform" },
    { name: "AI agents", href: "#platform" },
    { name: "Workflows", href: "#platform" },
    { name: "CRM", href: "#platform" },
    { name: "Campaigns", href: "#platform" },
  ],
  Build: [
    { name: "API reference", href: "#" },
    { name: "Webhooks", href: "#" },
    { name: "Integrations", href: "#channels" },
    { name: "Status", href: "#" },
    { name: "Changelog", href: "#" },
  ],
  Company: [
    { name: "About", href: "#" },
    { name: "Customers", href: "#customers" },
    { name: "Careers", href: "#" },
    { name: "Contact", href: "#" },
  ],
  Trust: [
    { name: "Security", href: "#" },
    { name: "Privacy", href: "#" },
    { name: "Terms", href: "#" },
    { name: "DPA", href: "#" },
    { name: "Subprocessors", href: "#" },
  ],
};

export function FooterSection() {
  return (
    <footer className="relative border-t border-border/60">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
        <div className="grid grid-cols-2 gap-12 py-16 md:grid-cols-6 lg:gap-8 lg:py-20">
          <div className="col-span-2">
            <a href="#" className="mb-5 inline-flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Zap className="h-4 w-4" />
              </span>
              <span className="text-lg font-semibold tracking-tight">Lead Forge</span>
            </a>
            <p className="max-w-xs text-pretty leading-relaxed text-muted-foreground">
              Lead Forge — an AI engagement platform by Electrobtech Innovations. Built in Bengaluru.
            </p>
          </div>

          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h3 className="mb-5 text-sm font-medium">{title}</h3>
              <ul className="space-y-3.5">
                {links.map((link) => (
                  <li key={link.name}>
                    <a
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-start justify-between gap-3 border-t border-border/60 py-8 md:flex-row md:items-center">
          <p className="text-sm text-muted-foreground">
            © 2026 Electrobtech Innovations Pvt. Ltd.
          </p>
          <p className="font-mono text-xs text-muted-foreground">
            SOC 2 Type II · ISO 27001 · Data resident in ap-south-1 · 99.98% uptime · 90d
          </p>
        </div>
      </div>
    </footer>
  );
}
