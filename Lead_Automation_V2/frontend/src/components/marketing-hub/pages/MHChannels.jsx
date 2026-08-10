'use client';
import { useState } from 'react';
import {
  Plus, Filter, Calendar, ChevronDown, AlertCircle, Info, Settings as SettingsIcon,
  Ban, Send, Radio, Mail, MessageCircle, MessageSquare, Instagram, Linkedin,
} from 'lucide-react';
import MHBadge from '../ui/MHBadge';
import { useMHToast } from '../ui/MHToast';
import { channels } from '../mockData';
import { useChannelStats, useIntegrationsList } from '@/lib/queries/marketingHub';
import { setPrefillChannel } from '../prefill';

const CHANNEL_ICONS = {
  whatsapp: MessageCircle,
  email: Mail,
  sms: MessageSquare,
  messenger: Send,
  instagram: Instagram,
  linkedin: Linkedin,
};

// mh_integrations.provider is a free-text string set by whoever connected
// it — match loosely against the channel id/name rather than assuming an
// exact value.
function realStatusFor(channelId, channelName, integrations) {
  const match = integrations?.find((i) =>
    i.provider?.toLowerCase().includes(channelId) || channelName.toLowerCase().includes(i.provider?.toLowerCase() || '__none__')
  );
  if (!match) return 'not_connected';
  return match.status === 'active' ? 'connected' : match.status === 'error' ? 'error' : 'not_connected';
}

function ChannelCard({ ch, toast, stats, integrations, onNavigate }) {
  const Icon = CHANNEL_ICONS[ch.id] || MessageCircle;
  const campaignCount = stats?.[ch.id]?.campaigns ?? 0;
  const broadcastCount = stats?.[ch.id]?.broadcasts ?? 0;
  const supportsBroadcast = ch.broadcastsSupported !== false;

  // Real status: no fabricated "Connected" — every channel is genuinely
  // Not Connected until a real mh_integrations row exists for it (see
  // Settings → Integrations to add one). This replaces the old mock
  // `ch.status`, which always claimed 5 of 6 channels were live.
  const realStatus = realStatusFor(ch.id, ch.name, integrations);
  const statusVariant = realStatus === 'connected' ? 'active' : realStatus === 'error' ? 'danger' : 'default';
  const statusLabel = realStatus === 'connected' ? 'Connected' : realStatus === 'error' ? 'Connection Error' : 'Not Connected';

  const goCreateCampaign = () => {
    setPrefillChannel(ch.id);
    onNavigate?.('campaigns');
  };
  const goCreateBroadcast = () => {
    if (!supportsBroadcast) return;
    setPrefillChannel(ch.id);
    onNavigate?.('broadcasts');
  };

  return (
    <div className="mh-card" style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: ch.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={21} color={ch.color} />
          </div>
          <div style={{ fontFamily: 'var(--mh-font-display)', fontWeight: 700, fontSize: 15, color: 'var(--mh-text)' }}>{ch.name}</div>
        </div>
        <MHBadge label={statusLabel} variant={statusVariant} dot />
      </div>

      <p style={{ fontSize: 12.5, color: 'var(--mh-text-3)', lineHeight: 1.6, margin: '0 0 16px' }}>{ch.description}</p>

      <div style={{ display: 'flex', gap: 28, paddingTop: 14, borderTop: '1px solid #f3f4f6', marginBottom: ch.broadcastsSupported === 'limited' ? 12 : 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--mh-text-3)', marginBottom: 3 }}>
            <Send size={11} color={ch.color} /> Campaigns
          </div>
          <div style={{ fontFamily: 'var(--mh-font-display)', fontSize: 20, fontWeight: 700, color: 'var(--mh-text)' }}>{campaignCount}</div>
          <div style={{ fontSize: 10, color: 'var(--mh-text-4)' }}>Real campaigns on this channel</div>
        </div>

        {supportsBroadcast ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--mh-text-3)', marginBottom: 3 }}>
              <Radio size={11} color={ch.color} /> Broadcasts
            </div>
            <div style={{ fontFamily: 'var(--mh-font-display)', fontSize: 20, fontWeight: 700, color: 'var(--mh-text)' }}>{broadcastCount}</div>
            <div style={{ fontSize: 10, color: 'var(--mh-text-4)' }}>Real broadcasts on this channel</div>
          </div>
        ) : (
          <div style={{ maxWidth: 170 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--mh-text-3)', marginBottom: 3 }}>
              <Radio size={11} color="#d1d5db" /> Broadcasts
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--mh-text-4)' }}>Not Supported</div>
            <div style={{ fontSize: 10, color: 'var(--mh-text-4)', lineHeight: 1.4, marginTop: 2 }}>{ch.name} does not support bulk broadcasts.</div>
          </div>
        )}
      </div>



      <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
        <button
          className="mh-btn"
          style={{ flex: 1, justifyContent: 'center', background: '#fff', border: `1px solid ${ch.color}55`, color: ch.color, padding: '8px 12px' }}
          onClick={goCreateCampaign}
        >
          <Plus size={13} /> Create Campaign
        </button>
        <button
          className="mh-btn"
          disabled={!supportsBroadcast}
          style={{
            flex: 1, justifyContent: 'center', padding: '8px 12px',
            background: supportsBroadcast ? ch.color : '#f3f4f6',
            color: supportsBroadcast ? '#fff' : '#9ca3af',
            cursor: supportsBroadcast ? 'pointer' : 'not-allowed',
          }}
          onClick={goCreateBroadcast}
        >
          {supportsBroadcast ? <Plus size={13} /> : <Ban size={13} />} Create Broadcast
        </button>
      </div>
    </div>
  );
}

