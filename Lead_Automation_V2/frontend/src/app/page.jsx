'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence, useInView, useMotionValue, useSpring } from 'framer-motion';
import { 
  ArrowRight, Zap, Inbox, Bot, Workflow, Megaphone, Pin, 
  Headset, TrendingUp, CheckCircle2, Star, 
  MessageCircle, MessagesSquare, Send, 
  Globe, Mail, Smartphone, Phone, Video, Plug, HelpCircle, ChevronDown, 
  Shield, Cpu, BarChart3, AlertTriangle, Lock, UserCheck, 
  ScanSearch, Route, RefreshCw, LineChart, Linkedin, FileText, Upload, 
  Check, PlayCircle, Plus, Eye, Share2, Layers, Database
} from 'lucide-react';

/* ─── GSAP dynamic import helper ────────────────────────────────── */
let gsap, ScrollTrigger;

/* ─── Reusable Framer Motion scroll-reveal variants ─────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.65, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }
  })
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } }
};

/* ─── Social Media Icon Components ─────────────────────────────── */
function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  );
}

function SMSIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
    </svg>
  );
}

/* ─── Animated Counter Component ───────────────────────────────── */
function AnimatedCounter({ target, suffix = '', prefix = '' }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    const isFloat = String(target).includes('.');
    const end = parseFloat(target);
    const duration = 1800;
    const start = performance.now();
    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(isFloat ? (eased * end).toFixed(1) : Math.round(eased * end));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [isInView, target]);

  return <span ref={ref}>{prefix}{display}{suffix}</span>;
}

/* ─── Floating Particles Background ────────────────────────────── */
function FloatingParticles() {
  const particles = Array.from({ length: 18 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 4 + 2,
    delay: Math.random() * 4,
    duration: Math.random() * 6 + 6,
  }));
  return (
    <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-gradient-to-br from-orange-400/30 to-violet-500/20"
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size }}
          animate={{ y: [0, -30, 0], opacity: [0.2, 0.8, 0.2], scale: [1, 1.3, 1] }}
          transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

