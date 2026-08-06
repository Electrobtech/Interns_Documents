'use client';
import { useState } from 'react';
import {
  Plus, Copy, Archive, Pause, Play, Trash2,
  BarChart3, Wand2, Search, LayoutGrid, List, Columns,
  MoreHorizontal, TrendingUp, TrendingDown, Sparkles,
  Filter, RefreshCw, Upload, Download
} from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import { campaigns } from '../mockData';
import MHBadge from '../ui/MHBadge';
import MHDrawer from '../ui/MHDrawer';
import { useMHToast } from '../ui/MHToast';

const statusVariant = {
  Active: 'active',
  Paused: 'paused',
  Scheduled: 'scheduled',
  Draft: 'draft'
};

function sparkline(seed, n) {
  n = n || 8;
  var arr = [];
  var v = 30 + (seed % 40);
  for (var i = 0; i < n; i++) {
    v = Math.max(5, Math.min(100, v + ((seed * (i + 1) * 13) % 21) - 9));
    arr.push({ v: v });
  }
  return arr;
}

function CampaignDrawer({ campaign: c }) {
  var metrics = [
    { label: 'Revenue', value: 'Rs.' + (c.revenue / 100000).toFixed(1) + 'L' },
    { label: 'ROAS', value: c.roas + 'x' },
    { label: 'Leads', value: c.leads.toLocaleString() },
    { label: 'CTR', value: c.ctr + '%' },
    { label: 'CPC', value: 'Rs.' + c.cpc },
    { label: 'Budget', value: 'Rs.' + c.budget.toLocaleString() },
  ];
  var spendPct = c.budget > 0 ? Math.min(100, Math.round((c.spend / c.budget) * 100)) : 0;
  var data = sparkline(parseInt(c.id) * 7, 12);
  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
        {metrics.map(function(m) {
          return (
            <div key={m.label} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{m.label}</div>
              <div style={{ fontFamily: 'var(--mh-font-display)', fontSize: 20, fontWeight: 700, color: '#111827', marginTop: 4 }}>{m.value}</div>
            </div>
          );
        })}
      </div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Performance Trend</div>
        <ResponsiveContainer width="100%" height={100}>
          <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <Line type="monotone" dataKey="v" stroke="#6366f1" strokeWidth={2} dot={false} />
            <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 11 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#374151', marginBottom: 6 }}>
          <span style={{ fontWeight: 600 }}>Budget Utilisation</span>
          <span style={{ fontWeight: 700 }}>{spendPct}% used</span>
        </div>
        <div className="progress-track" style={{ height: 8 }}>
          <div className="progress-fill" style={{ width: spendPct + '%', background: spendPct > 85 ? '#dc2626' : '#6366f1' }} />
        </div>
      </div>
      <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Sparkles size={14} color="#6366f1" />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#6366f1' }}>AI Recommendation</span>
        </div>
        <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
          {c.roas > 50
            ? 'Exceptional ROAS. Increase daily budget to scale conversions further.'
            : c.roas > 10
              ? 'Moderate performance. Test new creatives and A/B test headlines to improve CTR.'
              : 'Below benchmark. Refresh creatives and tighten audience targeting.'}
        </div>
      </div>
    </div>
  );
}

