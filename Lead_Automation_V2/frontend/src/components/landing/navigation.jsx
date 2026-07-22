"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Menu, X, Zap } from "lucide-react";

const navLinks = [
  { name: "Platform", href: "#platform" },
  { name: "How it works", href: "#story" },
  { name: "Channels", href: "#channels" },
  { name: "Customers", href: "#customers" },
];

export function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [routed, setRouted] = useState(412);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setRouted((prev) => 380 + Math.floor(Math.random() * 90));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      {/* Status ticker bar */}
      <div className="w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] items-center justify-center gap-3 px-6 py-2 lg:px-12">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-widest text-accent">
            <span className="live-dot h-1.5 w-1.5 rounded-full bg-accent" />
            Live
          </span>
          <p className="font-mono text-xs text-muted-foreground">
            <span className="text-foreground tabular-nums">{routed}</span> messages routed in the last minute
          </p>
        </div>
      </div>

      <nav
        className={`transition-colors duration-300 ${
          isScrolled || isMobileMenuOpen
            ? "border-b border-border/60 bg-background/85 backdrop-blur-xl"
            : "bg-transparent"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-6 lg:px-12">
          <a href="#" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Zap className="h-4 w-4" />
            </span>
            <span className="text-lg font-semibold tracking-tight">Lead Forge</span>
          </a>

          <div className="hidden items-center gap-10 md:flex">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="group relative text-sm text-foreground/70 transition-colors hover:text-foreground"
              >
                {link.name}
                <span className="absolute -bottom-1 left-0 h-px w-0 bg-accent transition-all duration-300 group-hover:w-full" />
              </a>
            ))}
          </div>

          <div className="hidden items-center gap-4 md:flex">
            <Link href="/login" className="text-sm text-foreground/70 transition-colors hover:text-foreground">
              Sign in
            </Link>
            <Button size="sm" className="rounded-full bg-primary px-5 text-primary-foreground hover:bg-primary/90">
              Book a demo
            </Button>
          </div>

          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 md:hidden"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <div
        className={`fixed inset-0 z-40 bg-background transition-opacity duration-300 md:hidden ${
          isMobileMenuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="flex h-full flex-col px-8 pb-8 pt-32">
          <div className="flex flex-1 flex-col justify-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-4xl font-semibold tracking-tight text-foreground"
              >
                {link.name}
              </a>
            ))}
          </div>
          <div className="flex gap-4 border-t border-border pt-8">
            <Link href="/login" onClick={() => setIsMobileMenuOpen(false)}>
              <Button variant="outline" className="h-14 flex-1 rounded-full text-base">
                Sign in
              </Button>
            </Link>
            <Button className="h-14 flex-1 rounded-full bg-primary text-base text-primary-foreground" onClick={() => setIsMobileMenuOpen(false)}>
              Book a demo
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