export default function MHChannels({ onNavigate }) {
  const toast = useMHToast();
  const [dateOpen, setDateOpen] = useState(false);
  const [rangeLabel, setRangeLabel] = useState('Last 30 days');
  const RANGE_DAYS = { 'Last 7 days': 7, 'Last 30 days': 30, 'Last 90 days': 90, 'All time': null };
  const { data: stats } = useChannelStats(RANGE_DAYS[rangeLabel]);
  const { data: integrations = [] } = useIntegrationsList();

  return (
    <div style={{ padding: '24px 28px', background: 'var(--mh-bg)', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--mh-font-display)', fontSize: 22, fontWeight: 700, color: 'var(--mh-text)', margin: 0 }}>Channels</h1>
          <p style={{ fontSize: 13, color: 'var(--mh-text-3)', marginTop: 4 }}>Real campaign/broadcast counts per channel. Click a card's buttons to jump straight into that channel's wizard.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <button
              className="mh-btn mh-btn-ghost"
              onClick={() => setDateOpen(o => !o)}
              style={{ gap: 8 }}
            >
              <Calendar size={13} /> {rangeLabel} <ChevronDown size={13} />
            </button>
            {dateOpen && (
              <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, width: 200, background: '#fff', border: '1px solid var(--mh-border)', borderRadius: 10, boxShadow: 'var(--mh-shadow-lg)', zIndex: 50, padding: '6px 0' }}>
                {Object.keys(RANGE_DAYS).map(opt => (
                  <button key={opt} onClick={() => { setDateOpen(false); setRangeLabel(opt); toast.show(`Showing: ${opt}`, 'info'); }}
                    style={{ width: '100%', padding: '8px 14px', background: opt === rangeLabel ? '#f3f4f6' : 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--mh-text-2)', textAlign: 'left', fontFamily: 'var(--mh-font-body)' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                    onMouseLeave={e => e.currentTarget.style.background = opt === rangeLabel ? '#f3f4f6' : 'none'}>
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            className="mh-btn"
            style={{ background: '#e11d48', color: '#fff', padding: '8px 16px', boxShadow: '0 2px 8px rgba(225,29,72,0.3)' }}
            onClick={() => onNavigate?.('settings')}
          >
            <Plus size={14} /> Connect Channel
          </button>
        </div>
      </div>

      {/* Channel Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16, marginBottom: 20 }}>
        {channels.map(ch => <ChannelCard key={ch.id} ch={ch} toast={toast} stats={stats} integrations={integrations} onNavigate={onNavigate} />)}
      </div>

      {/* Bottom banner */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '14px 18px' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <Info size={16} color="#2563eb" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12.5, color: '#1e3a8a', lineHeight: 1.6 }}>
            No channel has live credentials connected yet, so every send here runs in Sandbox Mode — realistic simulated delivery, nothing posted externally.
          </div>
        </div>
        <button className="mh-btn mh-btn-ghost" style={{ flexShrink: 0, background: '#fff' }} onClick={() => onNavigate?.('settings')}>
          <SettingsIcon size={13} /> Channel Settings
        </button>
      </div>
    </div>
  );
}