export default function MHCampaigns() {
  var toast = useMHToast();
  var show = toast.show;
  var _view = useState('list');
  var view = _view[0];
  var setView = _view[1];
  var _sel = useState([]);
  var selected = _sel[0];
  var setSelected = _sel[1];
  var _srch = useState('');
  var search = _srch[0];
  var setSearch = _srch[1];
  var _sf = useState('All');
  var statusFilter = _sf[0];
  var setStatusFilter = _sf[1];
  var _drw = useState(null);
  var drawer = _drw[0];
  var setDrawer = _drw[1];
  var _am = useState(null);
  var actionMenu = _am[0];
  var setActionMenu = _am[1];

  var filtered = campaigns.filter(function(c) {
    var matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.platform.toLowerCase().includes(search.toLowerCase());
    var matchStatus = statusFilter === 'All' || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  function toggleSelect(id) {
    setSelected(function(p) {
      return p.includes(id) ? p.filter(function(x) { return x !== id; }) : [...p, id];
    });
  }

  var allSelected = filtered.length > 0 && filtered.every(function(c) { return selected.includes(c.id); });

  function toggleAll() {
    setSelected(allSelected ? [] : filtered.map(function(c) { return c.id; }));
  }

  var statusCounts = { All: campaigns.length, Active: 0, Paused: 0, Scheduled: 0, Draft: 0 };
  campaigns.forEach(function(c) {
    if (statusCounts[c.status] !== undefined) statusCounts[c.status]++;
  });

  var toolbarBtns = [
    { icon: Copy, label: 'Duplicate', fn: function() { show('Duplicated', 'success'); } },
    { icon: Archive, label: 'Archive', fn: function() { show('Archived', 'success'); } },
    { icon: Pause, label: 'Pause', fn: function() { show('Paused', 'success'); } },
    { icon: Play, label: 'Resume', fn: function() { show('Resumed', 'success'); } },
    { icon: Trash2, label: 'Delete', fn: function() { show('Deleted', 'success'); } },
    { icon: Upload, label: 'Import', fn: function() { show('Import coming soon', 'info'); } },
    { icon: Download, label: 'Export', fn: function() { show('Exporting...', 'info'); } },
    { icon: BarChart3, label: 'Report', fn: function() { show('Report coming soon', 'info'); } },
    { icon: Wand2, label: 'AI Optimize', fn: function() { show('AI optimizing...', 'success'); } },
  ];

  return (
    <div style={{ padding: '24px 28px', background: 'var(--mh-bg)', minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--mh-font-display)', fontSize: 22, fontWeight: 800, color: '#111827', margin: 0 }}>Campaigns</h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4, marginBottom: 0 }}>
            {campaigns.length} campaigns - Manage and track all marketing campaigns
          </p>
        </div>
        <button className="mh-btn mh-btn-primary" onClick={function() { show('Campaign creation coming soon', 'info'); }}>
          <Plus size={14} /> Create Campaign
        </button>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {toolbarBtns.map(function(b) {
          var Icon = b.icon;
          return (
            <button key={b.label} className="mh-btn mh-btn-ghost" onClick={b.fn}>
              <Icon size={13} />{b.label}
            </button>
          );
        })}
      </div>

      {/* Search + filter */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input
            className="mh-input"
            placeholder="Search campaigns..."
            value={search}
            onChange={function(e) { setSearch(e.target.value); }}
            style={{ paddingLeft: 32, width: '100%' }}
          />
        </div>
        <button className="mh-btn mh-btn-ghost"><Filter size={13} /> Filter</button>
        <button className="mh-btn mh-btn-ghost" onClick={function() { show('Refreshed', 'success'); }}><RefreshCw size={13} /></button>
        <div style={{ marginLeft: 'auto', display: 'flex', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          {[['list', List], ['grid', LayoutGrid], ['kanban', Columns]].map(function(pair) {
            var v = pair[0]; var Ic = pair[1];
            return (
              <button key={v} onClick={function() { setView(v); }}
                style={{ padding: '6px 10px', background: view === v ? '#f3f4f6' : '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: view === v ? '#111827' : '#9ca3af' }}>
                <Ic size={14} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Status pills */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {Object.entries(statusCounts).map(function(entry) {
          var s = entry[0]; var count = entry[1];
          return (
            <button key={s} onClick={function() { setStatusFilter(s); }}
              style={{ padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid',
                background: statusFilter === s ? '#6366f1' : '#fff',
                color: statusFilter === s ? '#fff' : '#374151',
                borderColor: statusFilter === s ? '#6366f1' : '#e5e7eb' }}>
              {s === 'All' ? count + ' Total' : count + ' ' + s}
            </button>
          );
        })}
      </div>

      {/* LIST VIEW */}
      {view === 'list' && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', width: 32 }}>
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ cursor: 'pointer' }} />
                  </th>
                  {['CAMPAIGN', 'STATUS', 'PLATFORM', 'BUDGET', 'SPEND', 'REVENUE', 'LEADS', 'CTR', 'ROAS', 'START', 'END', 'TREND', ''].map(function(h) {
                    return (
                      <th key={h} style={{ padding: '10px 12px', textAlign: (h === '' || h === 'CAMPAIGN' || h === 'STATUS' || h === 'PLATFORM') ? 'left' : 'right', color: '#9ca3af', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filtered.map(function(c) {
                  var roasColor = c.roas >= 30 ? '#059669' : c.roas >= 10 ? '#d97706' : '#dc2626';
                  return (
                    <tr key={c.id} onClick={function() { setDrawer(c); }}
                      style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer', transition: 'background 0.12s' }}
                      onMouseEnter={function(e) { e.currentTarget.style.background = '#f9fafb'; }}
                      onMouseLeave={function(e) { e.currentTarget.style.background = '#fff'; }}>
                      <td style={{ padding: '10px 12px' }} onClick={function(e) { e.stopPropagation(); toggleSelect(c.id); }}>
                        <input type="checkbox" checked={selected.includes(c.id)} onChange={function() { toggleSelect(c.id); }} style={{ cursor: 'pointer' }} />
                      </td>
                      <td style={{ padding: '10px 12px', maxWidth: 180 }}>
                        <div style={{ fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 170 }}>{c.name}</div>
                        <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>{c.objective}</div>
                      </td>
                      <td style={{ padding: '10px 12px' }}><MHBadge label={c.status} variant={statusVariant[c.status]} /></td>
                      <td style={{ padding: '10px 12px', color: '#374151' }}>{c.platform}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#374151' }}>Rs.{c.budget.toLocaleString()}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#374151' }}>Rs.{c.spend.toLocaleString()}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#059669' }}>Rs.{c.revenue.toLocaleString()}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#374151' }}>{c.leads.toLocaleString()}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#374151' }}>{c.ctr}%</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: roasColor }}>{c.roas > 0 ? c.roas + 'x' : '-'}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#6b7280', whiteSpace: 'nowrap' }}>{c.startDate}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#6b7280', whiteSpace: 'nowrap' }}>{c.endDate}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <ResponsiveContainer width={60} height={28}>
                          <LineChart data={sparkline(parseInt(c.id) * 7)} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                            <Line type="monotone" dataKey="v" stroke={roasColor} strokeWidth={1.5} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </td>
                      <td style={{ padding: '10px 12px' }} onClick={function(e) { e.stopPropagation(); setActionMenu(actionMenu === c.id ? null : c.id); }}>
                        <div style={{ position: 'relative' }}>
                          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 4, borderRadius: 4, display: 'flex' }}>
                            <MoreHorizontal size={14} />
                          </button>
                          {actionMenu === c.id && (
                            <div style={{ position: 'absolute', right: 0, top: '100%', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 100, minWidth: 130, overflow: 'hidden' }}>
                              {[['Duplicate', Copy], ['Pause', Pause], ['Archive', Archive], ['Delete', Trash2]].map(function(pair) {
                                var lbl = pair[0]; var Ic = pair[1];
                                return (
                                  <button key={lbl}
                                    onClick={function() { show(lbl + 'd campaign', 'success'); setActionMenu(null); }}
                                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: lbl === 'Delete' ? '#dc2626' : '#374151', textAlign: 'left' }}
                                    onMouseEnter={function(e) { e.currentTarget.style.background = '#f9fafb'; }}
                                    onMouseLeave={function(e) { e.currentTarget.style.background = 'none'; }}>
                                    <Ic size={12} />{lbl}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* GRID VIEW */}
      {view === 'grid' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
          {filtered.map(function(c) {
            var spendPct = c.budget > 0 ? Math.min(100, Math.round((c.spend / c.budget) * 100)) : 0;
            var roasColor = c.roas >= 30 ? '#059669' : c.roas >= 10 ? '#d97706' : '#dc2626';
            return (
              <div key={c.id} onClick={function() { setDrawer(c); }}
                style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 16, cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={function(e) { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'; }}
                onMouseLeave={function(e) { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none'; }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', marginBottom: 4 }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{c.objective}</div>
                  </div>
                  <MHBadge label={c.status} variant={statusVariant[c.status]} />
                </div>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 10 }}>
                  <span style={{ fontWeight: 600 }}>{c.platform}</span> - {c.startDate}
                </div>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7280', marginBottom: 4 }}>
                    <span>Budget</span>
                    <span style={{ fontWeight: 600, color: '#374151' }}>Rs.{c.spend.toLocaleString()} / Rs.{c.budget.toLocaleString()}</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: spendPct + '%', background: spendPct > 85 ? '#dc2626' : '#6366f1' }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600 }}>ROAS</div>
                    <div style={{ fontFamily: 'var(--mh-font-display)', fontSize: 18, fontWeight: 700, color: roasColor, marginTop: 2 }}>{c.roas > 0 ? c.roas + 'x' : '-'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600 }}>Leads</div>
                    <div style={{ fontFamily: 'var(--mh-font-display)', fontSize: 18, fontWeight: 700, color: '#111827', marginTop: 2 }}>{c.leads.toLocaleString()}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600 }}>CTR</div>
                    <div style={{ fontFamily: 'var(--mh-font-display)', fontSize: 18, fontWeight: 700, color: '#111827', marginTop: 2 }}>{c.ctr}%</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* KANBAN VIEW */}
      {view === 'kanban' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, alignItems: 'flex-start' }}>
          {['Draft', 'Scheduled', 'Active', 'Paused'].map(function(status) {
            var colCampaigns = filtered.filter(function(c) { return c.status === status; });
            var colColor = status === 'Active' ? '#059669' : status === 'Scheduled' ? '#6366f1' : status === 'Paused' ? '#d97706' : '#9ca3af';
            return (
              <div key={status} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, minHeight: 200 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '6px 8px', borderRadius: 8, background: colColor + '18' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: colColor }}>{status}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: colColor }}>{colCampaigns.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {colCampaigns.map(function(c) {
                    var roasColor = c.roas >= 30 ? '#059669' : c.roas >= 10 ? '#d97706' : '#dc2626';
                    return (
                      <div key={c.id} onClick={function() { setDrawer(c); }}
                        style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, cursor: 'pointer' }}
                        onMouseEnter={function(e) { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)'; }}
                        onMouseLeave={function(e) { e.currentTarget.style.boxShadow = 'none'; }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: '#111827', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                        <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 6 }}>{c.platform}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7280' }}>
                          <span>{c.leads} leads</span>
                          <span style={{ fontWeight: 700, color: roasColor }}>{c.roas > 0 ? c.roas + 'x' : '-'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {drawer && (
        <MHDrawer title={drawer.name} subtitle={drawer.objective + ' - ' + drawer.platform} onClose={function() { setDrawer(null); }}>
          <CampaignDrawer campaign={drawer} />
        </MHDrawer>
      )}
    </div>
  );
}
