'use client';
import { useState } from 'react';
import { Save, Plus, Check, Link2, Zap, ShieldCheck, X } from 'lucide-react';
import MHBadge from '../ui/MHBadge';
import MHModal from '../ui/MHModal';
import { useMHToast } from '../ui/MHToast';
import { teamMembers as initialTeamMembers } from '../mockData';
import {
  useSandboxSetting, useSetSandboxSetting,
  useIntegrationsList, useConnectIntegration, useDisconnectIntegration,
} from '@/lib/queries/marketingHub';

const TABS = ['General', 'Team', 'Integrations', 'Notifications', 'AI Config'];

const INTEGRATIONS = [
  { id: 1, name: 'Facebook Ads', desc: 'Sync campaigns and audience data', icon: '📘', connected: true, color: '#1877f2' },
  { id: 2, name: 'Google Ads', desc: 'Import keywords, bids, and performance', icon: '🔍', connected: true, color: '#4285f4' },
  { id: 3, name: 'LinkedIn Ads', desc: 'B2B lead gen and sponsored content', icon: '💼', connected: false, color: '#0077b5' },
  { id: 4, name: 'WhatsApp Business', desc: 'Send automated messages and broadcasts', icon: '💬', connected: true, color: '#25d366' },
  { id: 5, name: 'Email (SMTP)', desc: 'Send transactional and marketing emails', icon: '📧', connected: false, color: '#6366f1' },
];

const ROLE_OPTIONS = ['Admin', 'Marketing Manager', 'Campaign Specialist', 'Content Strategist', 'SEO Analyst', 'Designer', 'Viewer'];

function GeneralTab({ toast }) {
  const [form, setForm] = useState({ workspace: 'Acme Marketing', timezone: 'Asia/Kolkata', language: 'English', currency: 'INR (₹)' });
  const upd = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const fields = [
    { key: 'workspace', label: 'Workspace Name', type: 'text' },
    { key: 'timezone', label: 'Timezone', type: 'select', opts: ['Asia/Kolkata', 'Asia/Dubai', 'UTC', 'America/New_York', 'Europe/London'] },
    { key: 'language', label: 'Language', type: 'select', opts: ['English', 'Hindi', 'Tamil', 'Telugu', 'Marathi'] },
    { key: 'currency', label: 'Currency', type: 'select', opts: ['INR (₹)', 'USD ($)', 'EUR (€)', 'GBP (£)'] },
  ];
  return (
    <div style={{ maxWidth: 520 }}>
      <div style={{ fontFamily: 'var(--mh-font-display)', fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 20 }}>General Settings</div>
      {fields.map(f => (
        <div key={f.key} style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6b7280', display: 'block', marginBottom: 6 }}>{f.label}</label>
          {f.type === 'text'
            ? <input className="mh-input" value={form[f.key]} onChange={e => upd(f.key, e.target.value)} style={{ width: '100%' }} />
            : <select className="mh-input" value={form[f.key]} onChange={e => upd(f.key, e.target.value)} style={{ width: '100%' }}>
                {f.opts.map(o => <option key={o}>{o}</option>)}
              </select>
          }
        </div>
      ))}
      <button className="mh-btn mh-btn-primary" onClick={() => toast.show('Settings saved successfully!', 'success')}>
        <Save size={14} /> Save Changes
      </button>
    </div>
  );
}

function InviteMemberModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Marketing Manager');

  const submit = () => {
    if (!name.trim() || !email.trim()) return;
    const initials = name.trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();
    onCreated({ id: String(Date.now()), name: name.trim(), email: email.trim(), role, status: 'Invited', avatar: initials || '??' });
    onClose();
  };

  return (
    <MHModal title="Invite Team Member" onClose={onClose} width={440}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Name <span style={{ color: '#dc2626' }}>*</span></label>
          <input className="mh-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Karan Mehta" />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Email <span style={{ color: '#dc2626' }}>*</span></label>
          <input className="mh-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="karan@acme.io" />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Role</label>
          <select className="mh-input" value={role} onChange={e => setRole(e.target.value)}>
            {ROLE_OPTIONS.map(r => <option key={r}>{r}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 22, paddingTop: 16, borderTop: '1px solid #f3f4f6' }}>
        <button className="mh-btn mh-btn-ghost" onClick={onClose}>Cancel</button>
        <button className="mh-btn mh-btn-primary" disabled={!name.trim() || !email.trim()} style={{ opacity: name.trim() && email.trim() ? 1 : 0.5 }} onClick={submit}>Send Invite</button>
      </div>
    </MHModal>
  );
}

