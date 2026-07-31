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
  Check, PlayCircle, Plus, Eye, Share2, Layers, Database, Sparkles, Radar,
  Clock, Users2, X, Instagram, LayoutGrid, Search
} from 'lucide-react';
import ChatAssistant from '../components/landing/ChatAssistant';

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
  { q: 'Does this replace our existing CRM?', a: 'No, Orbq sits in front of your CRM (HubSpot, Salesforce, Zoho, etc.). It instantly captures, filters, and qualifies leads, then routes the qualified deals with full chat transcripts directly to your sales pipeline.' },
  { q: 'How does the AI handle voice calls?', a: 'Our Voice Agent uses real-time, ultra-low latency conversational AI to handle incoming queries, qualify callers, and dynamically schedule callbacks or hand off active calls to human agents.' },
  { q: 'Is my company data used to train public models?', a: 'Absolutely not. Orbq uses secure, isolated vector databases for each organization. Your documents, logs, and customer conversations are encrypted at rest and in transit, and never leaked.' },
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
      reply: 'Hi Rohan! Orbq handles WhatsApp qualification and HubSpot two-way sync natively. Based on your inputs, your lead score is 94/100 (Hot). Let\'s schedule a brief setup call!'
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
                    Orbq AI Agent
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

/* ── AI Engine diagram ──────────────────────────────────────────────
   Channels fan in on the left, converge on the AI core, and fan back out
   as concrete outcomes on the right. Drawn as one SVG in a fixed 1200x620
   coordinate space with the HTML nodes positioned from the SAME numbers —
   so the curves always terminate exactly on a card edge instead of drifting
   out of alignment the way hand-placed absolute offsets do. */

const DIAG_W = 1200;
const DIAG_H = 620;
const CORE = { x: 600, y: 300, r: 78 };
const LEFT_X = 330;   // right edge of the channel column
const RIGHT_X = 870;  // left edge of the outcome column

const FLOW_CHANNELS = [
  { name: 'WhatsApp',  icon: MessageCircle,  count: 148, color: '#22c55e', y: 60 },
  { name: 'Instagram', icon: InstagramIcon,  count: 61,  color: '#ec4899', y: 128 },
  { name: 'Messenger', icon: MessagesSquare, count: 34,  color: '#3b82f6', y: 196 },
  { name: 'LinkedIn',  icon: Linkedin,       count: 27,  color: '#0ea5e9', y: 264 },
  { name: 'Web chat',  icon: Globe,          count: 79,  color: '#a78bfa', y: 332 },
  { name: 'Email',     icon: Mail,           count: 44,  color: '#f43f5e', y: 400 },
  { name: 'SMS',       icon: Smartphone,     count: 18,  color: '#f59e0b', y: 468 },
  { name: 'Voice',     icon: Phone,          count: 11,  color: '#14b8a6', y: 536 },
];

const OUTCOMES = [
  { title: 'Auto reply sent',  badge: 'Success',     tone: 'emerald', icon: CheckCircle2, l1: '1,062 replies sent automatically', l2: '82.6% resolved by AI',  color: '#34d399', y: 92 },
  { title: 'Human handoff',    badge: 'In progress', tone: 'amber',   icon: UserCheck,    l1: '84 conversations assigned',        l2: 'Median wait: 2m 11s',   color: '#fbbf24', y: 232 },
  { title: 'Qualified lead',   badge: 'New',         tone: 'violet',  icon: TrendingUp,   l1: '138 qualified leads captured',     l2: '₹42.8L pipeline added', color: '#a78bfa', y: 372 },
  { title: 'CRM updated',      badge: 'Synced',      tone: 'sky',     icon: Database,     l1: 'Every conversation logged',        l2: 'Contacts & deals updated', color: '#38bdf8', y: 512 },
];

// Satellite capabilities orbiting the core, evenly spaced from 12 o'clock.
const SATELLITES = [
  { label: 'Intent\nDetection',   icon: ScanSearch },
  { label: 'Knowledge\nSearch (RAG)', icon: Layers },
  { label: 'Lead\nScoring',       icon: BarChart3 },
  { label: 'Smart\nRouting',      icon: Share2 },
  { label: 'Draft\nReply',        icon: FileText },
  { label: 'CRM\nMatch',          icon: Plug },
  { label: 'Sentiment\nAnalysis', icon: Cpu },
];

const BADGE_TONES = {
  emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
  amber:   'bg-amber-500/15 text-amber-300 border-amber-500/25',
  violet:  'bg-violet-500/15 text-violet-300 border-violet-500/25',
  sky:     'bg-sky-500/15 text-sky-300 border-sky-500/25',
};

