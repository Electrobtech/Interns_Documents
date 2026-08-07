'use client';
import { useState } from 'react';
import { Sparkles, Copy, RefreshCw, ChevronDown, FileText, MessageSquare, Mail, Megaphone, Hash } from 'lucide-react';
import { useMHToast } from '../ui/MHToast';
import { useGenerateContent } from '@/lib/queries/marketingHub';

const TABS = [
  { id: 'social', label: 'Social Post', icon: Hash },
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'ad', label: 'Ad Copy', icon: Megaphone },
  { id: 'blog', label: 'Blog Outline', icon: FileText },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
];

const CAMPAIGN_TYPES = ['Lead Generation', 'Brand Awareness', 'Product Launch', 'Event Promotion', 'Retargeting', 'Webinar'];
const INDUSTRIES = ['EdTech', 'SaaS', 'E-commerce', 'Healthcare', 'Finance', 'Real Estate'];
const GOALS = ['Drive Sign-ups', 'Generate Leads', 'Increase Awareness', 'Boost Sales', 'Event Registrations', 'App Downloads'];

const GENERATED_SAMPLES = {
  social: `🚀 Transform your marketing with AI — in just 30 days.

Our platform has helped 500+ businesses:
✅ 3x their lead generation
✅ Cut ad spend by 40%
✅ Automate 80% of campaigns

Ready to see the difference? 👇
[Link in bio]

#AIMarketing #LeadGeneration #MarketingAutomation #DigitalMarketing #GrowthHacking`,
  email: `Subject: [First Name], your competitors are already using this…

Hi [First Name],

Did you know that 73% of top-performing marketing teams now use AI to automate their campaigns?

Here's what they're doing differently:
• Running 10x more A/B tests automatically
• Personalizing every touchpoint at scale
• Predicting lead scores with 94% accuracy

The result? 3x more qualified leads at half the cost.

We'd love to show you exactly how. Book a 20-minute demo this week and get a free campaign audit.

[CTA: Book My Demo →]

Best,
The Marketing Team`,
  ad: `Headline 1: AI-Powered Leads, 3x Faster
Headline 2: Cut Ad Spend by 40% with AI
Headline 3: 500+ Brands Trust Our Platform

Description 1: Stop guessing. Let AI optimize every campaign in real-time. Start free today.
Description 2: From awareness to conversion — automate your entire marketing funnel with AI.

CTA: Start Free Trial`,
  blog: `Title: How AI is Revolutionizing Lead Generation in 2025

Introduction
- The shift from manual to AI-driven marketing
- Key stats: AI adoption rates in marketing teams

Section 1: Understanding AI-Powered Lead Scoring
- What is predictive lead scoring?
- How AI analyzes behavioral signals
- Case study: 40% improvement in conversion rates

Section 2: Automating Campaign Optimization
- Real-time bid adjustments
- Dynamic creative optimization
- Budget reallocation strategies

Section 3: Personalization at Scale
- Hyper-personalized messaging
- Multi-channel orchestration
- WhatsApp + Email + Ads synergy

Section 4: Measuring AI Marketing ROI
- Key metrics to track
- Attribution models
- Reporting frameworks

Conclusion & CTA
- Summary of key takeaways
- Next steps for implementation`,
  whatsapp: `Hi [Name] 👋

Quick question — are you still struggling to convert leads into customers?

We've helped 500+ businesses like yours:
📈 3x their lead conversion
⚡ Automate follow-ups 24/7
💰 Reduce cost per lead by 60%

Here's a quick 2-min video showing exactly how: [Link]

Want me to send you a free audit of your current campaigns? Just reply YES 🙂`,
};

const RECENT_GENERATIONS = [
  { id: 1, type: 'Social Post', title: 'AI Bootcamp Launch Post', time: '2 hours ago', score: 94 },
  { id: 2, type: 'Email', title: 'Welcome Series — Lead Magnet', time: '5 hours ago', score: 88 },
  { id: 3, type: 'Ad Copy', title: 'Google Ads — B2B SaaS', time: 'Yesterday', score: 91 },
  { id: 4, type: 'WhatsApp', title: 'Flash Sale Announcement', time: '2 days ago', score: 86 },
];