/* ─── Section Reveal Wrapper ────────────────────────────────────── */
function RevealSection({ children, className = '' }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={staggerContainer}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const FAQS = [
  { q: 'How long does setup actually take?', a: 'Most teams are live within a few minutes. Just connect your social, chat, or email channels, upload your product or pricing documents, and let the AI agents begin qualification. No complex migration required.' },
  { q: 'Does this replace our existing CRM?', a: 'No, ConnectSphere sits in front of your CRM (HubSpot, Salesforce, Zoho, etc.). It instantly captures, filters, and qualifies leads, then routes the qualified deals with full chat transcripts directly to your sales pipeline.' },
  { q: 'How does the AI handle voice calls?', a: 'Our Voice Agent uses real-time, ultra-low latency conversational AI to handle incoming queries, qualify callers, and dynamically schedule callbacks or hand off active calls to human agents.' },
  { q: 'Is my company data used to train public models?', a: 'Absolutely not. ConnectSphere uses secure, isolated vector databases for each organization. Your documents, logs, and customer conversations are encrypted at rest and in transit, and never leaked.' },
  { q: 'Can we define custom rules for routing?', a: 'Yes! The visual workflow builder lets you customize exact lead routing rules based on country, company size, budget intent, or any dynamic score generated by the AI Sales Agent.' }
];

/* ─── Hero Unified Inbox Simulation Component ──────────────────────── */
function HeroInboxPanel() {
  const threads = [
    {
      id: 'linkedin',
      name: 'Rohan M.',
      channel: 'LinkedIn',
      icon: <Linkedin className="w-3 h-3" />,
      avatarBg: 'bg-rose-600',
      time: '0:02 ago',
      score: '94/100',
      leadType: 'Hot Lead',
      msg: 'Looking for a lead engine for our 50-person team. Budget is ₹5L. Need WhatsApp + HubSpot sync.',
      reply: 'Hi Rohan! ConnectSphere handles WhatsApp qualification and HubSpot two-way sync natively. Based on your inputs, your lead score is 94/100 (Hot). Let\'s schedule a brief setup call!'
    },
    {
      id: 'whatsapp',
      name: 'Priya K.',
      channel: 'WhatsApp',
      icon: <MessageCircle className="w-3 h-3" />,
      avatarBg: 'bg-emerald-500',
      time: '0:15 ago',
      score: '88/100',
      leadType: 'Warm Lead',
      msg: 'Do you support multi-agent support inbox and custom vector DB ingestion for support guidelines?',
      reply: 'Hello Priya! Yes, our Support AI Agent uses isolated Vector DBs for RAG knowledge. Multiple human agents can co-manage the stream. Here is our setup guide.'
    },
    {
      id: 'instagram',
      name: 'Vikram S.',
      channel: 'Instagram',
      icon: <InstagramIcon className="w-3 h-3" />,
      avatarBg: 'bg-gradient-to-tr from-pink-500 to-violet-500',
      time: '1:04 ago',
      score: '92/100',
      leadType: 'Hot Lead',
      msg: 'Saw your Instagram story on flow automation. Can we trigger CRM deal creation from DM keywords?',
      reply: 'Hey Vikram! Absolutely. You can configure keyword triggers in the visual canvas to instantly create deals in HubSpot or Salesforce.'
    },
    {
      id: 'email',
      name: 'Sarah Chen',
      channel: 'Email',
      icon: <Mail className="w-3 h-3" />,
      avatarBg: 'bg-violet-600',
      time: '2:10 ago',
      score: '75/100',
      leadType: 'Nurture',
      msg: 'Requesting enterprise security documentation and SOC 2 compliance details for review.',
      reply: 'Hi Sarah, our SOC 2 Type II report and GDPR compliance documents are ready. I have attached the security pack to your thread.'
    }
  ];

  const [activeIdx, setActiveIdx] = useState(0);
  const [typedText, setTypedText] = useState('');
  const activeThread = threads[activeIdx];

  // Auto-cycle threads every 8 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % threads.length);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  // Simulate typing effect when active index changes
  useEffect(() => {
    setTypedText('');
    let idx = 0;
    const fullText = activeThread.reply;
    const timer = setInterval(() => {
      if (idx < fullText.length) {
        setTypedText((prev) => prev + fullText.charAt(idx));
        idx++;
      } else {
        clearInterval(timer);
      }
    }, 25);
    return () => clearInterval(timer);
  }, [activeIdx]);

  return (
    <div className="relative">
      {/* Background radial glow */}
      <div className="absolute -inset-4 rounded-[2.5rem] bg-gradient-to-tr from-violet-500/20 via-violet-500/10 to-amber-500/20 blur-2xl z-0 pointer-events-none" />
      
      {/* Inbox Panel Container */}
      <div className="relative rounded-3xl border border-white/10 bg-slate-950/80 backdrop-blur-xl shadow-2xl z-10 overflow-hidden text-white flex flex-col md:flex-row h-[480px]">
        
        {/* Left Side: Threads List */}
        <div className="w-full md:w-[220px] border-b md:border-b-0 md:border-r border-white/10 flex flex-col shrink-0 bg-slate-950/40">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">Live Inbox</span>
            </div>
            <span className="text-[10px] text-slate-500 font-bold bg-white/5 px-2 py-0.5 rounded">4 active</span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin">
            {threads.map((t, idx) => (
              <button
                key={t.id}
                onClick={() => setActiveIdx(idx)}
                className={`w-full text-left p-3 rounded-2xl flex items-start gap-2.5 transition-all duration-200 ${
                  activeIdx === idx
                    ? 'bg-white/10 border border-white/15 shadow-inner'
                    : 'hover:bg-white/5 border border-transparent'
                }`}
              >
                {/* Avatar with initial */}
                <div className={`h-8 w-8 rounded-full ${t.avatarBg} flex items-center justify-center font-bold text-xs shrink-0 text-white`}>
                  {t.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white truncate">{t.name}</span>
                    <span className="text-[9px] text-slate-500 font-semibold">{t.time}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[10px]">{t.icon}</span>
                    <p className="text-[10px] text-slate-400 truncate font-medium">{t.msg}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right Side: Conversation Thread */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-900/50">
          
          {/* Header */}
          <div className="p-4 border-b border-white/10 flex items-center justify-between bg-slate-950/20">
            <div className="flex items-center gap-3">
              <div className={`h-9 w-9 rounded-full ${activeThread.avatarBg} flex items-center justify-center font-bold text-sm text-white`}>
                {activeThread.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white">{activeThread.name}</span>
                  <span className="text-[9px] font-bold text-slate-400 bg-white/5 px-1.5 py-0.5 rounded">{activeThread.channel}</span>
                </div>
                <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  AI Agent Qualifying
                </span>
              </div>
            </div>

            {/* Score pill */}
            <div className="text-right">
              <span className="text-[9px] text-violet-300 font-bold uppercase tracking-wider block">Lead Score</span>
              <span className="inline-block text-sm font-black text-white px-2 py-0.5 rounded-lg bg-violet-500/20 border border-violet-500/30 mt-0.5">
                {activeThread.score}
              </span>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 font-sans text-xs">
            
            {/* Prospect message */}
            <div className="flex items-start gap-2.5 max-w-[85%]">
              <div className={`h-6 w-6 rounded-full ${activeThread.avatarBg} flex items-center justify-center font-bold text-[9px] shrink-0 text-white`}>
                {activeThread.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div className="rounded-2xl bg-white/5 border border-white/10 p-3 text-slate-200 font-medium leading-relaxed">
                {activeThread.msg}
              </div>
            </div>

            {/* AI Response message */}
            <div className="flex items-start gap-2.5 max-w-[85%] ml-auto justify-end">
              <div className="text-right">
                <div className="inline-block rounded-2xl bg-gradient-to-br from-violet-600 to-violet-800 p-3 text-white font-medium text-left leading-relaxed shadow-lg shadow-violet-900/20">
                  <div className="text-[9px] font-extrabold uppercase tracking-widest text-violet-300 mb-1 flex items-center gap-1">
                    ConnectSphere AI Agent
                  </div>
                  {typedText}
                  <span className="inline-block w-1.5 h-3.5 bg-violet-300 ml-0.5 animate-pulse" />
                </div>
                <span className="text-[9px] text-slate-500 font-bold mt-1 block">Auto-drafted · 2.1s delay</span>
              </div>
              <div className="h-6 w-6 rounded-full bg-violet-600 flex items-center justify-center shrink-0">
                <Bot className="h-3.5 w-3.5 text-white" />
              </div>
            </div>

          </div>

          {/* Bottom Actions */}
          <div className="p-4 border-t border-white/10 flex items-center justify-between bg-slate-950/20">
            <span className="text-[10px] text-slate-500 font-semibold flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-emerald-400" /> Auto-sync to CRM active
            </span>
            <div className="flex items-center gap-2">
              <button className="rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold px-3 py-1.5 text-[10px] transition-all">
                Edit Draft
              </button>
              <button className="rounded-xl bg-gradient-to-r from-rose-600 to-violet-600 text-white font-bold px-4 py-1.5 text-[10px] shadow-md shadow-violet-500/20 hover:shadow-violet-500/35 transition-all">
                Approve &amp; Send
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

/* ─── Step Flow — an auto-advancing stepper (Linear/Vercel-style) instead
   of three static cards side by side. A segmented progress bar drives which
   step is in focus; the content crossfades; each step gets its own small
   proof visual instead of a repeated icon tile. ─── */
const STEP_DURATION = 4200;
const STEP_DATA = [
  {
    kicker: 'Capture', title: 'Every message, one thread',
    copy: "WhatsApp, Instagram, email, voice — wherever they reach out, it lands in the same place. Nothing sits in a separate inbox waiting to be missed.",
    icon: Inbox, ring: 'from-emerald-500 to-teal-500', accent: '#34d399',
  },
  {
    kicker: 'Understand', title: 'The AI reads it and decides',
    copy: "Grounded in your own docs, not a guess — it answers what it actually knows, and hands off the moment it doesn't.",
    icon: Bot, ring: 'from-violet-500 to-fuchsia-500', accent: '#a78bfa',
  },
  {
    kicker: 'Sync', title: 'Your CRM, always current',
    copy: "Every reply writes back the instant it happens — no export, no end-of-day cleanup, no one babysitting a spreadsheet.",
    icon: Database, ring: 'from-rose-500 to-fuchsia-500', accent: '#f43f5e',
  },
];

function StepVisual({ index }) {
  if (index === 0) {
    return (
      <div className="relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-6">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Inbound, right now</p>
        <div className="flex flex-wrap gap-2 mb-5">
          {[
            { label: 'WhatsApp', icon: MessageCircle, tone: 'bg-emerald-500/15 text-emerald-300' },
            { label: 'Instagram', icon: InstagramIcon, tone: 'bg-pink-500/15 text-pink-300' },
            { label: 'Email', icon: Mail, tone: 'bg-violet-500/15 text-violet-300' },
          ].map((c) => (
            <motion.span key={c.label}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${c.tone}`}>
              <c.icon className="h-3.5 w-3.5" /> {c.label}
            </motion.span>
          ))}
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2.5">
          <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" /></span>
          <span className="text-xs font-bold text-emerald-300">One unified thread — no repeating themselves</span>
        </div>
      </div>
    );
  }
  if (index === 1) {
    return (
      <div className="relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-6">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">AI reasoning, live</p>
        <div className="space-y-2.5">
          {['Understood intent from the message', 'Checked your knowledge base', 'Drafted a grounded reply'].map((t, i) => (
            <motion.div key={t} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: i * 0.15 }}
              className="flex items-center gap-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20 px-3.5 py-2.5">
              <Check className="h-3.5 w-3.5 text-violet-300 shrink-0" />
              <span className="text-xs font-bold text-violet-100">{t}</span>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-6">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">CRM record</p>
      <div className="space-y-2 text-xs font-semibold">
        {[['Contact', 'Rohan Verma'], ['Stage', 'Qualified'], ['Last activity', 'Just now']].map(([k, v]) => (
          <div key={k} className="flex items-center justify-between border-b border-white/5 pb-2">
            <span className="text-slate-400">{k}</span>
            <span className="text-white">{v}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 px-3.5 py-2.5">
        <Check className="h-3.5 w-3.5 text-rose-300 shrink-0" />
        <span className="text-xs font-bold text-rose-200">Synced automatically — no export needed</span>
      </div>
    </div>
  );
}

function StepFlow() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setActive((a) => (a + 1) % STEP_DATA.length), STEP_DURATION);
    return () => clearTimeout(t);
  }, [active]);

  const s = STEP_DATA[active];

  return (
    <div className="relative">
      {/* segmented, auto-filling progress bar */}
      <div className="flex gap-2 mb-10">
        {STEP_DATA.map((step, i) => (
          <button key={i} onClick={() => setActive(i)} className="flex-1 group text-left">
            <div className="h-1 rounded-full bg-white/10 overflow-hidden mb-3">
              {i < active && <div className="h-full w-full rounded-full" style={{ background: step.accent }} />}
              {i === active && (
                <div key={active} className="h-full rounded-full animate-fill-bar" style={{ background: step.accent, animationDuration: `${STEP_DURATION}ms` }} />
              )}
            </div>
            <p className={`text-xs font-bold uppercase tracking-widest transition-colors ${i === active ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`}>
              {step.kicker}
            </p>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={active}
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="grid gap-10 md:grid-cols-2 items-center">
          <div>
            <div className={`inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${s.ring} shadow-lg mb-6`}>
              <s.icon className="h-7 w-7 text-white" />
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-white mb-3">{s.title}</h3>
            <p className="text-base text-slate-400 leading-relaxed max-w-md">{s.copy}</p>
          </div>
          <StepVisual index={active} />
        </motion.div>
      </AnimatePresence>

      <div className="mt-14 flex flex-wrap items-center justify-center gap-3">
        {[
          { name: 'WhatsApp', icon: MessageCircle }, { name: 'Instagram', icon: InstagramIcon }, { name: 'Messenger', icon: MessagesSquare },
          { name: 'Web chat', icon: Globe }, { name: 'Email', icon: Mail }, { name: 'SMS', icon: Smartphone }, { name: 'Voice', icon: Phone },
        ].map((ch) => (
          <span key={ch.name} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-slate-300">
            <ch.icon className="h-3.5 w-3.5" /> {ch.name}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Landing() {
  const [gsapReady, setGsapReady] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);

  // Interactive Lead Scoring State
  const [scoreOrgSize, setScoreOrgSize] = useState('medium'); // 'small', 'medium', 'enterprise'
  const [scoreBudget, setScoreBudget] = useState('high'); // 'low', 'medium', 'high'
  const [scoreChannel, setScoreChannel] = useState('linkedin'); // 'email', 'whatsapp', 'linkedin'
  const [calculatedScore, setCalculatedScore] = useState(85);

  // RAG Document Ingestion Simulator State
  const [uploadedFiles, setUploadedFiles] = useState([
    { name: 'product_guide_2026.pdf', size: '2.4 MB', status: 'ready', chunks: 142 },
    { name: 'pricing_q3_revised.csv', size: '410 KB', status: 'ready', chunks: 56 }
  ]);
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestionProgress, setIngestionProgress] = useState(0);
  const [newFileName, setNewFileName] = useState('');

  // Mouse Glow coordinates
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const navRef = useRef(null);
  const triggerRef = useRef(null);

  /* ── Load GSAP + plugins dynamically for SSR ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const gsapMod = await import('gsap');
      const stMod = await import('gsap/ScrollTrigger');
      gsap = gsapMod.gsap;
      ScrollTrigger = stMod.ScrollTrigger;
      gsap.registerPlugin(ScrollTrigger);
      if (!cancelled) setGsapReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  /* ── Cursor-reactive background effects ── */
  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  /* ── Trigger Scroll Reveal ── */
  useEffect(() => {
    if (!gsapReady) return;

    gsap.from(navRef.current, { y: -60, opacity: 0, duration: 0.8, ease: 'power3.out' });

    gsap.utils.toArray('.gsap-reveal').forEach((el) => {
      gsap.from(el, {
        scrollTrigger: { trigger: el, start: 'top 85%', once: true },
        y: 40, opacity: 0, duration: 0.8, ease: 'power3.out',
      });
    });

    gsap.utils.toArray('.gsap-card-reveal').forEach((el, idx) => {
      gsap.from(el, {
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        y: 35, opacity: 0, duration: 0.6, delay: idx * 0.08, ease: 'power3.out',
      });
    });

    return () => {
      if (ScrollTrigger) ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, [gsapReady]);

  /* ── Recalculate Lead Score dynamically based on selections ── */
  useEffect(() => {
    let base = 30;
    
    // Organization Size
    if (scoreOrgSize === 'small') base += 10;
    if (scoreOrgSize === 'medium') base += 25;
    if (scoreOrgSize === 'enterprise') base += 40;

    // Budget Intent
    if (scoreBudget === 'low') base += 5;
    if (scoreBudget === 'medium') base += 15;
    if (scoreBudget === 'high') base += 35;

    // Channel Fit
    if (scoreChannel === 'email') base += 10;
    if (scoreChannel === 'whatsapp') base += 15;
    if (scoreChannel === 'linkedin') base += 25;

    setCalculatedScore(Math.min(base, 100));
  }, [scoreOrgSize, scoreBudget, scoreChannel]);


  /* ── Handle Mock File Upload / Ingestion ── */
  const startFileIngestion = (e) => {
    e.preventDefault();
    if (!newFileName.trim() || isIngesting) return;
    
    setIsIngesting(true);
    setIngestionProgress(0);
    
    const interval = setInterval(() => {
      setIngestionProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setUploadedFiles(prevFiles => [
              {
                name: newFileName.endsWith('.pdf') || newFileName.endsWith('.docx') || newFileName.endsWith('.csv') ? newFileName : `${newFileName}.pdf`,
                size: '1.2 MB',
                status: 'ready',
                chunks: Math.floor(Math.random() * 80) + 20
              },
              ...prevFiles
            ]);
            setIsIngesting(false);
            setNewFileName('');
          }, 400);
          return 100;
        }
        return prev + 10;
      });
    }, 150);
  };

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#FAF8FC] text-slate-900 font-sans antialiased selection:bg-pink-100 selection:text-pink-900">
      
      {/* ── Ambient Background glows (Reactive to cursor) ── */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <div 
          className="absolute rounded-full w-[600px] h-[600px] bg-gradient-to-tr from-rose-400/10 to-violet-400/5 blur-[120px] transition-transform duration-700 ease-out"
          style={{ 
            transform: `translate(${mousePos.x * 0.05}px, ${mousePos.y * 0.05}px)`, 
            top: '5%', 
            left: '10%' 
          }} 
        />
        <div 
          className="absolute rounded-full w-[500px] h-[500px] bg-gradient-to-br from-violet-400/10 to-pink-400/5 blur-[120px] transition-transform duration-700 ease-out"
          style={{ 
            transform: `translate(${mousePos.x * -0.04}px, ${mousePos.y * -0.04}px)`, 
            top: '30%', 
            right: '5%' 
          }} 
        />
        <div 
          className="absolute rounded-full w-[700px] h-[700px] bg-gradient-to-tr from-fuchsia-400/10 to-rose-400/5 blur-[140px] transition-transform duration-700 ease-out"
          style={{ 
            transform: `translate(${mousePos.x * 0.03}px, ${mousePos.y * 0.03}px)`, 
            bottom: '15%', 
            left: '15%' 
          }} 
        />
      </div>

      {/* ─────────────────────────────────── NAVIGATION ─── */}
      <header ref={navRef} className="fixed top-0 left-0 right-0 z-50 border-b border-slate-200/50 bg-white/70 backdrop-blur-xl transition-all">
        <div className="mx-auto flex h-20 max-w-[1400px] items-center justify-between px-6 lg:px-12">
          
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <img src="/logo-full.png" alt="ConnectSphere Logo" className="h-16 md:h-20 object-contain transition-transform group-hover:scale-102" />
          </Link>

          {/* Nav Items */}
          <nav className="hidden items-center gap-8 md:flex">
            {[
              { label: 'How It Works', href: '#builder' },
              { label: 'Integrations', href: '#integrations' },
              { label: 'AI Agents', href: '#agents' },
              { label: 'Analytics', href: '#analytics' },
              { label: 'Compare', href: '#compare' },
              { label: 'FAQ', href: '#faq' }
            ].map((item) => (
              <a key={item.label} href={item.href}
                className="relative text-sm font-semibold text-slate-600 transition-colors hover:text-rose-600 group">
                {item.label}
                <span className="absolute -bottom-1 left-0 h-0.5 w-0 bg-gradient-to-r from-rose-500 to-fuchsia-500 transition-all duration-300 group-hover:w-full" />
              </a>
            ))}
          </nav>

          {/* Action buttons */}
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors">
              Sign In
            </Link>
            <Link href="/register" className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-violet-600 px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-rose-500/15 hover:shadow-rose-500/30 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150">
              Register
            </Link>
          </div>
        </div>
      </header>

      {/* ─────────────────────────────────── 1. HERO SECTION ─── */}
      <section className="relative pt-36 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        {/* Floating particles */}
        <FloatingParticles />
        {/* Subtle grid backdrop */}
        <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-[0.4] pointer-events-none" />

        <div className="relative z-10 mx-auto max-w-[1400px] px-6 lg:px-12">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] items-center">
            
            {/* Left Hero Content with Fade-In Animation */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="text-left space-y-6"
            >
              
              {/* Product Badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-rose-200/60 bg-rose-50/50 px-4 py-1.5 text-xs font-semibold text-rose-700 shadow-sm shadow-rose-50">
                <span className="flex h-2 w-2 rounded-full bg-rose-600 animate-pulse" />
                <span className="flex items-center gap-1">
                  Fully Omnichannel Lead Engine
                </span>
              </div>

              {/* Headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.05] tracking-tight text-slate-900">
                Every lead.{' '}
                <span className="bg-gradient-to-r from-rose-500 via-violet-600 to-fuchsia-500 bg-clip-text text-transparent">
                  Every channel.
                </span>{' '}
                Answered in seconds.
              </h1>

              {/* ── Channel Logo Strip ── */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3, ease: 'easeOut' }}
                className="flex flex-wrap items-center gap-3 pt-1"
              >
                {[
                  { label: 'WhatsApp', icon: <WhatsAppIcon /> },
                  { label: 'Instagram', icon: <InstagramIcon /> },
                  { label: 'Facebook', icon: <FacebookIcon /> },
                  { label: 'LinkedIn', icon: <LinkedInIcon /> },
                  { label: 'Email', icon: <EmailIcon /> },
                  { label: 'SMS', icon: <SMSIcon /> },
                  { label: 'Phone', icon: <PhoneIcon /> },
                ].map((ch, i) => (
                  <motion.div
                    key={ch.label}
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.35, delay: 0.4 + i * 0.07 }}
                    title={ch.label}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-slate-700 text-[11px] font-semibold border border-slate-200 bg-white shadow-sm cursor-default select-none hover:border-slate-300 hover:shadow-md transition-all"
                  >
                    <span className="text-slate-600">{ch.icon}</span>
                    <span className="hidden sm:inline">{ch.label}</span>
                  </motion.div>
                ))}
                <span className="text-slate-400 text-xs font-semibold">+ more</span>
              </motion.div>

              {/* ── CTAs ── */}
              <div className="flex flex-col sm:flex-row gap-4 pt-2">
                <Link href="/login" className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-violet-600 px-7 py-4 text-base font-bold text-white shadow-lg shadow-rose-500/20 hover:shadow-rose-500/35 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200">
                  Book Live Demo
                  <ArrowRight className="h-5 w-5" />
                </Link>
                <button className="group inline-flex items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white/80 backdrop-blur-md px-7 py-4 text-base font-bold text-slate-800 transition-all hover:bg-slate-50 hover:border-slate-300">
                  <PlayCircle className="h-5 w-5 text-violet-600 transition-transform group-hover:scale-110" />
                  See Video Demo
                </button>
              </div>

              {/* ── Trusted Integrations ── */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.85 }}
                className="pt-3 space-y-2"
              >
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Syncs with your stack</p>
                <div className="flex flex-wrap items-center gap-3">
                  {[
                    { name: 'HubSpot',     color: '#FF7A59', letter: 'H' },
                    { name: 'Salesforce',  color: '#00A1E0', letter: 'SF' },
                    { name: 'Zoho CRM',    color: '#E42527', letter: 'Z' },
                    { name: 'Slack',       color: '#4A154B', letter: 'S' },
                    { name: 'Twilio',      color: '#F22F46', letter: 'T' },
                    { name: 'Google Ads',  color: '#4285F4', letter: 'G' },
                  ].map((app, i) => (
                    <motion.div
                      key={app.name}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: 0.9 + i * 0.05 }}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-default"
                      title={app.name}
                    >
                      <span
                        className="flex h-5 w-5 items-center justify-center rounded text-white text-[9px] font-black shrink-0"
                        style={{ background: app.color }}
                      >
                        {app.letter}
                      </span>
                      <span className="text-[11px] font-bold text-slate-700">{app.name}</span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              {/* Trust/Rating stars */}
              <div className="flex items-center gap-6 pt-4 border-t border-slate-100 max-w-md">
                <div className="flex -space-x-2">
                  {['T', 'P', 'V', 'S'].map((lettr, idx) => (
                    <div key={idx} className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white shadow-sm"
                      style={{ background: ['#f43f5e', '#7c3aed', '#d946ef', '#0f172a'][idx] }}>
                      {lettr}
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex items-center gap-0.5">
                    {[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />)}
                    <span className="ml-2 text-sm font-bold text-slate-800">4.9/5 CSAT</span>
                  </div>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">Trusted by 60+ scale-stage revenue teams</p>
                </div>
              </div>

            </motion.div>

            {/* Right Hero Visual with Fade-In Animation */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, x: 30 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
              className="relative"
            >
              <HeroInboxPanel />
            </motion.div>

          </div>
        </div>
      </section>

      {/* ─────────────────────────────────── 2. THE SCATTERED LEAD PROBLEM ─── */}
      <section className="relative py-20 lg:py-28 bg-rose-50/60 border-y border-rose-100/60">
        <div className="mx-auto max-w-[1200px] px-6 lg:px-12">
          
          <RevealSection className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <motion.span variants={fadeUp} custom={0} className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 border border-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
              <AlertTriangle className="h-3.5 w-3.5" /> The Omnichannel Friction
            </motion.span>
            <motion.h2 variants={fadeUp} custom={1} className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight" style={{ fontFamily: 'Manrope, system-ui, sans-serif' }}>
              Leads scatter across 7 channels. Delayed replies kill conversion.
            </motion.h2>
            <motion.p variants={fadeUp} custom={2} className="text-base sm:text-lg text-slate-600 font-medium">
              If your team takes hours to hop between WhatsApp, LinkedIn, email, and social DMs, your competitor has already closed the lead. Speed-to-lead is the single biggest factor in pipeline conversion.
            </motion.p>
          </RevealSection>

          <RevealSection className="grid gap-8 md:grid-cols-3">
            {[
              { 
                stat: 9, suffix: 'x',
                label: 'Conversion Likelihood', 
                copy: 'When a prospect is contacted within 5 minutes versus later in the day. Instant answers prevent cold drops.', 
                color: 'text-rose-600', 
                border: 'border-rose-100' 
              },
              { 
                stat: 78, suffix: '%',
                label: 'Speed-to-Response Advantage', 
                copy: 'Of business buyers choose to work with the vendor that replies first — not the cheapest or biggest, just the fastest.', 
                color: 'text-violet-600', 
                border: 'border-violet-100' 
              },
              { 
                stat: 42, suffix: ' hrs',
                label: 'Average Manual Delay', 
                copy: 'Is the standard first-response delay when juggling manual tabs, scattered lead sources, and siloed chat channels.', 
                color: 'text-fuchsia-700', 
                border: 'border-fuchsia-100' 
              }
            ].map((item, i) => (
              <motion.div key={i} variants={fadeUp} custom={i} className="relative rounded-2xl border border-slate-200/60 bg-white p-8 shadow-sm hover:bg-violet-100 hover:border-violet-300 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                <span className={`text-4xl font-black ${item.color}`}><AnimatedCounter target={item.stat} suffix={item.suffix} /></span>
                <h3 className="mt-3 text-base font-bold text-slate-900">{item.label}</h3>
                <p className="mt-2 text-sm text-slate-500 leading-relaxed font-semibold">{item.copy}</p>
              </motion.div>
            ))}
          </RevealSection>

        </div>
      </section>

      {/* ─────────────────────────────────── 3. 7-CHANNEL INTEGRATION BENTO GRID ─── */}
      <section id="integrations" className="relative py-20 lg:py-32 overflow-hidden bg-orange-50/60 border-y border-orange-100/60">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
          
          <RevealSection className="text-center max-w-2xl mx-auto mb-8 space-y-4">
            <motion.span variants={fadeUp} custom={0} className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 border border-violet-100 px-3.5 py-1 text-xs font-semibold text-violet-700">
              <Layers className="h-3.5 w-3.5" /> Integration Ecosystem
            </motion.span>
            <motion.h2 variants={fadeUp} custom={1} className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight" style={{ fontFamily: 'Manrope, system-ui, sans-serif' }}>
              Wherever they reach out, it&apos;s a single pipeline
            </motion.h2>
            <motion.p variants={fadeUp} custom={2} className="text-base text-slate-600 font-medium">
              We connect your entire communication suite in one automation cockpit. No lost conversations, no siloed leads.
            </motion.p>
          </RevealSection>

          {/* Infinite Scroll Logo Ticker */}
          <div className="w-full overflow-hidden py-8 mb-16 border-y border-rose-100/60 bg-rose-50/40">
            <div className="flex w-[200%] animate-ticker select-none items-center gap-6">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="flex flex-1 justify-around items-center min-w-full shrink-0 gap-5">
                  {[
                    { label: 'WhatsApp Business', icon: MessageCircle, bg: 'bg-emerald-500', text: 'text-emerald-700', ring: 'ring-emerald-200' },
                    { label: 'Instagram DMs', icon: InstagramIcon, bg: 'bg-pink-500', text: 'text-pink-700', ring: 'ring-pink-200' },
                    { label: 'LinkedIn Forms', icon: Linkedin, bg: 'bg-blue-600', text: 'text-blue-700', ring: 'ring-blue-200' },
                    { label: 'Sales Email', icon: Mail, bg: 'bg-violet-500', text: 'text-violet-700', ring: 'ring-violet-200' },
                    { label: 'HubSpot CRM', icon: Plug, bg: 'bg-rose-500', text: 'text-rose-700', ring: 'ring-rose-200' },
                    { label: 'Salesforce', icon: Zap, bg: 'bg-cyan-500', text: 'text-cyan-700', ring: 'ring-cyan-200' },
                    { label: 'Slack Hubs', icon: MessageCircle, bg: 'bg-fuchsia-500', text: 'text-fuchsia-700', ring: 'ring-fuchsia-200' },
                    { label: 'Twilio Voice', icon: Phone, bg: 'bg-red-500', text: 'text-red-700', ring: 'ring-red-200' },
                  ].map((item) => (
                    <div key={item.label}
                      className={`flex items-center gap-2.5 bg-white rounded-2xl px-4 py-2.5 shadow-sm ring-1 ${item.ring} shrink-0`}>
                      <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${item.bg} text-white shadow-md`}>
                        <item.icon className="h-4 w-4" />
                      </span>
                      <span className={`font-extrabold uppercase tracking-wide text-sm md:text-base ${item.text}`}>
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <RevealSection className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            
            {/* WhatsApp */}
            <motion.div variants={fadeUp} custom={0} className="group relative rounded-2xl p-6 integration-card-lavender">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-md shadow-emerald-500/20">
                <WhatsAppIcon />
              </div>
              <h3 className="mt-5 text-base font-bold text-slate-900">WhatsApp Business API</h3>
              <p className="mt-2 text-xs font-medium text-slate-600 leading-relaxed">
                Connect official BSP templates, interactive quick-replies, catalog checkouts, and files direct in conversational flows.
              </p>
              <span className="mt-4 inline-block text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100/50 px-2 py-0.5 rounded">Active Sync</span>
            </motion.div>

            {/* LinkedIn */}
            <motion.div variants={fadeUp} custom={1} className="group relative rounded-2xl p-6 integration-card-lavender">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-blue-500 text-white shadow-md shadow-blue-500/20">
                <LinkedInIcon />
              </div>
              <h3 className="mt-5 text-base font-bold text-slate-900">LinkedIn Lead Gen</h3>
              <p className="mt-2 text-xs font-medium text-slate-600 leading-relaxed">
                Real-time webhook sync captures B2B leads from Sponsored Forms, instantly routing details to qualification threads.
              </p>
              <span className="mt-4 inline-block text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-100/50 px-2 py-0.5 rounded">Form Trigger</span>
            </motion.div>

            {/* Instagram */}
            <motion.div variants={fadeUp} custom={2} className="group relative rounded-2xl p-6 integration-card-lavender">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-pink-500 via-rose-500 to-orange-400 text-white shadow-md shadow-pink-500/20">
                <InstagramIcon />
              </div>
              <h3 className="mt-5 text-base font-bold text-slate-900">Instagram DMs & Mentions</h3>
              <p className="mt-2 text-xs font-medium text-slate-600 leading-relaxed">
                Trigger conversational qualification on story mentions, comments, direct DMs, and shopping checkouts.
              </p>
              <span className="mt-4 inline-block text-[10px] font-bold text-violet-700 bg-violet-50 border border-violet-100/50 px-2 py-0.5 rounded">Keyword Trigger</span>
            </motion.div>

            {/* Facebook */}
            <motion.div variants={fadeUp} custom={3} className="group relative rounded-2xl p-6 integration-card-lavender">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-blue-400 text-white shadow-md shadow-blue-600/20">
                <FacebookIcon />
              </div>
              <h3 className="mt-5 text-base font-bold text-slate-900">Facebook Messenger</h3>
              <p className="mt-2 text-xs font-medium text-slate-600 leading-relaxed">
                Auto-reply to post comments, capture page ad click-to-messenger leads, and manage inbox streams concurrently.
              </p>
              <span className="mt-4 inline-block text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-100/50 px-2 py-0.5 rounded">Messenger Hook</span>
            </motion.div>

            {/* Email */}
            <motion.div variants={fadeUp} custom={4} className="group relative rounded-2xl p-6 integration-card-lavender">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-red-500 to-red-400 text-white shadow-md shadow-red-500/20">
                <EmailIcon />
              </div>
              <h3 className="mt-5 text-base font-bold text-slate-900">Shared Email Inbox</h3>
              <p className="mt-2 text-xs font-medium text-slate-600 leading-relaxed">
                Parse incoming support/sales emails, formulate custom structured drafts using context files, and trigger mail drops.
              </p>
              <span className="mt-4 inline-block text-[10px] font-bold text-violet-700 bg-violet-50 border border-violet-100/50 px-2 py-0.5 rounded">SMTP & IMAP</span>
            </motion.div>

            {/* SMS */}
            <motion.div variants={fadeUp} custom={5} className="group relative rounded-2xl p-6 integration-card-lavender">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-500/20">
                <SMSIcon />
              </div>
              <h3 className="mt-5 text-base font-bold text-slate-900">SMS / RCS Channels</h3>
              <p className="mt-2 text-xs font-medium text-slate-600 leading-relaxed">
                Trigger DLT-compliant transaction alerts, quick broadcast updates, and backup notification delivery.
              </p>
              <span className="mt-4 inline-block text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-100/50 px-2 py-0.5 rounded">99.8% Open Rate</span>
            </motion.div>

            {/* Voice Calls */}
            <motion.div variants={fadeUp} custom={6} className="group relative rounded-2xl p-6 integration-card-lavender">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 to-purple-500 text-white shadow-md shadow-violet-500/20">
                <PhoneIcon />
              </div>
              <h3 className="mt-5 text-base font-bold text-slate-900">Voice Agents (IVR)</h3>
              <p className="mt-2 text-xs font-medium text-slate-600 leading-relaxed">
                Trigger AI outbound validation calls, connect inbound IVR queries, and direct transfers to human phones.
              </p>
              <span className="mt-4 inline-block text-[10px] font-bold text-fuchsia-700 bg-fuchsia-50 border border-fuchsia-100/50 px-2 py-0.5 rounded">SIP & WebRTC</span>
            </motion.div>

            {/* Custom CRM (Hubspot/Salesforce) */}
            <motion.div variants={fadeUp} custom={7} className="group relative rounded-2xl p-6 integration-card-lavender">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-rose-500 via-violet-600 to-fuchsia-500 text-white shadow-md">
                <Plug className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-base font-bold text-slate-900">CRMs & Core Apps</h3>
              <p className="mt-2 text-xs font-medium text-slate-600 leading-relaxed">
                Bi-directional automated sync with HubSpot, Salesforce, Zoho CRM, Slack, and customizable webhook APIs.
              </p>
              <span className="mt-4 inline-block text-[10px] font-bold text-violet-700 bg-violet-50 border border-violet-100/50 px-2 py-0.5 rounded">Full Two-Way Sync</span>
            </motion.div>

          </RevealSection>

        </div>
      </section>

      {/* ─────────────────────────────────── 4. INTERACTIVE WORKFLOW BUILDER ─── */}
      <section id="builder" className="relative py-24 lg:py-32 overflow-hidden" style={{ background: 'linear-gradient(135deg, #0a0520 0%, #130d3a 40%, #0d1f4a 100%)' }}>
        {/* Dot grid backdrop */}
        <div className="absolute inset-0 z-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(99,102,241,0.15) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        {/* Glow orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-violet-600/10 blur-3xl z-0 pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-rose-500/10 blur-3xl z-0 pointer-events-none" />

        <div className="relative z-10 mx-auto max-w-[1400px] px-6 lg:px-12">
          
          {/* Section header */}
          <div className="gsap-reveal text-center max-w-3xl mx-auto mb-16 space-y-4">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 text-xs font-bold text-violet-300 backdrop-blur-sm">
              <Workflow className="h-3.5 w-3.5" /> See It In Action
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight" style={{ fontFamily: 'Manrope, system-ui, sans-serif' }}>
              One canvas. Zero code.{' '}
              <span style={{ background: 'linear-gradient(90deg, #c4b5fd, #fda4af)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Complete automation.
              </span>
            </h2>
            <p className="text-base text-slate-400 font-medium max-w-xl mx-auto">
              Every channel funnels into one AI layer, and every reply writes straight back to your CRM — nothing hand-wired, nothing to keep in sync yourself.
            </p>
          </div>

          <StepFlow />

        </div>
      </section>


      {/* ─────────────────────────────────── 5. THE THREE-AGENT SHOWCASE ─── */}
      <section id="agents" className="relative py-20 lg:py-32">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
          
          <RevealSection className="text-center max-w-2xl mx-auto mb-16 space-y-4">
            <motion.span variants={fadeUp} custom={0} className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 border border-violet-100 px-3.5 py-1 text-xs font-semibold text-violet-700">
              <Bot className="h-3.5 w-3.5" /> Dedicated AI Agents
            </motion.span>
            <motion.h2 variants={fadeUp} custom={1} className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight" style={{ fontFamily: 'Manrope, system-ui, sans-serif' }}>
              Three agents. One unified lifecycle.
            </motion.h2>
            <motion.p variants={fadeUp} custom={2} className="text-base text-slate-600 font-medium">
              We divide execution roles between three specialized agents, ensuring leads are attracted, qualified, and retained efficiently.
            </motion.p>
          </RevealSection>

          <RevealSection className="grid gap-8 lg:grid-cols-3">
            
            {/* Marketing Agent Card */}
            <motion.div variants={fadeUp} custom={0} className="relative rounded-3xl border border-slate-200/80 bg-white p-8 shadow-sm hover:bg-violet-100 hover:border-violet-300 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-rose-500 to-fuchsia-500 text-white shadow-md shadow-rose-500/20">
                <Megaphone className="h-6 w-6" />
              </div>
              <h3 className="mt-6 text-xl font-bold text-slate-900">Marketing AI Agent</h3>
              <p className="mt-1 font-mono text-[10px] text-rose-600 uppercase font-extrabold tracking-wide">Attracts &amp; Nurtures</p>
              <p className="mt-3 text-sm text-slate-500 leading-relaxed font-semibold">
                Monitors campaigns, answers incoming queries from social channels using approved product guidelines, and triggers drip schedules to revive inactive cold leads.
              </p>

              {/* Marketing Mock Widget inside bento */}
              <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Campaign Broadcast Simulator</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>Insta Story Broadcast</span>
                    <span className="text-rose-600">Active</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill bg-rose-600" style={{ width: '70%' }} />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold">
                    <span>942 Contacts</span>
                    <span>32.8% Conversion</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Sales Agent Card (With interactive Lead Scorer) */}
            <motion.div variants={fadeUp} custom={1} className="relative rounded-3xl border border-slate-200/80 bg-white p-8 shadow-sm hover:bg-violet-100 hover:border-violet-300 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 to-violet-500 text-white shadow-md shadow-violet-500/20">
                <TrendingUp className="h-6 w-6" />
              </div>
              <h3 className="mt-6 text-xl font-bold text-slate-900">Sales AI Agent</h3>
              <p className="mt-1 font-mono text-[10px] text-violet-600 uppercase font-extrabold tracking-wide">Qualifies &amp; Routes</p>
              <p className="mt-3 text-sm text-slate-500 leading-relaxed font-semibold">
                Evaluates user intent and matches lead profiles against custom parameters. Scores leads automatically and triggers live alerts or CRM routes.
              </p>

              {/* Dynamic Lead Scoring Widget */}
              <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Live Score Calculator</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    calculatedScore >= 75 ? 'bg-emerald-50 text-emerald-600' : 'bg-fuchsia-50 text-fuchsia-600'
                  }`}>
                    {calculatedScore >= 75 ? 'Hot Lead' : 'Warm Lead'}
                  </span>
                </div>

                <div className="space-y-2.5 text-[10px] font-bold">
                  {/* Size toggles */}
                  <div>
                    <span className="text-[8px] text-slate-400 block mb-1">Org Size</span>
                    <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg">
                      {[
                        { val: 'small', label: '1-50' },
                        { val: 'medium', label: '50-500' },
                        { val: 'enterprise', label: '500+' }
                      ].map(opt => (
                        <button
                          key={opt.val}
                          type="button"
                          onClick={() => setScoreOrgSize(opt.val)}
                          className={`flex-1 py-1 text-[8.5px] rounded-md transition-all ${
                            scoreOrgSize === opt.val
                              ? 'bg-white text-violet-600 shadow-sm'
                              : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Budget toggles */}
                  <div>
                    <span className="text-[8px] text-slate-400 block mb-1">Budget</span>
                    <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg">
                      {[
                        { val: 'low', label: '<$5k' },
                        { val: 'medium', label: '$5k-$20k' },
                        { val: 'high', label: '$20k+' }
                      ].map(opt => (
                        <button
                          key={opt.val}
                          type="button"
                          onClick={() => setScoreBudget(opt.val)}
                          className={`flex-1 py-1 text-[8.5px] rounded-md transition-all ${
                            scoreBudget === opt.val
                              ? 'bg-white text-violet-600 shadow-sm'
                              : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Channel toggles */}
                  <div>
                    <span className="text-[8px] text-slate-400 block mb-1">Channel</span>
                    <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg">
                      {[
                        { val: 'email', label: 'Email' },
                        { val: 'whatsapp', label: 'WhatsApp' },
                        { val: 'linkedin', label: 'LinkedIn' }
                      ].map(opt => (
                        <button
                          key={opt.val}
                          type="button"
                          onClick={() => setScoreChannel(opt.val)}
                          className={`flex-1 py-1 text-[8.5px] rounded-md transition-all ${
                            scoreChannel === opt.val
                              ? 'bg-white text-violet-600 shadow-sm'
                              : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Score bar display */}
                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>AI Fit Score</span>
                    <span>{calculatedScore}/100</span>
                  </div>
                  <div className="progress-bar">
                    <div 
                      className="progress-fill bg-gradient-to-r from-violet-500 to-violet-500 transition-all duration-300" 
                      style={{ width: `${calculatedScore}%` }} 
                    />
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Support Agent Card */}
            <motion.div variants={fadeUp} custom={2} className="relative rounded-3xl border border-slate-200/80 bg-white p-8 shadow-sm hover:bg-violet-100 hover:border-violet-300 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between">
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-fuchsia-600 to-teal-400 text-white shadow-md shadow-fuchsia-500/20">
                  <Headset className="h-6 w-6" />
                </div>
                <h3 className="mt-6 text-xl font-bold text-slate-900">Support AI Agent</h3>
                <p className="mt-1 font-mono text-[10px] text-fuchsia-600 uppercase font-extrabold tracking-wide">Retains &amp; Cites</p>
                <p className="mt-3 text-sm text-slate-500 leading-relaxed font-semibold">
                  Handles post-sale inquiries, searches vector store libraries for product queries, and triggers manual team redirects if it detects unhappy customer sentiment.
                </p>
              </div>

              {/* Support mockup widget */}
              <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Live Escalation Threshold</p>
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-600">Customer Sentiment</span>
                  <span className="text-red-500 font-bold">Negative</span>
                </div>
                <div className="p-2 rounded bg-red-50 border border-red-100 text-[10px] text-red-700 font-bold flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5 shrink-0" />
                  Escalating conversation &amp; routing history to support team
                </div>
              </div>
            </motion.div>

          </RevealSection>

        </div>
      </section>

      {/* ─────────────────────────────────── 6. RAG KNOWLEDGE BASE SIMULATOR ─── */}
      <section className="relative py-20 lg:py-28 bg-rose-50/50 border-y border-rose-100/60">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
          
          <div className="grid gap-12 lg:grid-cols-[0.45fr_0.55fr] items-center">
            
            {/* Text description - slides in from left */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-6"
            >
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 border border-rose-100 px-3.5 py-1 text-xs font-semibold text-rose-700">
                <Database className="h-3.5 w-3.5" /> Retrieval-Augmented Generation (RAG)
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight" style={{ fontFamily: 'Manrope, system-ui, sans-serif' }}>
                Grounded in your company docs. No hallucinations.
              </h2>
              <p className="text-base text-slate-600 font-medium">
                Upload your product guides, FAQs, AMC rules, or pricing sheets. Our RAG engine extracts the details, builds structured embeddings, and limits the AI to answering solely from what you document.
              </p>

              <div className="space-y-3 pt-2">
                {[
                  'Supports PDF, CSV, Word, and Excel formats.',
                  'Auto-chunking algorithm creates vector records dynamically.',
                  'Gives citations in agent replies for human auditing.'
                ].map((point, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.2 + i * 0.1, ease: 'easeOut' }}
                    className="flex items-start gap-3"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600 mt-0.5">
                      <Check className="h-3 w-3" />
                    </span>
                    <p className="text-sm font-semibold text-slate-700">{point}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Document Uploader Simulator - slides in from right */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
              className="border border-slate-200/80 bg-white rounded-3xl p-6 shadow-sm hover:bg-violet-100 hover:border-violet-300 hover:shadow-xl transition-all duration-300"
            >
              <div className="mb-4 border-b border-slate-100 pb-3 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">Knowledge Ingestion panel</span>
                <span className="text-[10px] text-slate-400 font-semibold">Database collections</span>
              </div>

              {/* Upload Input form */}
              <form onSubmit={startFileIngestion} className="space-y-3">
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Enter document name (e.g. refund_policy.pdf)" 
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                    disabled={isIngesting}
                    className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs outline-none focus:border-rose-500 font-semibold"
                  />
                  <button 
                    type="submit"
                    disabled={!newFileName.trim() || isIngesting}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4 py-2.5 disabled:opacity-50 transition-colors"
                  >
                    <Upload className="h-3.5 w-3.5" /> Upload
                  </button>
                </div>
              </form>

              {/* Ingestion loader */}
              {isIngesting && (
                <div className="mt-4 p-4 rounded-xl border border-rose-100 bg-rose-50/50 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-rose-700">
                    <span className="flex items-center gap-1.5">
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Chunking and vectorizing: {newFileName}
                    </span>
                    <span>{ingestionProgress}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-rose-600 transition-all duration-100" style={{ width: `${ingestionProgress}%` }} />
                  </div>
                </div>
              )}

              {/* File list */}
              <div className="mt-4 space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Ingested Documents</p>
                <div className="space-y-2 max-h-[180px] overflow-y-auto">
                  {uploadedFiles.map((file, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: idx * 0.08 }}
                      className="flex items-center justify-between p-3 border border-slate-100 bg-slate-50/50 rounded-xl"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-rose-600" />
                        <div>
                          <p className="text-xs font-bold text-slate-800">{file.name}</p>
                          <p className="text-[9px] text-slate-400 font-semibold">{file.size} · {file.chunks} vector chunks</p>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                        <Check className="h-3 w-3" /> Ready
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>

            </motion.div>

          </div>

        </div>
      </section>

      {/* ─────────────────────────────────── 7. LIVE CONVERSATION WALKTHROUGH ─── */}
      <section className="relative py-20 lg:py-28 overflow-hidden">
        <div className="mx-auto max-w-[1200px] px-6 lg:px-12">
          
          <RevealSection className="text-center max-w-2xl mx-auto mb-16 space-y-4">
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight" style={{ fontFamily: 'Manrope, system-ui, sans-serif' }}>
              Watch a lead convert in one dynamic thread
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-base text-slate-600 font-medium">
              From an ad form click in the middle of the night to a booked slot and synced CRM record, let&apos;s follow Rohan&apos;s lead profile.
            </motion.p>
          </RevealSection>

          <div className="grid gap-12 lg:grid-cols-[0.5fr_0.5fr] items-center">
            
            {/* Timeline Steps */}
            <div className="relative">
              <div className="absolute left-6 top-3 bottom-3 w-0.5 bg-gradient-to-b from-rose-600 via-violet-400 to-fuchsia-500" />
              
              <div className="space-y-8">
                
                {/* Timeline Step 1 */}
                <div className="gsap-card-reveal relative pl-12 flex gap-4">
                  <span className="absolute left-3.5 -translate-x-1/2 flex h-6 w-6 items-center justify-center rounded-full bg-rose-600 text-white font-mono text-[10px] font-bold shadow-md">
                    1
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-rose-600">02:14 AM</span>
                      <h4 className="text-sm font-bold text-slate-800">LinkedIn Capture</h4>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                      Rohan clicks a sponsored ad and submits a form request. The LinkedIn webhook instantly registers the lead profile.
                    </p>
                  </div>
                </div>

                {/* Timeline Step 2 */}
                <div className="gsap-card-reveal relative pl-12 flex gap-4">
                  <span className="absolute left-3.5 -translate-x-1/2 flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-white font-mono text-[10px] font-bold shadow-md">
                    2
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-violet-600">02:15 AM</span>
                      <h4 className="text-sm font-bold text-slate-800">Instant WhatsApp Qualification</h4>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                      AI triggers a WhatsApp template message. Rohan answers, qualifying his budget intent and installation schedule.
                    </p>
                  </div>
                </div>

                {/* Timeline Step 3 */}
                <div className="gsap-card-reveal relative pl-12 flex gap-4">
                  <span className="absolute left-3.5 -translate-x-1/2 flex h-6 w-6 items-center justify-center rounded-full bg-fuchsia-500 text-white font-mono text-[10px] font-bold shadow-md">
                    3
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-fuchsia-600">02:18 AM</span>
                      <h4 className="text-sm font-bold text-slate-800">Automatic Slot Booking</h4>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                      Rohan chooses a provisional slot from a self-service list. An SMS and email confirm the appointment automatically.
                    </p>
                  </div>
                </div>

                {/* Timeline Step 4 */}
                <div className="gsap-card-reveal relative pl-12 flex gap-4">
                  <span className="absolute left-3.5 -translate-x-1/2 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-white font-mono text-[10px] font-bold shadow-md">
                    4
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-700">09:00 AM</span>
                      <h4 className="text-sm font-bold text-slate-800">Clean CRM Sync</h4>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                      Sriram (Sales rep) opens HubSpot. The deal is created with full transcripts attached, ready to close.
                    </p>
                  </div>
                </div>

              </div>
            </div>

            {/* Chat Thread Panel Mockup */}
            <div className="border border-slate-200 bg-white rounded-3xl p-6 shadow-sm relative">
              
              <div className="mb-4 border-b border-slate-100 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-tr from-rose-500 to-violet-500 text-white font-bold text-[10px]">
                    R
                  </span>
                  <div>
                    <p className="text-xs font-bold text-slate-800">Rohan M. (Lead)</p>
                    <p className="text-[9px] text-slate-400 font-semibold">LinkedIn Lead &gt; WhatsApp Thread</p>
                  </div>
                </div>
                <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded uppercase tracking-wider">Qualified</span>
              </div>

              {/* Chat bubbles */}
              <div className="space-y-4 min-h-[220px]">
                
                {/* Bubble In */}
                <div className="flex flex-col items-start space-y-1">
                  <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-slate-100 p-3 text-xs text-slate-800 leading-relaxed font-semibold">
                    Submitted Form details: ROHAN METALS INC. Budget range $20k+. Need install slots.
                  </div>
                  <span className="text-[9px] text-slate-400 font-mono">02:14 AM · LinkedIn API</span>
                </div>

                {/* Bubble Out */}
                <div className="flex flex-col items-end space-y-1">
                  <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-gradient-to-tr from-rose-500 to-violet-600 p-3 text-xs text-white leading-relaxed">
                    Hi Rohan! Received your request from LinkedIn. Our slots are open Thu &amp; Fri. Do you want to provisionally hold Friday afternoon?
                  </div>
                  <span className="text-[9px] text-slate-400 font-mono">02:15 AM · Sales Agent</span>
                </div>

                {/* Bubble In */}
                <div className="flex flex-col items-start space-y-1">
                  <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-slate-100 p-3 text-xs text-slate-800 leading-relaxed font-semibold">
                    Yes, Friday afternoon works. Please confirm slot and final quote with AMC.
                  </div>
                  <span className="text-[9px] text-slate-400 font-mono">02:18 AM · WhatsApp Inbound</span>
                </div>

                {/* Automation Banner */}
                <div className="p-3 border border-violet-100 bg-violet-50/50 rounded-xl flex items-center justify-between text-xs font-bold text-slate-800">
                  <div className="flex items-center gap-2">
                    <Plug className="h-4 w-4 text-violet-600" />
                    <span>HubSpot CRM Updated</span>
                  </div>
                  <span className="text-[10px] text-violet-600 bg-white px-2 py-0.5 rounded shadow-sm border border-slate-100">transcripts attached</span>
                </div>

              </div>

            </div>

          </div>

        </div>
      </section>

      {/* ─────────────────────────────────── 8. ANALYTICS DASHBOARD ─── */}
      <section id="analytics" className="relative py-20 lg:py-32 bg-rose-50/50 border-y border-rose-100/60">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
          
          <div className="gsap-reveal text-center max-w-2xl mx-auto mb-16 space-y-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 border border-violet-100 px-3.5 py-1 text-xs font-semibold text-violet-700">
              <BarChart3 className="h-3.5 w-3.5" /> Performance &amp; ROI
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight" style={{ fontFamily: 'Manrope, system-ui, sans-serif' }}>
              Analyze your funnel impacts in real time
            </h2>
            <p className="text-base text-slate-600 font-medium">
              Watch speed metrics improve and see pipeline additions mapped directly to AI interactions.
            </p>
          </div>

          <RevealSection className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
            {[
              { label: 'Conversations Autopiloted', num: 82.6, suffix: '%', change: '+12.4%', foot: 'No human touch required' },
              { label: 'Median Response Time', num: 3, suffix: 's', change: '-99%', foot: 'Down from 42 hours manual' },
              { label: 'CSAT Average', num: 4.8, suffix: '/5', change: '+8%', foot: 'Across 2,400+ reviews' },
              { label: 'Pipeline Generated', prefix: '₹', num: 42.8, suffix: 'L', change: '+35%', foot: 'From qualified leads' }
            ].map((stat, i) => (
              <motion.div key={i} variants={fadeUp} custom={i} className="relative rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm hover:bg-violet-100 hover:border-violet-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 text-center md:text-left">
                {/* Live green dot */}
                <span className="absolute top-4 right-4 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{stat.label}</p>
                <div className="mt-3 flex items-baseline justify-center md:justify-start gap-2">
                  <span className="text-3xl font-black text-slate-900">
                    <AnimatedCounter target={stat.num} suffix={stat.suffix} prefix={stat.prefix || ''} />
                  </span>
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">{stat.change}</span>
                </div>
                <p className="text-xs text-slate-400 font-semibold mt-3 pt-3 border-t border-slate-50">{stat.foot}</p>
              </motion.div>
            ))}
          </RevealSection>

          {/* Three analytics charts — real lead-automation metrics, not generic filler */}
          <div className="mt-6 grid gap-6 lg:grid-cols-3">

            {/* Bar chart 1: leads captured, by channel */}
            <div className="gsap-reveal rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm hover:bg-violet-100 hover:border-violet-300 hover:shadow-md transition-all duration-300">
              <h3 className="text-base font-bold text-slate-800">Leads Captured by Channel</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5 mb-6">Last 30 days, across every connected inbox.</p>
              <div className="flex items-end justify-between gap-3 h-48">
                {[
                  { label: 'WhatsApp', value: 148, color: 'from-emerald-500 to-teal-400' },
                  { label: 'Email', value: 44, color: 'from-violet-500 to-fuchsia-400' },
                  { label: 'Web chat', value: 79, color: 'from-rose-500 to-fuchsia-400' },
                  { label: 'Instagram', value: 61, color: 'from-pink-500 to-rose-400' },
                  { label: 'Messenger', value: 34, color: 'from-blue-500 to-cyan-400' },
                  { label: 'SMS', value: 18, color: 'from-fuchsia-500 to-rose-300' },
                  { label: 'Voice', value: 11, color: 'from-cyan-500 to-teal-400' },
                ].map((b) => (
                  <div key={b.label} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                    <span className="text-xs font-bold text-slate-700 tabular-nums">{b.value}</span>
                    <motion.div
                      initial={{ height: 0 }}
                      whileInView={{ height: `${(b.value / 148) * 100}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                      className={`w-full max-w-[34px] rounded-t-lg bg-gradient-to-t ${b.color}`}
                    />
                    <span className="text-[10px] font-bold text-slate-400 text-center leading-tight">{b.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bar chart 2: lead qualification funnel */}
            <div className="gsap-reveal rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm hover:bg-violet-100 hover:border-violet-300 hover:shadow-md transition-all duration-300">
              <h3 className="text-base font-bold text-slate-800">Lead Qualification Funnel</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5 mb-6">Where inbound conversations end up, AI-scored end to end.</p>
              <div className="space-y-4">
                {[
                  { label: 'New conversations', value: 420, color: 'bg-slate-300' },
                  { label: 'AI-qualified', value: 268, color: 'bg-rose-400' },
                  { label: 'Hot leads', value: 154, color: 'bg-rose-500' },
                  { label: 'Won / converted', value: 92, color: 'bg-violet-500' },
                ].map((row) => (
                  <div key={row.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-slate-600">{row.label}</span>
                      <span className="text-xs font-bold text-slate-800 tabular-nums">{row.value}</span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-slate-50 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${(row.value / 420) * 100}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                        className={`h-full rounded-full ${row.color}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 font-semibold mt-5 pt-4 border-t border-slate-50">22% of new conversations convert to a won deal — no manual triage in between.</p>
            </div>

            {/* Donut chart 3: conversation resolution */}
            <div className="gsap-reveal rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm hover:bg-violet-100 hover:border-violet-300 hover:shadow-md transition-all duration-300 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-800">Conversation Resolution</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5 mb-4">Autopilot resolution vs. human handoff ratio.</p>
              </div>
              <div className="relative flex items-center justify-center h-36 my-2">
                <svg className="w-32 h-32 transform -rotate-90">
                  {/* Background Circle */}
                  <circle
                    cx="64"
                    cy="64"
                    r="48"
                    stroke="#f1f5f9"
                    strokeWidth="10"
                    fill="transparent"
                  />
                  {/* AI Autopiloted Circle (82.6%) */}
                  <motion.circle
                    cx="64"
                    cy="64"
                    r="48"
                    stroke="#7c3aed"
                    strokeWidth="10"
                    fill="transparent"
                    strokeDasharray={301.6}
                    initial={{ strokeDashoffset: 301.6 }}
                    whileInView={{ strokeDashoffset: 301.6 * (1 - 0.826) }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                    strokeLinecap="round"
                  />
                  {/* Human Handoff Circle (12.4%) */}
                  <motion.circle
                    cx="64"
                    cy="64"
                    r="48"
                    stroke="#f43f5e"
                    strokeWidth="10"
                    fill="transparent"
                    strokeDasharray={301.6}
                    initial={{ strokeDashoffset: 301.6 }}
                    whileInView={{ strokeDashoffset: 301.6 * (1 - 0.124) }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
                    style={{ transformOrigin: '64px 64px', transform: 'rotate(297deg)' }}
                    strokeLinecap="round"
                  />
                  {/* Pending Circle (5%) */}
                  <motion.circle
                    cx="64"
                    cy="64"
                    r="48"
                    stroke="#cbd5e1"
                    strokeWidth="10"
                    fill="transparent"
                    strokeDasharray={301.6}
                    initial={{ strokeDashoffset: 301.6 }}
                    whileInView={{ strokeDashoffset: 301.6 * (1 - 0.05) }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
                    style={{ transformOrigin: '64px 64px', transform: 'rotate(342deg)' }}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-xl font-black text-slate-800">82.6%</span>
                  <span className="text-[9px] font-bold text-violet-600 uppercase tracking-wide">Autopilot</span>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-1 text-[10px] font-bold text-slate-500 border-t border-slate-50 pt-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-violet-600" /> AI Autopiloted
                  </span>
                  <span className="text-slate-800 tabular-nums">82.6%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-rose-500" /> Human Handoff
                  </span>
                  <span className="text-slate-800 tabular-nums">12.4%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-slate-300" /> Queue / Pending
                  </span>
                  <span className="text-slate-800 tabular-nums">5.0%</span>
                </div>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ─────────────────────────────────── 8B. COMPARISON TABLE ─── */}
      <section id="compare" className="relative py-20 lg:py-28 overflow-hidden">
        <div className="mx-auto max-w-[1100px] px-6 lg:px-12">

          <RevealSection className="text-center max-w-2xl mx-auto mb-14 space-y-4">
            <motion.span variants={fadeUp} custom={0} className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 border border-rose-100 px-3.5 py-1 text-xs font-semibold text-rose-700">
              <Zap className="h-3.5 w-3.5" /> Why switch
            </motion.span>
            <motion.h2 variants={fadeUp} custom={1} className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight" style={{ fontFamily: 'Manrope, system-ui, sans-serif' }}>
              Traditional platforms vs. ConnectSphere
            </motion.h2>
            <motion.p variants={fadeUp} custom={2} className="text-base text-slate-600 font-medium">
              Most tools give you a piece of the funnel. ConnectSphere owns the whole thing, end to end.
            </motion.p>
          </RevealSection>

          <RevealSection className="rounded-3xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[640px]">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100">
                    <th className="px-6 py-4 text-base font-extrabold text-slate-800 uppercase tracking-wide">Capability</th>
                    <th className="px-6 py-4 text-base font-extrabold text-slate-800 uppercase tracking-wide">Traditional platforms</th>
                    <th className="px-6 py-4 text-base font-extrabold uppercase tracking-wide text-rose-600">ConnectSphere</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Channel coverage', old: 'One channel per tool — WhatsApp here, email there', new: 'WhatsApp, Instagram, Messenger, email, SMS, voice — one pipeline' },
                    { label: 'First response time', old: 'Hours, often overnight', new: 'Seconds, 24/7, no human needed to start' },
                    { label: 'Lead qualification', old: 'Manual review or brittle keyword rules', new: 'AI reads intent and scores against your real pipeline' },
                    { label: 'CRM sync', old: 'Manual entry or a one-way export', new: 'Bi-directional, updates the moment a conversation does' },
                    { label: 'Setup time', old: 'Weeks of implementation, often a consultant', new: 'A few hours — connect a channel, upload your docs' },
                    { label: 'Escalation to humans', old: 'A missed message or a cold transfer', new: 'Automatic handoff with full context attached' },
                    { label: 'Pricing model', old: 'Per-seat, scales against your headcount', new: 'Scales with lead volume, not team size' },
                  ].map((row, i) => (
                    <tr key={row.label} className={i % 2 === 1 ? 'bg-slate-50/40' : ''}>
                      <td className="px-6 py-4 text-sm font-bold text-slate-800 border-t border-slate-100 align-top">{row.label}</td>
                      <td className="px-6 py-4 text-sm text-slate-500 font-medium border-t border-slate-100 align-top">
                        <span className="flex items-start gap-2">
                          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-300 shrink-0" /> {row.old}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-800 font-semibold border-t border-slate-100 align-top">
                        <span className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" /> {row.new}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </RevealSection>

        </div>
      </section>

      {/* ─────────────────────────────────── 9. TRUST & SOCIAL PROOF ─── */}
      <section className="relative py-20 lg:py-28 overflow-hidden">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
          
          <RevealSection className="text-center max-w-2xl mx-auto mb-16 space-y-4">
            <motion.span variants={fadeUp} custom={0} className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 border border-slate-800 px-3.5 py-1 text-xs font-semibold text-white">
              <Shield className="h-3.5 w-3.5" /> Built for Enterprise Trust
            </motion.span>
            <motion.h2 variants={fadeUp} custom={1} className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight" style={{ fontFamily: 'Manrope, system-ui, sans-serif' }}>
              Trusted by scaling revenue leaders
            </motion.h2>
            <motion.p variants={fadeUp} custom={2} className="text-base text-slate-600 font-medium">
              We focus on database security and logical grounding so you can deploy automation with peace of mind.
            </motion.p>
          </RevealSection>

          <RevealSection className="grid gap-8 md:grid-cols-3">
            {[
              { 
                company: 'VOC Automotive', 
                quote: "The RAG grounding works exactly as advertised. If it doesn't know an answer, it doesn't guess — it just drafts a callback thread and alerts Sangeetha.",
                avatar: 'V', 
                role: 'Head of Experience' 
              },
              { 
                company: 'Padmini Décor', 
                quote: "No more stale CRM logs. Every dynamic qualifying call and WhatsApp conversation auto-updates the lead records in Zoho immediately. Excellent work.",
                avatar: 'P', 
                role: 'Operations Director' 
              },
              { 
                company: 'Trident Systems', 
                quote: "We connected LinkedIn Lead Ads and WhatsApp in an hour. We've shut down our graveyard response shift — mornings start with pipeline pre-qualified.",
                avatar: 'T', 
                role: 'CEO' 
              }
            ].map((card, i) => (
              <motion.figure key={i} variants={fadeUp} custom={i} className="relative rounded-3xl border border-slate-200/80 bg-white p-8 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between">
                <div>
                  <div className="flex gap-0.5 text-amber-400">
                    {[...Array(5)].map((_, idx) => <Star key={idx} className="h-4 w-4 fill-current" />)}
                  </div>
                  <blockquote className="mt-5 text-sm text-slate-600 leading-relaxed font-semibold">
                    &ldquo;{card.quote}&rdquo;
                  </blockquote>
                </div>
                <figcaption className="mt-8 flex items-center gap-3 pt-4 border-t border-slate-100">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-rose-500 to-violet-500 text-sm font-bold text-white">
                    {card.avatar}
                  </span>
                  <div>
                    <p className="text-xs font-bold text-slate-900">{card.company}</p>
                    <p className="text-[10px] text-slate-400 font-semibold">{card.role}</p>
                  </div>
                </figcaption>
              </motion.figure>
            ))}
          </RevealSection>

        </div>
      </section>

      {/* ─────────────────────────────────── 11. FAQ ACCORDION ─── */}
      <section id="faq" className="relative py-20 lg:py-28 overflow-hidden">
        <div className="mx-auto max-w-[1200px] px-6 lg:px-12">
          
          <RevealSection className="text-center max-w-2xl mx-auto mb-16 space-y-4">
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight" style={{ fontFamily: 'Manrope, system-ui, sans-serif' }}>
              Frequently asked questions
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-base text-slate-600 font-medium">
              Everything you need to verify before connecting your first channel.
            </motion.p>
          </RevealSection>

          <div className="max-w-3xl mx-auto space-y-3">
            {FAQS.map((faq, idx) => (
              <div key={idx} className="gsap-reveal overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all">
                <button 
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="flex w-full items-start justify-between gap-4 p-6 text-left"
                >
                  <div className="flex items-start gap-3">
                    <HelpCircle className="h-5 w-5 text-rose-600 mt-0.5 shrink-0" />
                    <h3 className="text-sm sm:text-base font-bold text-slate-800">{faq.q}</h3>
                  </div>
                  <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-300 ${
                    openFaq === idx ? 'rotate-180 text-rose-600' : ''
                  }`} />
                </button>
                
                <AnimatePresence initial={false}>
                  {openFaq === idx && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <p className="pb-6 pl-14 pr-6 text-xs sm:text-sm text-slate-500 leading-relaxed font-semibold">
                        {faq.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ─────────────────────────────────── 12. FINAL CTA ─── */}
      <section className="relative py-16 px-6">
        <div className="gsap-reveal relative mx-auto max-w-[1100px] overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-12 sm:p-16 text-center shadow-xl shadow-slate-100 hover:bg-violet-100 hover:border-violet-300 transition-all duration-400">
          
          {/* Ambient blurred glow inside card */}
          <div className="absolute inset-0 bg-white/20 backdrop-blur-2xl z-0" />

          <div className="relative z-10 space-y-6">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-slate-200 px-3.5 py-1 text-xs font-semibold text-violet-700">
              Start Today · No Credit Card Required
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight" style={{ fontFamily: 'Manrope, system-ui, sans-serif' }}>
              Stop losing hot leads to{' '}
              <span className="bg-gradient-to-r from-rose-500 via-violet-600 to-fuchsia-500 bg-clip-text text-transparent">
                slow manual responses.
              </span>
            </h2>
            <p className="max-w-xl mx-auto text-base text-slate-600 font-medium">
              Join dozens of fast-scaling sales teams who have captured pre-qualified opportunities directly in their CRM systems.
            </p>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/register" className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold px-8 py-4 text-sm shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all">
                Register
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="mailto:sales@connectsphere.ai" className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-slate-600 hover:text-slate-900 transition-colors font-bold">
                Book live demo <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="pt-8 grid gap-4 sm:grid-cols-4 max-w-3xl mx-auto border-t border-slate-100/80 text-[10px] sm:text-xs font-bold text-slate-500">
              {[
                'SOC 2 Type II Certified',
                'Fully GDPR Compliant',
                'Isolated DB Storage',
                '99.9% Uptime Commitment'
              ].map((badge, idx) => (
                <div key={idx} className="flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>{badge}</span>
                </div>
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* ─────────────────────────────────── 13. PREMIUM FOOTER ─── */}
      <footer className="relative border-t border-slate-200/50 py-16 px-6 bg-white z-10">
        <div className="mx-auto max-w-[1400px]">
          
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4 pb-12 border-b border-slate-100 text-center sm:text-left">
            
            {/* Column 1: Logo & details */}
            <div className="space-y-4">
              <div className="flex items-center justify-center sm:justify-start">
                <img src="/logo-full.png" alt="ConnectSphere Logo" className="h-16 object-contain" />
              </div>
              <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                Unified multi-channel lead engagement and RAG automation systems for modern sales pipelines.
              </p>
            </div>

            {/* Column 2: Product */}
            <div className="space-y-3">
              <p className="text-sm font-extrabold text-slate-900 uppercase tracking-widest">Product</p>
              <div className="flex flex-col gap-2 text-xs font-medium text-slate-500">
                <a href="#builder" className="hover:text-rose-600 transition-colors">How It Works</a>
                <a href="#integrations" className="hover:text-rose-600 transition-colors">7 Channels Grid</a>
                <a href="#agents" className="hover:text-rose-600 transition-colors">Marketing Agent</a>
                <a href="#agents" className="hover:text-rose-600 transition-colors">Sales AI Agent</a>
              </div>
            </div>

            {/* Column 3: Resources */}
            <div className="space-y-3">
              <p className="text-sm font-extrabold text-slate-900 uppercase tracking-widest">Resources</p>
              <div className="flex flex-col gap-2 text-xs font-medium text-slate-500">
                <a href="#analytics" className="hover:text-rose-600 transition-colors">Funnel ROI Charts</a>
                <a href="#faq" className="hover:text-rose-600 transition-colors">General FAQs</a>
                <a href="mailto:support@connectsphere.ai" className="hover:text-rose-600 transition-colors">Contact Support</a>
              </div>
            </div>

            {/* Column 4: Compliance */}
            <div className="space-y-3">
              <p className="text-sm font-extrabold text-slate-900 uppercase tracking-widest">Security &amp; Legal</p>
              <div className="flex flex-col gap-2 text-xs font-medium text-slate-500">
                <a href="#" className="hover:text-orange-600 transition-colors">GDPR Privacy Agreement</a>
                <a href="#" className="hover:text-orange-600 transition-colors">Terms of Services</a>
                <a href="#" className="hover:text-orange-600 transition-colors">Data Processing Addendum</a>
                <a href="#" className="hover:text-orange-600 transition-colors">DPA Webhook Security</a>
              </div>
            </div>

          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-semibold text-slate-400 text-center">
            <p>© 2026 ConnectSphere · All rights reserved.</p>
            <div className="flex items-center gap-6">
              <a href="#" className="hover:text-slate-800 transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-slate-800 transition-colors">Terms of Use</a>
              <a href="#" className="hover:text-slate-800 transition-colors">SLA Agreement</a>
            </div>
          </div>

        </div>
      </footer>

    </main>
  );
}