function TeamTab({ toast }) {
  const [teamMembers, setTeamMembers] = useState(initialTeamMembers);
  const [showInvite, setShowInvite] = useState(false);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontFamily: 'var(--mh-font-display)', fontSize: 15, fontWeight: 700, color: '#111827' }}>Team Members</div>
        <button className="mh-btn mh-btn-primary" onClick={() => setShowInvite(true)}><Plus size={14} /> Invite Member</button>
      </div>
      <div style={{ background: '#fff', border: '1px solid var(--mh-border)', borderRadius: 14, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              {['MEMBER', 'EMAIL', 'ROLE', 'STATUS', ''].map(h => (
                <th key={h} style={{ textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', padding: '10px 14px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {teamMembers.map(m => (
              <tr key={m.id} style={{ borderBottom: '1px solid #f3f4f6' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                onMouseLeave={e => e.currentTarget.style.background = ''}>
                <td style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#6366f1' }}>{m.avatar}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{m.name}</div>
                  </div>
                </td>
                <td style={{ padding: '12px 14px', fontSize: 13, color: '#6b7280' }}>{m.email}</td>
                <td style={{ padding: '12px 14px' }}>
                  <select style={{ fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, padding: '4px 8px', background: '#fff', color: '#374151', cursor: 'pointer' }} defaultValue={m.role}>
                    {ROLE_OPTIONS.map(r => <option key={r}>{r}</option>)}
                  </select>
                </td>
                <td style={{ padding: '12px 14px' }}><MHBadge label={m.status} variant={m.status === 'Active' ? 'active' : 'warning'} dot /></td>
                <td style={{ padding: '12px 14px' }}>
                  <button className="mh-btn mh-btn-ghost" style={{ fontSize: 11, padding: '3px 10px', color: '#dc2626', borderColor: '#fee2e2' }} onClick={() => toast.show(`Removing ${m.name}`, 'error')}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showInvite && (
        <InviteMemberModal
          onClose={() => setShowInvite(false)}
          onCreated={(m) => { setTeamMembers(prev => [...prev, m]); toast.show(`Invite sent to ${m.email}`, 'success'); }}
        />
      )}
    </div>
  );
}

function ConnectIntegrationModal({ integration, onClose, toast }) {
  const [apiKey, setApiKey] = useState('');
  const connect = useConnectIntegration();

  const submit = async () => {
    if (!apiKey.trim()) return;
    try {
      await connect.mutateAsync({
        provider: integration.name, service_type: 'messaging',
        credentials: { api_key: apiKey.trim() }, status: 'active',
      });
      toast.show(`${integration.name} connected — saved to your workspace.`, 'success');
      onClose();
    } catch (err) {
      toast.show(err.message || 'Could not save credentials', 'error');
    }
  };

  return (
    <MHModal title={`Connect ${integration.name}`} onClose={onClose} width={440}>
      <p style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.6, marginBottom: 14 }}>
        This saves a real credential record for your workspace. Actual message delivery on this
        channel keeps running through Sandbox Mode until the corresponding provider file is wired
        to the live {integration.name} API — this step alone doesn't change what happens when a
        campaign sends.
      </p>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>API Key / Access Token</label>
      <input className="mh-input" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Paste key…" style={{ width: '100%' }} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 22, paddingTop: 16, borderTop: '1px solid #f3f4f6' }}>
        <button className="mh-btn mh-btn-ghost" onClick={onClose}>Cancel</button>
        <button className="mh-btn mh-btn-primary" disabled={!apiKey.trim() || connect.isPending} onClick={submit}>
          {connect.isPending ? 'Saving…' : 'Save & Connect'}
        </button>
      </div>
    </MHModal>
  );
}

function IntegrationsTab({ toast }) {
  const { data: integrations = [], isLoading } = useIntegrationsList();
  const disconnect = useDisconnectIntegration();
  const [connecting, setConnecting] = useState(null);

  const rowFor = (i) => integrations.find((r) =>
    r.provider?.toLowerCase().includes(i.name.toLowerCase().split(' ')[0].toLowerCase())
  );

  return (
    <div>
      <div style={{ fontFamily: 'var(--mh-font-display)', fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 20 }}>Integrations</div>
      {isLoading ? (
        <p style={{ fontSize: 12, color: '#9ca3af' }}>Loading…</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {INTEGRATIONS.map((i) => {
            const row = rowFor(i);
            const isConnected = row?.status === 'active';
            return (
              <div key={i.id} style={{ background: '#fff', border: `1px solid ${isConnected ? i.color + '40' : 'var(--mh-border)'}`, borderRadius: 14, padding: '18px', boxShadow: 'var(--mh-shadow-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <div style={{ fontSize: 28 }}>{i.icon}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{i.name}</div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>{i.desc}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  {isConnected
                    ? <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: '#059669' }}><Check size={13} /> Connected</span>
                    : <span style={{ fontSize: 12, color: '#9ca3af' }}>Not connected</span>}
                  <button
                    style={{ fontSize: 12, padding: '5px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, background: isConnected ? '#fee2e2' : i.color, color: isConnected ? '#dc2626' : '#fff', transition: 'opacity 0.15s' }}
                    onClick={() => {
                      if (isConnected) {
                        disconnect.mutate(row.id, { onSuccess: () => toast.show(`${i.name} disconnected`, 'info') });
                      } else {
                        setConnecting(i);
                      }
                    }}>
                    {isConnected ? 'Disconnect' : <><Link2 size={12} style={{ display: 'inline', marginRight: 4 }} />Connect</>}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {connecting && <ConnectIntegrationModal integration={connecting} onClose={() => setConnecting(null)} toast={toast} />}
    </div>
  );
}

function SandboxBanner() {
  const { data, isLoading } = useSandboxSetting();
  const setSandbox = useSetSandboxSetting();
  const enabled = data?.enabled?.value !== false; // default true (sandbox on) until explicitly turned off

  const toggle = () => {
    setSandbox.mutate({
      key: 'enabled', value: !enabled,
      description: 'When true, all campaign/broadcast sends use the built-in delivery simulator instead of live channel APIs.',
    });
  };

  if (isLoading) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, background: enabled ? '#eff6ff' : '#fef2f2', border: `1px solid ${enabled ? '#bfdbfe' : '#fecaca'}`, borderRadius: 12, padding: '14px 18px', marginBottom: 24 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <ShieldCheck size={16} color={enabled ? '#2563eb' : '#dc2626'} style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: enabled ? '#1e3a8a' : '#7f1d1d' }}>
            Sandbox Mode {enabled ? 'On' : 'Off'}
          </div>
          <div style={{ fontSize: 12, color: enabled ? '#1e40af' : '#991b1b', lineHeight: 1.6, marginTop: 2, maxWidth: 560 }}>
            {enabled
              ? 'No live WhatsApp/Meta/LinkedIn/SMS credentials are connected, so every campaign and broadcast send is simulated: realistic timing, delivery/read/reply rates, and occasional failures — all written to real records in this database, nothing posted externally. Connect a channel below to move it off Sandbox.'
              : 'Sandbox Mode is turned off. Sends will still use the simulator for any channel without connected live credentials — this flag is informational only until a real provider is wired in.'}
          </div>
        </div>
      </div>
      <button className="mh-btn mh-btn-ghost" style={{ flexShrink: 0, background: '#fff', fontSize: 11 }} onClick={toggle} disabled={setSandbox.isPending}>
        {enabled ? 'Acknowledge' : 'Re-enable'}
      </button>
    </div>
  );
}

function NotificationsTab({ toast }) {
  const [prefs, setPrefs] = useState({
    campaignAlerts: true, leadNotifications: true, weeklyReport: true, aiInsights: true, billingAlerts: false,
  });
  return (
    <div style={{ maxWidth: 520 }}>
      <div style={{ fontFamily: 'var(--mh-font-display)', fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 20 }}>Notification Preferences</div>
      {[
        { key: 'campaignAlerts', label: 'Campaign Performance Alerts', desc: 'Get notified when campaign metrics drop below thresholds' },
        { key: 'leadNotifications', label: 'New Lead Notifications', desc: 'Real-time alerts for high-quality new leads' },
        { key: 'weeklyReport', label: 'Weekly Summary Report', desc: 'Automated weekly digest every Monday morning' },
        { key: 'aiInsights', label: 'AI Insights & Recommendations', desc: 'Proactive AI-driven optimization suggestions' },
        { key: 'billingAlerts', label: 'Billing & Budget Alerts', desc: 'Notify when ad budgets hit 80% and 100%' },
      ].map(n => (
        <div key={n.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid #f3f4f6' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{n.label}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{n.desc}</div>
          </div>
          <div
            onClick={() => { setPrefs(p => ({ ...p, [n.key]: !p[n.key] })); toast.show(`${n.label} ${prefs[n.key] ? 'disabled' : 'enabled'}`, 'info'); }}
            style={{ width: 42, height: 24, borderRadius: 99, background: prefs[n.key] ? '#6366f1' : '#e5e7eb', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
            <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: prefs[n.key] ? 21 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
          </div>
        </div>
      ))}
      <button className="mh-btn mh-btn-primary" style={{ marginTop: 20 }} onClick={() => toast.show('Notification preferences saved!', 'success')}>
        <Save size={14} /> Save Preferences
      </button>
    </div>
  );
}

function AIConfigTab({ toast }) {
  const [config, setConfig] = useState({ model: 'GPT-4o', creativity: 70, tone: 'Professional', language: 'English', autoOptimize: true });
  return (
    <div style={{ maxWidth: 520 }}>
      <div style={{ fontFamily: 'var(--mh-font-display)', fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 20 }}>AI Configuration</div>
      <div style={{ marginBottom: 18 }}>
        <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6b7280', display: 'block', marginBottom: 6 }}>AI Model</label>
        <select className="mh-input" value={config.model} onChange={e => setConfig(p => ({ ...p, model: e.target.value }))} style={{ width: '100%' }}>
          {['GPT-4o', 'GPT-4 Turbo', 'Claude 3.5 Sonnet', 'Gemini 1.5 Pro'].map(m => <option key={m}>{m}</option>)}
        </select>
      </div>
      <div style={{ marginBottom: 18 }}>
        <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6b7280', display: 'block', marginBottom: 6 }}>Creativity Level — {config.creativity}%</label>
        <input type="range" min={0} max={100} value={config.creativity} onChange={e => setConfig(p => ({ ...p, creativity: +e.target.value }))} style={{ width: '100%', accentColor: '#6366f1' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
          <span>Conservative</span><span>Balanced</span><span>Creative</span>
        </div>
      </div>
      <div style={{ marginBottom: 18 }}>
        <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6b7280', display: 'block', marginBottom: 6 }}>Default Tone</label>
        <select className="mh-input" value={config.tone} onChange={e => setConfig(p => ({ ...p, tone: e.target.value }))} style={{ width: '100%' }}>
          {['Professional', 'Conversational', 'Formal', 'Persuasive', 'Friendly'].map(t => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid #f3f4f6', marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Auto-Optimize Campaigns</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Let AI automatically adjust bids and budgets based on performance</div>
        </div>
        <div onClick={() => setConfig(p => ({ ...p, autoOptimize: !p.autoOptimize }))}
          style={{ width: 42, height: 24, borderRadius: 99, background: config.autoOptimize ? '#6366f1' : '#e5e7eb', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
          <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: config.autoOptimize ? 21 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
        </div>
      </div>
      <button className="mh-btn mh-btn-ai" onClick={() => toast.show('AI configuration updated!', 'success')}>
        <Zap size={14} /> Save AI Config
      </button>
    </div>
  );
}

export default function MHSettings() {
  const toast = useMHToast();
  const [activeTab, setActiveTab] = useState('General');

  return (
    <div style={{ padding: '24px 28px', background: 'var(--mh-bg)', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--mh-font-display)', fontSize: 22, fontWeight: 700, color: 'var(--mh-text)', margin: 0 }}>Settings</h1>
        <p style={{ fontSize: 13, color: 'var(--mh-text-3)', marginTop: 4 }}>Manage workspace, team, and integrations</p>
      </div>

      {/* Tab Bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--mh-border)', marginBottom: 24, gap: 0 }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            style={{
              padding: '11px 20px', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: `2px solid ${activeTab === t ? '#6366f1' : 'transparent'}`,
              color: activeTab === t ? '#6366f1' : '#6b7280', fontWeight: activeTab === t ? 600 : 400,
              transition: 'color 0.15s', whiteSpace: 'nowrap',
            }}>
            {t}
          </button>
        ))}
      </div>

      {activeTab === 'General' && <SandboxBanner />}

      {/* Tab Content */}
      <div style={{ background: '#fff', border: '1px solid var(--mh-border)', borderRadius: 14, padding: '24px', boxShadow: 'var(--mh-shadow-sm)' }}>
        {activeTab === 'General' && <GeneralTab toast={toast} />}
        {activeTab === 'Team' && <TeamTab toast={toast} />}
        {activeTab === 'Integrations' && <IntegrationsTab toast={toast} />}
        {activeTab === 'Notifications' && <NotificationsTab toast={toast} />}
        {activeTab === 'AI Config' && <AIConfigTab toast={toast} />}
      </div>
    </div>
  );
}