export default function MHContentStudio() {
  const toast = useMHToast();
  const generateContent = useGenerateContent();
  const [activeTab, setActiveTab] = useState('social');
  const [campaignType, setCampaignType] = useState('Lead Generation');
  const [industry, setIndustry] = useState('EdTech');
  const [goal, setGoal] = useState('Drive Sign-ups');
  const [details, setDetails] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(null);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const contentMap = {
        social: 'social_post',
        email: 'email',
        ad: 'ad_copy',
        blog: 'blog_outline',
        whatsapp: 'whatsapp_message'
      };
      
      const result = await generateContent.mutateAsync({
        content_type: contentMap[activeTab],
        channel: activeTab === 'ad' ? 'ads' : activeTab,
        ai_prompt: `Generate ${activeTab} content for ${campaignType} in ${industry} industry. Goal: ${goal}. Additional details: ${details}`,
        context: {
          campaign_type: campaignType,
          industry: industry,
          goal: goal,
          details: details
        }
      });
      
      setGenerated(result.content || result.generated_content || JSON.stringify(result));
      toast.show('Content generated successfully!', 'success');
    } catch (error) {
      console.error('Generation failed:', error);
      toast.show('Failed to generate content. Please try again.', 'error');
      // Fallback to sample on error
      setGenerated(GENERATED_SAMPLES[activeTab]);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard?.writeText(generated || '');
    toast.show('Copied to clipboard!', 'success');
  };

  return (
    <div style={{ padding: '24px 28px', background: 'var(--mh-bg)', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--mh-font-display)', fontSize: 22, fontWeight: 700, color: 'var(--mh-text)', margin: 0 }}>Content Studio</h1>
        <p style={{ fontSize: 13, color: 'var(--mh-text-3)', marginTop: 4 }}>Generate high-converting marketing content with AI</p>
      </div>

      {/* Tab Bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--mh-border)', marginBottom: 24, gap: 0, background: '#fff', borderRadius: '14px 14px 0 0', padding: '0 4px', boxShadow: 'var(--mh-shadow-sm)' }}>
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => { setActiveTab(t.id); setGenerated(null); }}
              className="mh-subtab" style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              data-active={activeTab === t.id}
              style={{ padding: '12px 18px', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', borderBottom: `2px solid ${activeTab === t.id ? '#6366f1' : 'transparent'}`, color: activeTab === t.id ? '#6366f1' : '#6b7280', fontWeight: activeTab === t.id ? 600 : 400, display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
              <Icon size={14} />{t.label}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
        {/* Left: Form */}
        <div style={{ background: '#fff', border: '1px solid var(--mh-border)', borderRadius: 14, padding: '24px', boxShadow: 'var(--mh-shadow-sm)' }}>
          <div style={{ fontFamily: 'var(--mh-font-display)', fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 20 }}>Content Settings</div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6b7280', display: 'block', marginBottom: 6 }}>Campaign Type</label>
            <div style={{ position: 'relative' }}>
              <select className="mh-input" value={campaignType} onChange={e => setCampaignType(e.target.value)} style={{ width: '100%', appearance: 'none', paddingRight: 28 }}>
                {CAMPAIGN_TYPES.map(c => <option key={c}>{c}</option>)}
              </select>
              <ChevronDown size={13} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#9ca3af' }} />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6b7280', display: 'block', marginBottom: 6 }}>Industry</label>
            <div style={{ position: 'relative' }}>
              <select className="mh-input" value={industry} onChange={e => setIndustry(e.target.value)} style={{ width: '100%', appearance: 'none', paddingRight: 28 }}>
                {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
              </select>
              <ChevronDown size={13} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#9ca3af' }} />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6b7280', display: 'block', marginBottom: 6 }}>Goal</label>
            <div style={{ position: 'relative' }}>
              <select className="mh-input" value={goal} onChange={e => setGoal(e.target.value)} style={{ width: '100%', appearance: 'none', paddingRight: 28 }}>
                {GOALS.map(g => <option key={g}>{g}</option>)}
              </select>
              <ChevronDown size={13} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#9ca3af' }} />
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6b7280', display: 'block', marginBottom: 6 }}>Extra Details</label>
            <textarea className="mh-input" value={details} onChange={e => setDetails(e.target.value)}
              placeholder="Describe your product, target audience, tone, or any specific requirements…"
              style={{ width: '100%', minHeight: 100, resize: 'vertical', lineHeight: 1.6 }} />
          </div>

          <button className="mh-btn mh-btn-ai" onClick={handleGenerate} disabled={generating}
            style={{ width: '100%', justifyContent: 'center', fontSize: 14, padding: '11px 20px', opacity: generating ? 0.8 : 1 }}>
            {generating ? <><RefreshCw size={15} className="mh-animate-spin" /> Generating…</> : <><Sparkles size={15} /> Generate with AI</>}
          </button>
        </div>

        {/* Right: Preview */}
        <div>
          <div style={{ background: '#fff', border: '1px solid var(--mh-border)', borderRadius: 14, padding: '24px', boxShadow: 'var(--mh-shadow-sm)', minHeight: 320 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontFamily: 'var(--mh-font-display)', fontSize: 15, fontWeight: 700, color: '#111827' }}>Generated Content</div>
              {generated && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="mh-btn mh-btn-ghost" style={{ fontSize: 12 }} onClick={handleCopy}><Copy size={13} /> Copy</button>
                  <button className="mh-btn mh-btn-ghost" style={{ fontSize: 12 }} onClick={handleGenerate}><RefreshCw size={13} /> Regenerate</button>
                </div>
              )}
            </div>
            {!generated && !generating && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 220, color: '#9ca3af', gap: 12 }}>
                <Sparkles size={36} style={{ color: '#e5e7eb' }} />
                <div style={{ fontSize: 13 }}>Fill in the settings and click Generate with AI</div>
              </div>
            )}
            {generating && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 220, gap: 12 }}>
                <div className="mh-skeleton" style={{ width: '100%', height: 16, marginBottom: 6 }} />
                <div className="mh-skeleton" style={{ width: '90%', height: 16, marginBottom: 6 }} />
                <div className="mh-skeleton" style={{ width: '80%', height: 16, marginBottom: 6 }} />
                <div className="mh-skeleton" style={{ width: '85%', height: 16, marginBottom: 6 }} />
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>AI is crafting your content…</div>
              </div>
            )}
            {generated && !generating && (
              <pre style={{ fontFamily: 'var(--mh-font-body)', fontSize: 13, color: '#374151', whiteSpace: 'pre-wrap', lineHeight: 1.7, margin: 0, background: '#f9fafb', borderRadius: 10, padding: 16, border: '1px solid #f3f4f6', maxHeight: 400, overflow: 'auto' }}>{generated}</pre>
            )}
          </div>
        </div>
      </div>

      {/* Recent Generations */}
      <div style={{ marginTop: 24, background: '#fff', border: '1px solid var(--mh-border)', borderRadius: 14, boxShadow: 'var(--mh-shadow-sm)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
          <div style={{ fontFamily: 'var(--mh-font-display)', fontSize: 15, fontWeight: 700, color: '#111827' }}>Recent Generations</div>
        </div>
        <div style={{ padding: '8px 0' }}>
          {RECENT_GENERATIONS.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 20px', borderBottom: '1px solid #f9fafb', cursor: 'pointer', transition: 'background 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'} onMouseLeave={e => e.currentTarget.style.background = ''}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileText size={16} style={{ color: '#6366f1' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{r.title}</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{r.type} · {r.time}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#059669' }}>Score {r.score}</span>
                <button className="mh-btn mh-btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => toast.show(`Loading ${r.title}`, 'info')}>View</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
