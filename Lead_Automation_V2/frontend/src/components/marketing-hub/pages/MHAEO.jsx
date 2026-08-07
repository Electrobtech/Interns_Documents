'use client';
import { useState } from 'react';
import { Zap, RefreshCw, MessageSquare, Brain, Eye } from 'lucide-react';
import { useMHToast } from '../ui/MHToast';
import { aeoScores } from '../mockData';

function BigRing({ score, size = 140 }) {
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 80 ? '#059669' : score >= 65 ? '#d97706' : '#dc2626';
  return (
    <svg width={size} height={size}>
      <defs>
        <linearGradient id="aeo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="50%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={10} transform={`rotate(-90 ${size/2} ${size/2})`} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="url(#aeo-grad)" strokeWidth={10}
        strokeDasharray={`${fill} ${circ - fill}`} strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`} />
      <text x="50%" y="46%" dominantBaseline="middle" textAnchor="middle" style={{ fontSize: 28, fontWeight: 800, fill: '#111827', fontFamily: 'Outfit,sans-serif' }}>{score}</text>
      <text x="50%" y="62%" dominantBaseline="middle" textAnchor="middle" style={{ fontSize: 11, fill: '#6b7280', fontWeight: 600 }}>/ 100</text>
    </svg>
  );
}

function SmallRing({ score, size = 60 }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 80 ? '#059669' : score >= 65 ? '#d97706' : '#dc2626';
  return (
    <svg width={size} height={size}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={5} transform={`rotate(-90 ${size/2} ${size/2})`} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={`${fill} ${circ - fill}`} strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`} />
      <text x="50%" y="52%" dominantBaseline="middle" textAnchor="middle" style={{ fontSize: 13, fontWeight: 700, fill: color }}>{score}</text>
    </svg>
  );
}

const PLATFORMS = [
  { name: 'ChatGPT', score: aeoScores.chatgpt, color: '#10a37f', icon: MessageSquare },
  { name: 'Gemini', score: aeoScores.gemini, color: '#4285f4', icon: Brain },
  { name: 'Claude', score: aeoScores.claude, color: '#d97706', icon: Eye },
  { name: 'Perplexity', score: aeoScores.perplexity, color: '#6366f1', icon: Zap },
];

const COVERAGE_ITEMS = [
  { label: 'Entity Coverage', value: aeoScores.entityCoverage, color: '#6366f1' },
  { label: 'FAQ Score', value: aeoScores.faqScore, color: '#10b981' },
  { label: 'Answer Quality', value: aeoScores.answerQuality, color: '#f59e0b' },
];

export default function MHAEO() {
  const toast = useMHToast();
  const [optimizing, setOptimizing] = useState(false);

  const handleOptimize = () => {
    setOptimizing(true);
    setTimeout(() => {
      setOptimizing(false);
      toast.show('AI optimization applied! Visibility score improved.', 'success');
    }, 2000);
  };

  return (
    <div style={{ padding: '24px 28px', background: 'var(--mh-bg)', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--mh-font-display)', fontSize: 22, fontWeight: 700, color: 'var(--mh-text)', margin: 0 }}>AEO Citation Engine</h1>
          <p style={{ fontSize: 13, color: 'var(--mh-text-3)', marginTop: 4 }}>Answer Engine Optimization — get cited by AI search engines</p>
        </div>
        <button className="mh-btn mh-btn-ai" onClick={handleOptimize} disabled={optimizing}>
          {optimizing ? <><RefreshCw size={14} className="mh-animate-spin" />Optimizing…</> : <><Zap size={14} />Optimize for AI</>}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Overall Score */}
        <div style={{ background: '#fff', border: '1px solid var(--mh-border)', borderRadius: 14, padding: '28px 20px', boxShadow: 'var(--mh-shadow-sm)', textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 16 }}>Overall AI Visibility</div>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <BigRing score={aeoScores.visibility} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 4 }}>
            {aeoScores.visibility >= 80 ? 'Excellent' : aeoScores.visibility >= 65 ? 'Good' : 'Needs Work'}
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 20 }}>AI citation score across all platforms</div>
          {COVERAGE_ITEMS.map(c => (
            <div key={c.label} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                <span>{c.label}</span>
                <span style={{ color: c.color }}>{c.value}%</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${c.value}%`, background: c.color }} />
              </div>
            </div>
          ))}
        </div>

        {/* Platform Scores */}
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 20 }}>
            {PLATFORMS.map(p => {
              const Icon = p.icon;
              return (
                <div key={p.name} style={{ background: '#fff', border: '1px solid var(--mh-border)', borderRadius: 14, padding: '20px', boxShadow: 'var(--mh-shadow-sm)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: p.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon size={18} style={{ color: p.color }} />
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{p.name}</div>
                    </div>
                    <SmallRing score={p.score} />
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Citation visibility score</div>
                  <div className="progress-track" style={{ height: 6 }}>
                    <div className="progress-fill" style={{ width: `${p.score}%`, background: p.color }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: '#9ca3af' }}>
                    <span>0</span>
                    <span style={{ fontWeight: 700, color: p.color }}>{p.score}/100</span>
                    <span>100</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tips Panel */}
          <div style={{ background: 'linear-gradient(135deg,rgba(168,85,247,0.06),rgba(99,102,241,0.06))', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 14, padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Zap size={16} style={{ color: '#a855f7' }} />
              <div style={{ fontFamily: 'var(--mh-font-display)', fontSize: 15, fontWeight: 700, color: '#111827' }}>Optimization Tips</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              {[
                { t: 'Add Structured FAQs', d: 'Include 10+ Q&A pairs with direct, concise answers on key product pages.', icon: '❓' },
                { t: 'Strengthen Entity Signals', d: 'Ensure your brand, founders, and products are well-documented on authoritative sources.', icon: '🏷️' },
                { t: 'Improve Answer Depth', d: 'Rewrite top-10 landing pages with comprehensive, authoritative content that AI can cite.', icon: '📝' },
              ].map((tip, i) => (
                <div key={i} style={{ background: '#fff', borderRadius: 10, padding: 14, border: '1px solid var(--mh-border)' }}>
                  <div style={{ fontSize: 20, marginBottom: 8 }}>{tip.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 4 }}>{tip.t}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>{tip.d}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