// Cubic bezier that leaves horizontally and arrives horizontally, so every
// curve meets the core tangentially rather than at a hard angle.
function curveTo(x1, y1, x2, y2) {
  const dx = Math.abs(x2 - x1) * 0.55;
  return `M ${x1},${y1} C ${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
}

function StepFlow() {
  const satPositions = SATELLITES.map((s, i) => {
    const angle = (-90 + i * (360 / SATELLITES.length)) * (Math.PI / 180);
    const R = 152;
    return { ...s, x: CORE.x + R * Math.cos(angle), y: CORE.y + R * Math.sin(angle) };
  });

  return (
    <div className="relative">
      <div
        className="relative mx-auto w-full"
        style={{ maxWidth: DIAG_W, aspectRatio: `${DIAG_W} / ${DIAG_H}` }}
      >
        {/* Connector lines. Sits under the nodes; pointer-events off so the
            cards above stay hoverable. */}
        <svg
          viewBox={`0 0 ${DIAG_W} ${DIAG_H}`}
          className="absolute inset-0 h-full w-full pointer-events-none"
          fill="none"
        >
          <defs>
            {FLOW_CHANNELS.map((c, i) => (
              <linearGradient key={`gi${i}`} id={`gi${i}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={c.color} stopOpacity="0.05" />
                <stop offset="55%" stopColor={c.color} stopOpacity="0.85" />
                <stop offset="100%" stopColor={c.color} stopOpacity="0.25" />
              </linearGradient>
            ))}
            {OUTCOMES.map((o, i) => (
              <linearGradient key={`go${i}`} id={`go${i}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={o.color} stopOpacity="0.25" />
                <stop offset="45%" stopColor={o.color} stopOpacity="0.85" />
                <stop offset="100%" stopColor={o.color} stopOpacity="0.05" />
              </linearGradient>
            ))}
            <radialGradient id="coreGlow">
              <stop offset="0%" stopColor="#fb7185" stopOpacity="0.55" />
              <stop offset="70%" stopColor="#e11d48" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#e11d48" stopOpacity="0" />
            </radialGradient>
          </defs>

          <circle cx={CORE.x} cy={CORE.y} r={230} fill="url(#coreGlow)" />

          {/* dashed orbit the satellites sit on */}
          <circle cx={CORE.x} cy={CORE.y} r={152} stroke="rgba(251,113,133,0.25)" strokeWidth="1" strokeDasharray="4 7" />

          {/* inbound: channel -> core */}
          {FLOW_CHANNELS.map((c, i) => {
            const d = curveTo(LEFT_X, c.y, CORE.x - CORE.r - 6, CORE.y);
            return (
              <g key={c.name}>
                <path d={d} stroke={`url(#gi${i})`} strokeWidth="1.6" />
                <path
                  d={d}
                  stroke={c.color}
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeDasharray="3 190"
                  className="animate-dash-flow"
                  style={{ animationDelay: `${i * 0.45}s` }}
                />
              </g>
            );
          })}

          {/* outbound: core -> outcome */}
          {OUTCOMES.map((o, i) => {
            const d = curveTo(CORE.x + CORE.r + 6, CORE.y, RIGHT_X, o.y);
            return (
              <g key={o.title}>
                <path d={d} stroke={`url(#go${i})`} strokeWidth="1.6" />
                <path
                  d={d}
                  stroke={o.color}
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeDasharray="3 170"
                  className="animate-dash-flow"
                  style={{ animationDelay: `${0.9 + i * 0.5}s` }}
                />
              </g>
            );
          })}
        </svg>

        {/* ── Left: channels ─────────────────────────────── */}
        <p
          className="absolute text-[11px] font-bold uppercase tracking-widest text-slate-400"
          style={{ left: `${(24 / DIAG_W) * 100}%`, top: `${(14 / DIAG_H) * 100}%` }}
        >
          All your channels
        </p>
        {FLOW_CHANNELS.map((c) => (
          <div
            key={c.name}
            className="absolute flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.06] backdrop-blur-md px-3 py-2 hover:border-white/25 hover:bg-white/[0.1] transition-colors"
            style={{
              left: `${(24 / DIAG_W) * 100}%`,
              width: `${((LEFT_X - 24) / DIAG_W) * 100}%`,
              top: `${(c.y / DIAG_H) * 100}%`,
              transform: 'translateY(-50%)',
            }}
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ background: `${c.color}22`, color: c.color }}>
              <c.icon className="h-3.5 w-3.5" />
            </span>
            <span className="text-[13px] font-bold text-white truncate">{c.name}</span>
            <span className="ml-auto text-[11px] font-bold text-slate-400 tabular-nums">{c.count}</span>
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: c.color }} />
          </div>
        ))}

        {/* ── Center: AI core + satellites ────────────────── */}
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: '50%', top: `${(CORE.y / DIAG_H) * 100}%` }}
        >
          <div className="relative grid place-items-center rounded-full bg-gradient-to-br from-rose-500 via-fuchsia-500 to-orange-400 shadow-[0_0_60px_-8px_rgba(251,113,133,0.85)]"
            style={{ height: CORE.r * 2 * 0.9, width: CORE.r * 2 * 0.9 }}>
            <div className="absolute inset-[3px] rounded-full bg-[#1a0a12]/85 backdrop-blur-sm grid place-items-center border border-white/10">
              <Bot className="h-6 w-6 text-white mb-0.5" />
              <span className="text-[10px] font-black text-white tracking-wide">AI Engine</span>
            </div>
          </div>
        </div>

        {satPositions.map((s) => (
          <div
            key={s.label}
            className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 w-24"
            style={{ left: `${(s.x / DIAG_W) * 100}%`, top: `${(s.y / DIAG_H) * 100}%` }}
          >
            <span className="grid h-9 w-9 place-items-center rounded-full border border-rose-400/30 bg-[#1a0a12]/80 backdrop-blur-sm text-rose-300 shadow-lg">
              <s.icon className="h-4 w-4" />
            </span>
            <span className="text-[9px] font-bold leading-[1.15] text-center text-slate-400 whitespace-pre-line">{s.label}</span>
          </div>
        ))}

        {/* ── Right: outcomes ─────────────────────────────── */}
        <p
          className="absolute text-[11px] font-bold uppercase tracking-widest text-slate-400 text-right"
          style={{ right: `${(24 / DIAG_W) * 100}%`, top: `${(14 / DIAG_H) * 100}%` }}
        >
          Outcomes that drive growth
        </p>
        {OUTCOMES.map((o) => (
          <div
            key={o.title}
            className="absolute rounded-xl border border-white/10 bg-white/[0.06] backdrop-blur-md p-3 hover:border-white/25 hover:bg-white/[0.1] transition-colors"
            style={{
              right: `${(24 / DIAG_W) * 100}%`,
              width: `${((DIAG_W - RIGHT_X - 24) / DIAG_W) * 100}%`,
              top: `${(o.y / DIAG_H) * 100}%`,
              transform: 'translateY(-50%)',
            }}
          >
            <div className="flex items-start gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: `${o.color}22`, color: o.color }}>
                <o.icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-bold text-white truncate">{o.title}</p>
                  <span className={`ml-auto shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${BADGE_TONES[o.tone]}`}>{o.badge}</span>
                </div>
                <p className="text-[10px] text-slate-400 truncate mt-0.5">{o.l1}</p>
                <p className="text-[10px] text-slate-500 truncate">{o.l2}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── "Why Orbq Wins" — fragmented apps merge into a unified AI-run
   dashboard through a glowing core, instead of a plain comparison table. ─── */
/* ─── Compare section data ──────────────────────────────────────────────
   The "old way" half: real tools a team actually juggles, each with the
   symptom that makes it costly (unread counts, a failed sync, a missed call). */
const LEGACY_APPS = [
  { id: 'wa',    label: 'WhatsApp',      line1: 'Hi, I’m interested in your product.', line2: 'Can you share pricing?', badge: 8,  Icon: MessageCircle, brand: 'bg-emerald-500', left: '4%',  top: '6%',  w: 168 },
  { id: 'mail',  label: 'Email',         line1: 'New Lead Enquiry',      line2: 'Re: Follow up · yesterday',   badge: 12, Icon: Mail,          brand: 'bg-blue-500',    left: '48%', top: '2%',  w: 164 },
  { id: 'sheet', label: 'Spreadsheets',  line1: 'Leads_07.xlsx',         line2: 'Updated manually',                            Icon: FileText,      brand: 'bg-emerald-600', left: '18%', top: '36%', w: 156 },
  { id: 'call',  label: 'Calls',         line1: 'Missed call',           line2: '1m ago',                          badge: 3,  Icon: Phone,         brand: 'bg-emerald-500', left: '54%', top: '38%', w: 150 },
  { id: 'crm',   label: 'CRM',           line1: 'Last updated',          line2: '2 days ago',                      warn: true, Icon: Database,     brand: 'bg-sky-500',     left: '8%',  top: '62%', w: 158 },
  { id: 'ig',    label: 'Instagram',     line1: 'DM from user',          line2: '5m ago',                          badge: 5,  Icon: Instagram,     brand: 'bg-pink-500',    left: '2%',  top: '20%', w: 150 },
  { id: 'msg',   label: 'Messenger',     line1: 'New message',           line2: '7m ago',                          badge: 6,  Icon: MessagesSquare, brand: 'bg-blue-600',   left: '46%', top: '68%', w: 158 },
];

/* Curved dashed links between the cards above, in the same 0-100 space. */
/* Cross-panel wiring for the compare visual, in the overlay's 0-100 space.
   IN:每 scattered tool converging on the core. OUT: the core fanning to the
   unified product. */
const WIRES_IN = [
  'M10,20 C26,20 34,34 43,45',
  'M6,36  C20,38 32,42 43,48',
  'M12,54 C24,54 34,52 43,51',
  'M20,70 C30,68 38,60 43,54',
  'M28,12 C36,20 40,32 44,43',
];

const WIRES_OUT = [
  'M56,46 C62,40 62,26 66,20',
  'M56,49 C62,46 62,40 66,38',
  'M56,52 C62,54 62,56 66,58',
  'M56,55 C62,62 62,70 66,76',
];

const BROKEN_LINKS = [
  'M14,16 C30,8 46,10 56,10',
  'M56,14 C48,26 40,30 30,42',
  'M14,26 C22,34 24,38 28,44',
  'M28,48 C40,46 52,44 60,44',
  'M16,66 C28,60 36,54 44,50',
  'M52,74 C48,62 46,56 44,50',
];

const FAILURE_TAGS = [
  { label: 'Lost leads',     left: '62%', top: '26%' },
  { label: 'No visibility',  left: '4%',  top: '52%' },
  { label: 'Manual updates', left: '38%', top: '88%' },
];

/* The unified half — a compressed but honest render of the real app shell. */
const DASH_NAV = [
  { label: 'Dashboard',   Icon: LayoutGrid },
  { label: 'Unified Inbox', Icon: Inbox, count: 24 },
  { label: 'Contacts',    Icon: Users2 },
  { label: 'AI Agents',   Icon: Bot },
  { label: 'Campaigns',   Icon: Megaphone },
  { label: 'Analytics',   Icon: BarChart3 },
];

const DASH_CHANNELS = [
  { label: 'WhatsApp',  n: 148, dot: 'bg-emerald-500' },
  { label: 'Instagram', n: 61,  dot: 'bg-pink-500'    },
  { label: 'Messenger', n: 34,  dot: 'bg-blue-500'    },
  { label: 'LinkedIn',  n: 27,  dot: 'bg-sky-600'     },
  { label: 'Email',     n: 44,  dot: 'bg-violet-500'  },
  { label: 'Voice',     n: 11,  dot: 'bg-rose-500'    },
];

const DASH_KPIS = [
  { label: 'Total Conversations', value: 2649,    delta: '+16.6%', Icon: MessagesSquare, tone: 'bg-violet-100 text-violet-600'   },
  { label: 'Revenue Impact',      value: 2458000, delta: '+32.4%', Icon: TrendingUp,     tone: 'bg-emerald-100 text-emerald-600', prefix: '₹' },
  { label: 'Open Conversations',  value: 156,     delta: '+12.3%', Icon: Inbox,          tone: 'bg-blue-100 text-blue-600'       },
  { label: 'Unreplied',           value: 24,      delta: '-8.7%',  Icon: Clock,          tone: 'bg-rose-100 text-rose-600'       },
];

const PERF_POINTS = [[0,44],[28,38],[56,40],[84,26],[112,30],[140,16],[168,20],[200,8]];
const PERF_LINE = `M${PERF_POINTS.map((p) => p.join(',')).join(' L')}`;

/* pct/offset are pathLength-100 units, so the ring reads as percentages. */
const DONUT = [
  { label: 'WhatsApp',  pct: 42, offset: 0,  color: '#10b981' },
  { label: 'Instagram', pct: 20, offset: 42, color: '#ec4899' },
  { label: 'Email',     pct: 18, offset: 62, color: '#8b5cf6' },
  { label: 'Others',    pct: 20, offset: 80, color: '#3b82f6' },
];

const AGENT_ROWS = [
  { agent: 'Marketing Agent', note: 'Sent broadcast · New Product Launch', status: 'Completed', dot: 'bg-violet-500',  tone: 'bg-emerald-50 text-emerald-700' },
  { agent: 'Sales Agent',     note: 'Qualified lead from WhatsApp',            status: 'Qualified', dot: 'bg-emerald-500', tone: 'bg-violet-50 text-violet-700'   },
  { agent: 'Support Agent',   note: 'Resolved conversation automatically',     status: 'Resolved',  dot: 'bg-blue-500',    tone: 'bg-blue-50 text-blue-700'       },
  { agent: 'Voice Agent',     note: 'Completed outbound call',                 status: 'Completed', dot: 'bg-rose-500',    tone: 'bg-emerald-50 text-emerald-700' },
];

/**
 * Counts a number up once its section scrolls into view. Uses rAF rather than
 * a CSS keyframe because the value itself has to change, not just a style, and
 * an interval would drift against the frame clock on slower devices.
 */
function CountUp({ to, run, delay = 0, duration = 1400 }) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!run) return undefined;
    let frame;
    let start;
    const timer = setTimeout(() => {
      const tick = (now) => {
        if (start === undefined) start = now;
        const p = Math.min((now - start) / duration, 1);
        // ease-out so it decelerates into the final figure
        setValue(Math.round(to * (1 - Math.pow(1 - p, 3))));
        if (p < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, delay);
    return () => { clearTimeout(timer); if (frame) cancelAnimationFrame(frame); };
  }, [run, to, delay, duration]);

  return <>{value.toLocaleString('en-IN')}</>;
}

const PAINS = [
  { title: 'Hours of manual work', body: 'Wasted switching between multiple tools', tag: 'High effort',    Icon: Clock,      tone: 'bg-rose-50 text-rose-600'   },
  { title: 'Missed opportunities', body: 'Leads get lost or answered far too late', tag: 'Low conversion', Icon: Eye,        tone: 'bg-orange-50 text-orange-600' },
  { title: 'No team visibility',   body: 'Scattered data, no unified customer view', tag: 'Siloed teams',  Icon: Users2,     tone: 'bg-violet-50 text-violet-600' },
];

const GAINS = [
  { title: 'Instant responses', body: 'AI replies in seconds, 24/7',                 tag: 'High speed',       Icon: Zap,        tone: 'bg-emerald-50 text-emerald-600' },
  { title: 'More conversions',  body: 'Capture more leads and close faster',         tag: 'Higher revenue',   Icon: TrendingUp, tone: 'bg-blue-50 text-blue-600'       },
  { title: 'Unified & secure',  body: 'All conversations, teams and data in one place', tag: 'Enterprise ready', Icon: Shield,  tone: 'bg-violet-50 text-violet-600'   },
];

const TRUST_STRIP = [
  { title: '8+ channels unified', body: 'WhatsApp, Instagram, Email, SMS, Voice, Web chat & more', Icon: Share2,     tone: 'bg-violet-50 text-violet-600'   },
  { title: 'AI that understands', body: 'Intent detection, RAG, and smart routing',                Icon: Cpu,        tone: 'bg-rose-50 text-rose-600'       },
  { title: 'Trusted by 60+ teams', body: 'Across industries and continents',                       Icon: Users2,     tone: 'bg-emerald-50 text-emerald-600' },
  { title: '4.9/5 CSAT',           body: 'From our customers',                                     Icon: Star,       tone: 'bg-amber-50 text-amber-600'     },
];

function WhyWinsSection() {
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: true, margin: '-120px' });
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const handleMouseMove = useCallback((e) => {
    const rect = containerRef.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: px * 6, y: py * -6 });
  }, []);

  return (
    <section id="compare" className="relative py-20 lg:py-28 overflow-hidden bg-white">
      {/* Soft mesh gradient backdrop + floating particles — subtle, never competes with the product */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-20 left-[10%] w-[36rem] h-[36rem] rounded-full bg-rose-100/40 blur-[120px]" />
        <div className="absolute top-1/3 right-[5%] w-[30rem] h-[30rem] rounded-full bg-violet-100/40 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 w-[28rem] h-[28rem] rounded-full bg-orange-100/40 blur-[120px]" />
        {Array.from({ length: 14 }).map((_, i) => (
          <span
            key={i}
            className="absolute h-1 w-1 rounded-full bg-rose-300/50 animate-float"
            style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%`, animationDuration: `${5 + (i % 5)}s`, animationDelay: `${i * 0.3}s` }}
          />
        ))}
      </div>

      <div ref={containerRef} onMouseMove={handleMouseMove} onMouseLeave={() => setTilt({ x: 0, y: 0 })} className="relative mx-auto max-w-[1400px] px-6 lg:px-12">

        <RevealSection className="text-center max-w-3xl mx-auto mb-10 space-y-4">
          <motion.span variants={fadeUp} custom={0} className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 border border-violet-200 px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-violet-700">
            <Sparkles className="h-3.5 w-3.5" /> The Orbq Difference
          </motion.span>
          <motion.h2 variants={fadeUp} custom={1} className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight" style={{ fontFamily: 'Manrope, system-ui, sans-serif' }}>
            From <span className="inline-block text-rose-500 animate-pop-word" style={{ animationDelay: '0.05s' }}>Chaos</span> to{' '}
            <span className="inline-block text-violet-600 animate-pop-word" style={{ animationDelay: '0.22s' }}>Clarity</span>.<br className="hidden sm:block" />
            {' '}From <span className="inline-block text-rose-500 animate-pop-word" style={{ animationDelay: '0.42s' }}>Missed</span> to{' '}
            <span className="inline-block text-blue-600 animate-pop-word" style={{ animationDelay: '0.6s' }}>Maximized</span>.
          </motion.h2>
          <motion.p variants={fadeUp} custom={2} className="text-base text-slate-600 font-medium max-w-2xl mx-auto">
            Stop losing leads in scattered tools. Orbq unifies every conversation, automates every step,
            and drives more revenue — faster.
          </motion.p>
        </RevealSection>

        {/* Old way / Orbq way column headers, aligned over the two halves */}
        <RevealSection className="grid lg:grid-cols-[1fr_auto_1fr] gap-6 lg:gap-2 mb-6">
          <motion.div variants={fadeUp} custom={0} className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-slate-200 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-slate-500 shadow-sm">
              <span className="grid h-4 w-4 place-items-center rounded-full bg-rose-500 text-white"><X className="h-2.5 w-2.5" /></span>
              The old way
            </span>
            <p className="mt-3 text-lg font-black text-slate-900">Disconnected. Manual. Time-consuming.</p>
            <p className="text-xs text-slate-500 mt-1">Leads fall through the cracks. Teams waste time switching between tools.</p>
          </motion.div>
          <div className="hidden lg:block w-[220px]" />
          <motion.div variants={fadeUp} custom={1} className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-slate-200 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-slate-500 shadow-sm">
              <span className="grid h-4 w-4 place-items-center rounded-full bg-emerald-500 text-white"><Check className="h-2.5 w-2.5" /></span>
              The Orbq way
            </span>
            <p className="mt-3 text-lg font-black text-slate-900">Unified. Automated. Revenue-focused.</p>
            <p className="text-xs text-slate-500 mt-1">Every lead captured, every conversation intelligent, every team aligned.</p>
          </motion.div>
        </RevealSection>

        {/* ── the transformation visual ── */}
        <div
          className="relative grid lg:grid-cols-[1fr_auto_1fr] gap-6 lg:gap-4 items-center transition-transform duration-300 ease-out"
          style={{ transform: `perspective(1600px) rotateX(${tilt.y}deg) rotateY(${tilt.x}deg)` }}
        >
          {/* Wiring across the whole width: scattered tools funnel INTO the core
              in red, the core fans OUT to the product in violet. One overlay
              spanning all three columns — an SVG inside a column could not
              cross the grid gap. Hidden below lg, where the grid stacks and the
              left-to-right reading no longer holds. */}
          <svg
            className="pointer-events-none absolute inset-0 z-0 hidden h-full w-full lg:block"
            viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"
          >
            <defs>
              <marker id="wireInHead" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto">
                <path d="M0,0 L6,3 L0,6 z" fill="#fb7185" />
              </marker>
              <marker id="wireOutHead" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto">
                <path d="M0,0 L6,3 L0,6 z" fill="#8b5cf6" />
              </marker>
            </defs>

            {WIRES_IN.map((d, i) => (
              <path
                key={`in-${i}`} d={d} fill="none" stroke="#fb7185" strokeWidth="0.32"
                strokeDasharray="1.4 1.6" markerEnd="url(#wireInHead)"
                className="animate-dash-flow" style={{ animationDelay: `${i * 0.35}s`, opacity: 0.75 }}
              />
            ))}
            {WIRES_OUT.map((d, i) => (
              <path
                key={`out-${i}`} d={d} fill="none" stroke="#8b5cf6" strokeWidth="0.32"
                strokeDasharray="1.4 1.6" markerEnd="url(#wireOutHead)"
                className="animate-dash-flow" style={{ animationDelay: `${i * 0.3}s`, opacity: 0.8 }}
              />
            ))}
          </svg>
          {/* ══ LEFT — scattered tools, broken wiring ══ */}
          <div className="relative min-h-[440px] rounded-3xl border border-slate-200 bg-white/70 p-4 shadow-sm backdrop-blur-sm">
            {/* broken connector web — dashes travel, then the link drops out */}
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              {BROKEN_LINKS.map((d, i) => (
                <path
                  key={i} d={d} fill="none" stroke="#fda4af" strokeWidth="0.35"
                  strokeDasharray="1.6 1.6" className="animate-break-blink"
                  style={{ animationDelay: `${i * 0.45}s` }}
                />
              ))}
            </svg>

            {LEGACY_APPS.map((app, i) => (
              <motion.div
                key={app.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={isInView ? { opacity: 1, scale: 1 } : {}}
                transition={{ duration: 0.45, delay: i * 0.07 }}
                className="absolute animate-float rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.25)]"
                style={{
                  left: app.left, top: app.top, width: app.w,
                  animationDuration: `${4.6 + i * 0.35}s`, animationDelay: `${i * 0.3}s`,
                }}
              >
                <div className="flex items-start gap-2">
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white ${app.brand}`}>
                    <app.Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-bold text-slate-800">{app.label}</p>
                    {app.line1 && <p className="mt-0.5 truncate text-[10px] text-slate-500">{app.line1}</p>}
                    {app.line2 && <p className="truncate text-[10px] text-slate-400">{app.line2}</p>}
                  </div>
                  {app.badge && (
                    <span className="grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white animate-soft-throb">
                      {app.badge}
                    </span>
                  )}
                  {app.warn && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-500 animate-soft-throb" />}
                </div>
              </motion.div>
            ))}

            {/* the costs, called out in red like the reference */}
            {FAILURE_TAGS.map((t, i) => (
              <span
                key={t.label}
                className="absolute inline-flex items-center gap-1 rounded-md border border-rose-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-rose-600 shadow-sm animate-soft-throb"
                style={{ left: t.left, top: t.top, animationDelay: `${i * 0.6}s` }}
              >
                <X className="h-2.5 w-2.5" /> {t.label}
              </span>
            ))}
          </div>

          {/* ══ CENTER — the Orbq core ══ */}
          <div className="relative mx-auto grid w-[230px] place-items-center py-6">
            <div className="relative grid h-[190px] w-[190px] place-items-center">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-500/25 via-fuchsia-500/15 to-blue-500/25 blur-3xl animate-pulse-ring" />
              <div className="absolute inset-2 rounded-full border border-dashed border-violet-300/60 animate-[spin_18s_linear_infinite]" />
              <div className="absolute inset-7 rounded-full border border-dashed border-blue-300/50 animate-[spin_26s_linear_infinite_reverse]" />
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="absolute inset-0 animate-[spin_11s_linear_infinite]" style={{ animationDelay: `${i * -1.8}s` }}>
                  <span className="absolute left-1/2 top-1 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-violet-400 shadow-[0_0_10px_2px_rgba(139,92,246,0.6)]" />
                </div>
              ))}
              {/* The mark IS the core. No gradient disc behind it: the supplied
                  PNG carries its own background, so a disc rendered as a white
                  box around the logo. The glow sits behind the image instead. */}
              <div className="relative grid h-[128px] w-[128px] place-items-center">
                <span className="absolute inset-0 rounded-full bg-violet-500/25 blur-2xl animate-halo" />
                <img
                  src="/orbq-icon.png"
                  alt="Orbq"
                  className="relative h-28 w-28 object-contain drop-shadow-[0_8px_28px_rgba(139,92,246,0.55)] animate-float"
                  style={{ animationDuration: '5s' }}
                />
              </div>
            </div>

            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-violet-700 shadow-sm">
              <Sparkles className="h-3 w-3" /> AI powered by Orbq
            </span>
            <p className="mt-2 text-center text-base font-black text-slate-900">Orbq AI</p>
            <p className="text-center text-[11px] font-semibold leading-tight text-slate-500">
              Understands. Qualifies.<br />Automates. Converts.
            </p>
          </div>

          {/* ══ RIGHT — the unified product ══ */}
          <motion.div
            initial={{ opacity: 0, x: 26 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_20px_50px_-20px_rgba(79,70,229,0.35)]"
          >
            <span className="pointer-events-none absolute inset-y-0 -left-1/3 z-20 w-1/3 skew-x-12 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-sheen" />

            <div className="flex text-[9px]">
              {/* mini sidebar */}
              <div className="w-[104px] shrink-0 border-r border-slate-100 bg-slate-50/70 p-2">
                <div className="mb-2 flex items-center gap-1">
                  <img src="/orbq-icon.png" alt="" className="h-4 w-4 object-contain" />
                  <span className="text-[10px] font-black text-slate-900">Orbq</span>
                </div>
                <p className="mb-1 text-[7px] font-bold uppercase tracking-wider text-slate-400">Platform</p>
                {DASH_NAV.map((n, i) => (
                  <div key={n.label} className={`mb-px flex items-center gap-1 rounded px-1 py-[3px] ${i === 0 ? 'bg-violet-100 font-bold text-violet-700' : 'text-slate-500'}`}>
                    <n.Icon className="h-2.5 w-2.5 shrink-0" />
                    <span className="truncate">{n.label}</span>
                    {n.count && <span className="ml-auto text-[7px] text-slate-400">{n.count}</span>}
                  </div>
                ))}
                <p className="mb-1 mt-2 text-[7px] font-bold uppercase tracking-wider text-slate-400">Channels</p>
                {DASH_CHANNELS.map((c) => (
                  <div key={c.label} className="mb-px flex items-center gap-1 px-1 py-[2px] text-slate-500">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${c.dot}`} />
                    <span className="truncate">{c.label}</span>
                    <span className="ml-auto text-[7px] text-slate-400">{c.n}</span>
                  </div>
                ))}
              </div>

              {/* main panel */}
              <div className="min-w-0 flex-1 p-2.5">
                <div className="mb-2 flex items-center gap-1.5">
                  <div className="flex flex-1 items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-1 text-slate-400">
                    <Search className="h-2.5 w-2.5" /> <span className="text-[8px]">Search leads, contacts, conversations…</span>
                  </div>
                  <span className="grid h-4 w-4 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-rose-500 text-[7px] font-bold text-white">AK</span>
                </div>

                <p className="text-[11px] font-black text-slate-900">Good morning, Arjun 👋</p>
                <p className="mb-2 text-[8px] text-slate-400">Here&apos;s what&apos;s happening in your conversations today.</p>

                {/* KPI row — numbers count up when the section enters view */}
                <div className="mb-2 grid grid-cols-4 gap-1.5">
                  {DASH_KPIS.map((k, i) => (
                    <div key={k.label} className="rounded-lg border border-slate-100 bg-white p-1.5 shadow-sm">
                      <div className="flex items-center gap-1">
                        <span className={`grid h-3 w-3 place-items-center rounded ${k.tone}`}><k.Icon className="h-2 w-2" /></span>
                        <span className="truncate text-[7px] text-slate-400">{k.label}</span>
                      </div>
                      <p className="mt-0.5 text-[12px] font-black tabular-nums text-slate-900">
                        {k.prefix}<CountUp to={k.value} run={isInView} delay={200 + i * 120} />
                      </p>
                      <p className="text-[7px] font-bold text-emerald-600">{k.delta}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-[1.6fr_1fr] gap-1.5">
                  {/* performance line chart — draws itself in */}
                  <div className="rounded-lg border border-slate-100 p-1.5">
                    <p className="mb-1 text-[8px] font-bold text-slate-700">Performance Overview</p>
                    <svg viewBox="0 0 200 56" className="h-14 w-full" aria-hidden="true">
                      <defs>
                        <linearGradient id="perfFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.35" />
                          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path d={`${PERF_LINE} L200,56 L0,56 Z`} fill="url(#perfFill)" />
                      <path d={PERF_LINE} fill="none" stroke="#7c3aed" strokeWidth="1.6"
                        strokeDasharray="400" strokeDashoffset="400"
                        style={{ animation: 'drawPath 2.4s cubic-bezier(0.22,1,0.36,1) 0.4s forwards' }} />
                      {PERF_POINTS.map((p, i) => (
                        <circle key={i} cx={p[0]} cy={p[1]} r="1.6" fill="#7c3aed"
                          className="animate-halo" style={{ animationDelay: `${1 + i * 0.12}s` }} />
                      ))}
                    </svg>
                  </div>

                  {/* channel donut */}
                  <div className="rounded-lg border border-slate-100 p-1.5">
                    <p className="mb-1 text-[8px] font-bold text-slate-700">Top Channels</p>
                    <div className="flex items-center gap-1.5">
                      <svg viewBox="0 0 42 42" className="h-12 w-12 -rotate-90" aria-hidden="true">
                        {DONUT.map((d, i) => (
                          <circle
                            key={d.label} cx="21" cy="21" r="15.9" fill="none"
                            stroke={d.color} strokeWidth="6"
                            strokeDasharray={`${d.pct} ${100 - d.pct}`} strokeDashoffset={-d.offset}
                            pathLength="100"
                            style={{ animation: `growBar 0.9s ease-out ${0.5 + i * 0.15}s both` }}
                          />
                        ))}
                      </svg>
                      <div className="min-w-0 space-y-px">
                        {DONUT.map((d) => (
                          <div key={d.label} className="flex items-center gap-1 text-[7px] text-slate-500">
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: d.color }} />
                            <span className="truncate">{d.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* live agent activity — rows tick in one by one */}
                <div className="mt-1.5 rounded-lg border border-slate-100 p-1.5">
                  <p className="mb-1 flex items-center gap-1 text-[8px] font-bold text-slate-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> AI Agent Activity
                  </p>
                  {AGENT_ROWS.map((r, i) => (
                    <motion.div
                      key={r.agent}
                      initial={{ opacity: 0, x: 8 }}
                      animate={isInView ? { opacity: 1, x: 0 } : {}}
                      transition={{ duration: 0.4, delay: 0.9 + i * 0.18 }}
                      className="mb-px flex items-center gap-1"
                    >
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${r.dot}`} />
                      <span className="truncate text-[8px] font-semibold text-slate-700">{r.agent}</span>
                      <span className="truncate text-[7px] text-slate-400">{r.note}</span>
                      <span className={`ml-auto shrink-0 rounded px-1 text-[7px] font-bold ${r.tone}`}>{r.status}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* ── pain -> benefit: the two halves restated as outcomes ── */}
        <div className="grid lg:grid-cols-[1fr_auto_1fr] gap-4 lg:gap-3 items-center mt-14">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid sm:grid-cols-3 gap-4">
              {PAINS.map((p, i) => (
                <motion.div key={p.title} variants={fadeUp} custom={i}
                  initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}>
                  <span className={`grid h-10 w-10 place-items-center rounded-xl ${p.tone} animate-wobble`}
                        style={{ animationDelay: `${i * 0.7}s` }}>
                    <p.Icon className="h-5 w-5" />
                  </span>
                  <p className="mt-3 text-sm font-black text-slate-900">{p.title}</p>
                  <p className="mt-1 text-xs text-slate-500 leading-snug">{p.body}</p>
                  <span className="mt-2 inline-block rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600 animate-soft-throb"
                        style={{ animationDelay: `${i * 0.4}s` }}>{p.tag}</span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* the turn */}
          <div className="hidden lg:grid place-items-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-rose-500 to-violet-600 text-white shadow-lg shadow-violet-500/30 animate-nudge-x">
              <ArrowRight className="h-5 w-5" />
            </span>
          </div>

          <div className="relative overflow-hidden rounded-3xl border border-violet-200 bg-gradient-to-br from-white to-violet-50/40 p-5 shadow-sm">
            {/* light sweep — the "alive" signal on the Orbq half */}
            <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 skew-x-12 bg-gradient-to-r from-transparent via-white/70 to-transparent animate-sheen" />
            <div className="relative grid sm:grid-cols-3 gap-4">
              {GAINS.map((g, i) => (
                <motion.div key={g.title} variants={fadeUp} custom={i}
                  initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.3 + i * 0.1 }}>
                  <span className={`grid h-10 w-10 place-items-center rounded-xl ${g.tone} animate-halo`}
                        style={{ animationDelay: `${i * 0.5}s` }}>
                    <g.Icon className="h-5 w-5" />
                  </span>
                  <p className="mt-3 text-sm font-black text-slate-900">{g.title}</p>
                  <p className="mt-1 text-xs text-slate-500 leading-snug">{g.body}</p>
                  <span className="mt-2 inline-block rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">{g.tag}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* ── trust strip ── */}
        <RevealSection className="mt-8 grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
          {TRUST_STRIP.map((t, i) => (
            <motion.div key={t.title} variants={fadeUp} custom={i}
              className={`flex items-center gap-3 ${i < 3 ? 'lg:border-r lg:border-slate-100 lg:pr-4' : ''}`}>
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${t.tone} animate-halo`}
                    style={{ animationDelay: `${i * 0.35}s` }}>
                <t.Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-black text-slate-900">{t.title}</p>
                <p className="text-[11px] text-slate-500 leading-snug">{t.body}</p>
              </div>
            </motion.div>
          ))}
        </RevealSection>
      </div>
    </section>
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
    <main className="relative min-h-screen overflow-x-hidden bg-[#FFF8F4] text-slate-900 font-sans antialiased selection:bg-rose-100 selection:text-rose-900">
      
      {/* ── Ambient Background glows (Reactive to cursor) ── */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <div 
          className="absolute rounded-full w-[600px] h-[600px] bg-gradient-to-tr from-rose-400/12 to-orange-300/8 blur-[120px] transition-transform duration-700 ease-out"
          style={{ 
            transform: `translate(${mousePos.x * 0.05}px, ${mousePos.y * 0.05}px)`, 
            top: '5%', 
            left: '10%' 
          }} 
        />
        <div 
          className="absolute rounded-full w-[500px] h-[500px] bg-gradient-to-br from-orange-300/10 to-rose-400/8 blur-[120px] transition-transform duration-700 ease-out"
          style={{ 
            transform: `translate(${mousePos.x * -0.04}px, ${mousePos.y * -0.04}px)`, 
            top: '30%', 
            right: '5%' 
          }} 
        />
        <div 
          className="absolute rounded-full w-[700px] h-[700px] bg-gradient-to-tr from-rose-400/10 to-amber-300/6 blur-[140px] transition-transform duration-700 ease-out"
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
            <img src="/orbq-logo.png" alt="Orbq Logo" className="h-16 md:h-20 object-contain transition-transform group-hover:scale-102" />
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
            <Link href="/register" className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-violet-600 px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-violet-500/15 hover:shadow-violet-500/30 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150">
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
                <span className="bg-gradient-to-r from-rose-600 via-fuchsia-600 to-violet-600 bg-clip-text text-transparent">
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
                <Link href="/login" className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-violet-600 px-7 py-4 text-base font-bold text-white shadow-lg shadow-violet-500/20 hover:shadow-violet-500/35 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200">
                  Book Live Demo
                  <ArrowRight className="h-5 w-5" />
                </Link>
                <button className="group inline-flex items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white/80 backdrop-blur-md px-7 py-4 text-base font-bold text-slate-800 transition-all hover:bg-slate-50 hover:border-slate-300">
                  <PlayCircle className="h-5 w-5 text-rose-600 transition-transform group-hover:scale-110" />
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
              <motion.div key={i} variants={fadeUp} custom={i} className="relative rounded-2xl border border-slate-200/60 bg-white p-8 shadow-sm hover:bg-violet-50 hover:border-violet-300 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                <span className={`text-4xl font-black ${item.color}`}><AnimatedCounter target={item.stat} suffix={item.suffix} /></span>
                <h3 className="mt-3 text-base font-bold text-slate-900">{item.label}</h3>
                <p className="mt-2 text-sm text-slate-500 leading-relaxed font-semibold">{item.copy}</p>
              </motion.div>
            ))}
          </RevealSection>

        </div>
      </section>

      {/* ─────────────────────────────────── 3. HOW IT WORKS (AI ENGINE) ─── */}
      <section id="builder" className="relative py-24 lg:py-32 overflow-hidden" style={{ background: 'linear-gradient(135deg, #1a0a12 0%, #2d0f1f 45%, #3b1020 100%)' }}>
        {/* Dot grid backdrop */}
        <div className="absolute inset-0 z-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(99,102,241,0.15) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        {/* Glow orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-rose-600/10 blur-3xl z-0 pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-rose-500/10 blur-3xl z-0 pointer-events-none" />

        <div className="relative z-10 mx-auto max-w-[1400px] px-6 lg:px-12">
          
          {/* Section header */}
          <div className="gsap-reveal text-center max-w-3xl mx-auto mb-16 space-y-4">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-4 py-1.5 text-xs font-bold text-rose-300 backdrop-blur-sm">
              <Workflow className="h-3.5 w-3.5" /> See It In Action
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight" style={{ fontFamily: 'Manrope, system-ui, sans-serif' }}>
              One canvas. Zero code.{' '}
              <span style={{ background: 'linear-gradient(90deg, #fdba74, #fda4af)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
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


      {/* ─────────────────────────────────── 4. 7-CHANNEL INTEGRATION BENTO GRID ─── */}
      <section id="integrations" className="relative py-20 lg:py-32 overflow-hidden bg-orange-50/60 border-y border-orange-100/60">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
          
          <RevealSection className="text-center max-w-2xl mx-auto mb-8 space-y-4">
            <motion.span variants={fadeUp} custom={0} className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 border border-rose-100 px-3.5 py-1 text-xs font-semibold text-rose-700">
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

      {/* ─────────────────────────────────── 5. THE THREE-AGENT SHOWCASE ─── */}
      <section id="agents" className="relative py-20 lg:py-32">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
          
          <RevealSection className="text-center max-w-2xl mx-auto mb-16 space-y-4">
            <motion.span variants={fadeUp} custom={0} className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 border border-rose-100 px-3.5 py-1 text-xs font-semibold text-rose-700">
              <Bot className="h-3.5 w-3.5" /> Dedicated AI Agents
            </motion.span>
            <motion.h2 variants={fadeUp} custom={1} className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight" style={{ fontFamily: 'Manrope, system-ui, sans-serif' }}>
              Four agents. One unified lifecycle.
            </motion.h2>
            <motion.p variants={fadeUp} custom={2} className="text-base text-slate-600 font-medium">
              Execution is split across four specialists — so every lead is attracted, qualified, answered on the phone, and retained without anyone chasing it manually.
            </motion.p>
          </RevealSection>

          <RevealSection className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            
            {/* Marketing Agent Card */}
            <motion.div variants={fadeUp} custom={0} className="relative rounded-3xl border border-slate-200/80 bg-white p-8 shadow-sm hover:bg-violet-50 hover:border-violet-300 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-rose-500 to-fuchsia-500 text-white shadow-md shadow-rose-500/20">
                <Megaphone className="h-6 w-6" />
              </div>
              <h3 className="mt-6 text-xl font-bold text-slate-900">Marketing AI Agent</h3>
              <p className="mt-1 font-mono text-[10px] text-rose-600 uppercase font-extrabold tracking-wide">Attracts &amp; Nurtures</p>
              <p className="mt-3 text-sm text-slate-500 leading-relaxed font-semibold">
                Generates campaigns, optimises them for search and AI answer engines, benchmarks rivals, and revives cold leads on a drip — all from your approved product guidelines.
              </p>

              {/* Capability chips — mirrors the panels shipped in the Marketing workspace */}
              <div className="mt-4 flex flex-wrap gap-1.5">
                {[
                  { label: 'Campaign Generator', Icon: Sparkles },
                  { label: 'SEO + AEO', Icon: ScanSearch },
                  { label: 'Competitor Analysis', Icon: Radar },
                ].map(({ label, Icon }) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700"
                  >
                    <Icon className="h-2.5 w-2.5" /> {label}
                  </span>
                ))}
              </div>

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

              {/* Active automations running right now */}
              <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-2.5">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Active Automations</p>
                {[
                  { label: 'Campaign Generator', meta: '4 drafts ready to review', dot: 'bg-emerald-500' },
                  { label: 'SEO / AEO Optimiser', meta: '18 pages scored today', dot: 'bg-emerald-500' },
                  { label: 'Competitor Watch', meta: '3 rivals · 2 price moves', dot: 'bg-amber-500' },
                  { label: 'Cold Lead Drip Sequence', meta: '3-step · 14 leads queued', dot: 'bg-emerald-500' },
                ].map((row) => (
                  <div key={row.label} className="flex items-start gap-2">
                    <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${row.dot}`} />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-700 truncate">{row.label}</p>
                      <p className="text-[10px] text-slate-400 font-semibold truncate">{row.meta}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Sales Agent Card (With interactive Lead Scorer) */}
            <motion.div variants={fadeUp} custom={1} className="relative rounded-3xl border border-slate-200/80 bg-white p-8 shadow-sm hover:bg-violet-50 hover:border-violet-300 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
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
            <motion.div variants={fadeUp} custom={2} className="relative rounded-3xl border border-slate-200/80 bg-white p-8 shadow-sm hover:bg-violet-50 hover:border-violet-300 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between">
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

            {/* Voice Agent Card — live-call waveform keeps it visibly "on air" */}
            <motion.div variants={fadeUp} custom={3} className="relative rounded-3xl border border-slate-200/80 bg-white p-8 shadow-sm hover:bg-violet-50 hover:border-violet-300 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between">
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-sky-500 to-cyan-400 text-white shadow-md shadow-sky-500/20">
                  <Phone className="h-6 w-6" />
                </div>
                <h3 className="mt-6 text-xl font-bold text-slate-900">Voice AI Agent</h3>
                <p className="mt-1 font-mono text-[10px] text-sky-600 uppercase font-extrabold tracking-wide">Answers &amp; Qualifies</p>
                <p className="mt-3 text-sm text-slate-500 leading-relaxed font-semibold">
                  Picks up inbound calls in real time with sub-second latency, qualifies the caller against the same rules your other agents use, then books the callback or warm-transfers to a human.
                </p>
              </div>

              {/* Live call widget */}
              <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Live Call</p>
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-sky-600">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-500 opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-sky-500" />
                    </span>
                    On air · 00:42
                  </span>
                </div>

                {/* Animated waveform */}
                <div className="flex items-center justify-center gap-[3px] h-10">
                  {[...Array(16)].map((_, i) => (
                    <span
                      key={i}
                      style={{ animationDelay: `${i * 0.07}s` }}
                      className="w-1 h-8 rounded-full bg-gradient-to-t from-sky-500 to-cyan-300 origin-center animate-waveform"
                    />
                  ))}
                </div>

                <div className="p-2 rounded bg-sky-50 border border-sky-100 text-[10px] text-sky-700 font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  Intent captured — callback booked for 4:30 PM
                </div>
              </div>
            </motion.div>

          </RevealSection>

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
                  <span className="absolute left-3.5 -translate-x-1/2 flex h-6 w-6 items-center justify-center rounded-full bg-rose-600 text-white font-mono text-[10px] font-bold shadow-md">
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
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 border border-rose-100 px-3.5 py-1 text-xs font-semibold text-rose-700">
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
              <motion.div key={i} variants={fadeUp} custom={i} className="relative rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm hover:bg-violet-50 hover:border-violet-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 text-center md:text-left">
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
            <div className="gsap-reveal rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm hover:bg-violet-50 hover:border-violet-300 hover:shadow-md transition-all duration-300">
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
            <div className="gsap-reveal rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm hover:bg-violet-50 hover:border-violet-300 hover:shadow-md transition-all duration-300">
              <h3 className="text-base font-bold text-slate-800">Lead Qualification Funnel</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5 mb-6">Where inbound conversations end up, AI-scored end to end.</p>
              <div className="space-y-4">
                {[
                  { label: 'New conversations', value: 420, color: 'bg-gradient-to-r from-sky-400 to-cyan-400' },
                  { label: 'AI-qualified', value: 268, color: 'bg-gradient-to-r from-violet-500 to-fuchsia-400' },
                  { label: 'Hot leads', value: 154, color: 'bg-gradient-to-r from-rose-500 to-orange-400' },
                  { label: 'Won / converted', value: 92, color: 'bg-gradient-to-r from-emerald-500 to-teal-400' },
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
            <div className="gsap-reveal rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm hover:bg-violet-50 hover:border-violet-300 hover:shadow-md transition-all duration-300 flex flex-col justify-between">
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

      {/* ─────────────────────────────────── 8B. WHY ORBQ WINS ─── */}
      <WhyWinsSection />

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
        <div className="gsap-reveal relative mx-auto max-w-[1100px] overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-12 sm:p-16 text-center shadow-xl shadow-slate-100 hover:bg-violet-50 hover:border-violet-300 transition-all duration-400">
          
          {/* Ambient blurred glow inside card */}
          <div className="absolute inset-0 bg-white/20 backdrop-blur-2xl z-0" />

          <div className="relative z-10 space-y-6">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-slate-200 px-3.5 py-1 text-xs font-semibold text-violet-700">
              Start Today · No Credit Card Required
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight" style={{ fontFamily: 'Manrope, system-ui, sans-serif' }}>
              Stop losing hot leads to{' '}
              <span className="bg-gradient-to-r from-rose-600 via-fuchsia-600 to-violet-600 bg-clip-text text-transparent">
                slow manual responses.
              </span>
            </h2>
            <p className="max-w-xl mx-auto text-base text-slate-600 font-medium">
              Join dozens of fast-scaling sales teams who have captured pre-qualified opportunities directly in their CRM systems.
            </p>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/register" className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-violet-600 text-white font-bold px-8 py-4 text-sm shadow-md shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all">
                Register
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="mailto:sales@orbq.ai" className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-slate-600 hover:text-slate-900 transition-colors font-bold">
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
                <img src="/orbq-logo.png" alt="Orbq Logo" className="h-16 object-contain" />
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
                <a href="#agents" className="hover:text-rose-600 transition-colors">Voice AI Agent</a>
              </div>
            </div>

            {/* Column 3: Resources */}
            <div className="space-y-3">
              <p className="text-sm font-extrabold text-slate-900 uppercase tracking-widest">Resources</p>
              <div className="flex flex-col gap-2 text-xs font-medium text-slate-500">
                <a href="#analytics" className="hover:text-rose-600 transition-colors">Funnel ROI Charts</a>
                <a href="#faq" className="hover:text-rose-600 transition-colors">General FAQs</a>
                <a href="mailto:support@orbq.ai" className="hover:text-rose-600 transition-colors">Contact Support</a>
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
            <p>© 2026 Orbq · All rights reserved.</p>
            <div className="flex items-center gap-6">
              <a href="#" className="hover:text-slate-800 transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-slate-800 transition-colors">Terms of Use</a>
              <a href="#" className="hover:text-slate-800 transition-colors">SLA Agreement</a>
            </div>
          </div>

        </div>
      </footer>

      <ChatAssistant />

    </main>
  );
}
