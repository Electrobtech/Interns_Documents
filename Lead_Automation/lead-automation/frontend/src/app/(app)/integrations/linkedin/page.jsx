'use client';

import { useState, useMemo, useEffect } from "react";
import {
  Link2, CheckCircle2, AlertTriangle, XCircle, RefreshCw, Clock, Shield,
  ShieldCheck, ShieldOff, Users, BarChart3, FileText, ChevronRight,
  ExternalLink, Building2, Check, X, Eye, Loader2, Info, Ban
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

const COLORS = {
  accent: "#3B36D9",
  accentSoft: "#EDEBFC",
  linkedin: "#0A66C2",
  linkedinSoft: "#E8F1FB",
  success: "#157F3C",
  successSoft: "#E6F6EC",
  warning: "#B45300",
  warningSoft: "#FDF1E3",
  danger: "#C0242A",
  dangerSoft: "#FCEAEA",
  pending: "#5C6470",
  pendingSoft: "#EEF0F3",
  textPrimary: "#161A21",
  textSecondary: "#5C6470",
  textTertiary: "#8A93A1",
  border: "#E3E6EB",
  borderStrong: "#C9CED6",
  bg: "#F5F6F8",
  surface: "#FFFFFF",
};

const fontMono = "ui-monospace, SFMono-Regular, 'Roboto Mono', Menlo, Consolas, monospace";

const API = process.env.NEXT_PUBLIC_LINKEDIN_SERVICE_URL || 'http://localhost:4009';

function Badge({ tone, icon: Icon, children }) {
  const map = {
    success: [COLORS.successSoft, COLORS.success],
    warning: [COLORS.warningSoft, COLORS.warning],
    danger: [COLORS.dangerSoft, COLORS.danger],
    pending: [COLORS.pendingSoft, COLORS.pending],
    accent: [COLORS.accentSoft, COLORS.accent],
  };
  const [bg, fg] = map[tone] || map.pending;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ background: bg, color: fg }}
    >
      {Icon && <Icon size={12} strokeWidth={2.5} />}
      {children}
    </span>
  );
}

function Panel({ title, description, action, children, className = "" }) {
  return (
    <div
      className={`rounded-xl ${className}`}
      style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}
    >
      <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-4" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
        <div>
          <h3 className="text-sm font-semibold" style={{ color: COLORS.textPrimary }}>{title}</h3>
          {description && <p className="text-xs mt-0.5" style={{ color: COLORS.textSecondary }}>{description}</p>}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function ScopeRow({ label, scope, status }) {
  const cfg = {
    granted: { icon: ShieldCheck, tone: "success", label: "Granted" },
    missing: { icon: ShieldOff, tone: "warning", label: "Action needed" },
    disabled: { icon: Ban, tone: "pending", label: "Not requested" },
  }[status];
  const Icon = cfg.icon;
  return (
    <div className="flex items-center justify-between py-2.5" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
      <div className="flex items-center gap-2.5 min-w-0">
        <Icon size={15} style={{ color: cfg.tone === "success" ? COLORS.success : cfg.tone === "warning" ? COLORS.warning : COLORS.textTertiary, flexShrink: 0 }} />
        <div className="min-w-0">
          <p className="text-xs font-medium truncate" style={{ color: COLORS.textPrimary }}>{label}</p>
          <p className="text-[11px] truncate" style={{ color: COLORS.textTertiary, fontFamily: fontMono }}>{scope}</p>
        </div>
      </div>
      <Badge tone={cfg.tone}>{cfg.label}</Badge>
    </div>
  );
}

export default function LinkedInIntegrationPage() {
  const [connection, setConnection] = useState("disconnected");
  const [statusData, setStatusData] = useState(null);
  const [approvals, setApprovals] = useState([]);
  const [logs, setLogs] = useState([]);
  const [forms, setForms] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [metrics, setMetrics] = useState(null);

  const chartData = useMemo(() => {
    return (metrics?.daily || []).map((d) => ({ day: String(d.date).slice(5, 10), ctr: Number(d.ctr) }));
  }, [metrics]);

  const tokenDaysLeft = useMemo(() => {
    if (!statusData?.token_expires_at) return null;
    const ms = new Date(statusData.token_expires_at).getTime() - Date.now();
    return Math.max(0, Math.round(ms / 86_400_000));
  }, [statusData]);

  const connect = async () => {
    try {
      setConnection("connecting");
      const res = await fetch(`${API}/api/v1/integrations/linkedin/connect`, { method: 'POST' });
      const data = await res.json();
      if (data.authorization_url) {
        window.location.href = data.authorization_url;
      }
    } catch (error) {
      console.error('Connect error:', error);
      setConnection("error");
    }
  };

  const disconnect = async () => {
    try {
      await fetch(`${API}/api/v1/integrations/linkedin/connection`, { method: 'DELETE' });
      setConnection("disconnected");
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  };

  const reconnect = async () => {
    try {
      setConnection("connecting");
      const res = await fetch(`${API}/api/v1/integrations/linkedin/reconnect`, { method: 'POST' });
      const data = await res.json();
      if (data.authorization_url) {
        window.location.href = data.authorization_url;
      }
    } catch (error) {
      console.error('Reconnect error:', error);
      setConnection("error");
    }
  };

  const resolveApproval = async (id, decision) => {
    try {
      await fetch(`${API}/api/v1/integrations/linkedin/approvals/${id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision })
      });
      setApprovals(prev => prev.map(a => a.id === id ? { ...a, status: decision } : a));
      fetchApprovals();
      fetchLogs();
    } catch (error) {
      console.error('Decision error:', error);
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API}/api/v1/integrations/linkedin/status`);
      const data = await res.json();
      setConnection(data.status);
      setStatusData(data);
    } catch (error) {
      console.error('Status error:', error);
    }
  };

  const fetchMetrics = async () => {
    try {
      const to = new Date();
      const from = new Date(to.getTime() - 14 * 86_400_000);
      const res = await fetch(
        `${API}/api/v1/integrations/linkedin/campaigns/metrics?from=${from.toISOString().slice(0, 10)}&to=${to.toISOString().slice(0, 10)}`
      );
      const data = await res.json();
      setMetrics(data);
    } catch (error) {
      console.error('Metrics error:', error);
    }
  };

  const fetchApprovals = async () => {
    try {
      const res = await fetch(`${API}/api/v1/integrations/linkedin/approvals?status=pending`);
      const data = await res.json();
      setApprovals(data.approvals || []);
    } catch (error) {
      console.error('Approvals error:', error);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch(`${API}/api/v1/integrations/linkedin/logs`);
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (error) {
      console.error('Logs error:', error);
    }
  };

  const fetchForms = async () => {
    try {
      const res = await fetch(`${API}/api/v1/integrations/linkedin/leads/forms`);
      const data = await res.json();
      setForms(data.forms || []);
    } catch (error) {
      console.error('Forms error:', error);
    }
  };

  const fetchCampaigns = async () => {
    try {
      const res = await fetch(`${API}/api/v1/integrations/linkedin/campaigns`);
      const data = await res.json();
      setCampaigns(data.campaigns || []);
    } catch (error) {
      console.error('Campaigns error:', error);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchApprovals();
    fetchLogs();
    fetchForms();
    fetchCampaigns();
    fetchMetrics();
  }, []);

  const isConnected = connection === "healthy" || connection === "expiring";
  const pendingApprovals = approvals.filter(a => a.status === "pending");

  return (
    <div className="w-full min-h-full" style={{ background: COLORS.bg, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, Helvetica, Arial, sans-serif" }}>
      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs mb-2" style={{ color: COLORS.textTertiary }}>
          <span>AI agents & automation</span>
          <ChevronRight size={12} />
          <span>Integrations</span>
          <ChevronRight size={12} />
          <span style={{ color: COLORS.textPrimary, fontWeight: 500 }}>LinkedIn</span>
        </div>

        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: COLORS.textPrimary }}>LinkedIn ads & lead gen</h1>
            <p className="text-sm mt-1" style={{ color: COLORS.textSecondary }}>
              Sync leads, campaign performance, and company page data through the official LinkedIn Marketing API.
            </p>
          </div>
        </div>

        {/* Account status card */}
        <div className="rounded-xl mb-5 p-5 flex items-center justify-between gap-4 flex-wrap" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: COLORS.linkedinSoft }}>
              <Link2 size={20} style={{ color: COLORS.linkedin }} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-semibold" style={{ color: COLORS.textPrimary }}>LinkedIn account</p>
                {connection === "disconnected" && <Badge tone="pending" icon={XCircle}>Not connected</Badge>}
                {connection === "connecting" && <Badge tone="accent" icon={Loader2}>Connecting…</Badge>}
                {connection === "healthy" && <Badge tone="success" icon={CheckCircle2}>Connected</Badge>}
                {connection === "expiring" && <Badge tone="warning" icon={AlertTriangle}>Token expiring</Badge>}
                {connection === "error" && <Badge tone="danger" icon={XCircle}>Connection error</Badge>}
              </div>
              {isConnected || connection === "error" ? (
                <p className="text-xs" style={{ color: COLORS.textSecondary }}>
                  Connected as <span style={{ fontWeight: 500, color: COLORS.textPrimary }}>{statusData?.display_name || 'LinkedIn organization'}</span> · Organization page ·
                  {connection === "expiring" && tokenDaysLeft != null
                    ? ` token expires in ${tokenDaysLeft} day${tokenDaysLeft === 1 ? '' : 's'}`
                    : connection === "error"
                    ? " reconnect to resume syncing"
                    : tokenDaysLeft != null
                    ? ` token valid for ${tokenDaysLeft} days`
                    : ""}
                </p>
              ) : (
                <p className="text-xs" style={{ color: COLORS.textSecondary }}>Connect an account to start syncing leads, campaigns, and page data.</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {connection === "disconnected" && (
              <button
                onClick={connect}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ background: COLORS.linkedin }}
              >
                <Link2 size={15} /> Connect LinkedIn
              </button>
            )}
            {connection === "connecting" && (
              <button disabled className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white opacity-70" style={{ background: COLORS.linkedin }}>
                <Loader2 size={15} className="animate-spin" /> Authorizing…
              </button>
            )}
            {(connection === "expiring" || connection === "error") && (
              <button onClick={reconnect} className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium" style={{ border: `1px solid ${COLORS.borderStrong}`, color: COLORS.textPrimary }}>
                <RefreshCw size={14} /> Reconnect
              </button>
            )}
            {isConnected && (
              <button onClick={disconnect} className="px-3.5 py-2 rounded-lg text-sm font-medium" style={{ border: `1px solid ${COLORS.borderStrong}`, color: COLORS.textSecondary }}>
                Disconnect
              </button>
            )}
          </div>
        </div>

        {/* Error / permission banners */}
        {connection === "error" && (
          <div className="rounded-xl mb-5 px-4 py-3 flex items-start gap-3" style={{ background: COLORS.dangerSoft, border: `1px solid ${COLORS.danger}22` }}>
            <XCircle size={17} style={{ color: COLORS.danger, flexShrink: 0, marginTop: 1 }} />
            <div className="text-xs" style={{ color: COLORS.danger }}>
              <p className="font-medium mb-0.5">LinkedIn returned a 401 — the connection needs to be re-authorized.</p>
              <p style={{ opacity: 0.9 }}>All syncing is paused until you reconnect. No data has been lost; the last successful sync is still in your CRM.</p>
            </div>
          </div>
        )}
        {connection === "expiring" && (
          <div className="rounded-xl mb-5 px-4 py-3 flex items-start gap-3" style={{ background: COLORS.warningSoft, border: `1px solid ${COLORS.warning}22` }}>
            <AlertTriangle size={17} style={{ color: COLORS.warning, flexShrink: 0, marginTop: 1 }} />
            <div className="text-xs" style={{ color: COLORS.warning }}>
              <p className="font-medium mb-0.5">Access token expires in 3 days.</p>
              <p style={{ opacity: 0.9 }}>Reconnect now to avoid an interruption to lead and campaign syncing.</p>
            </div>
          </div>
        )}
        {connection === "disconnected" && (
          <div className="rounded-xl mb-5 px-4 py-3 flex items-start gap-3" style={{ background: COLORS.pendingSoft, border: `1px solid ${COLORS.border}` }}>
            <Info size={17} style={{ color: COLORS.textSecondary, flexShrink: 0, marginTop: 1 }} />
            <div className="text-xs" style={{ color: COLORS.textSecondary }}>
              Connecting uses LinkedIn's official OAuth flow. You'll be asked to sign in on linkedin.com and approve a specific list of permissions — this module never asks for more access than each feature below requires.
            </div>
          </div>
        )}

        {/* Permission ledger */}
        <Panel
          title="Permissions & access"
          description="Every synced feature is tied to a specific LinkedIn scope. Nothing runs on access that hasn't been explicitly granted."
          className="mb-5"
        >
          <div>
            <ScopeRow label="Read profile & organization access" scope="r_liteprofile · r_organization_admin" status={isConnected || connection === "error" ? "granted" : "disabled"} />
            <ScopeRow label="Lead Gen Forms sync" scope="r_ads_leadgen_automation" status={isConnected || connection === "error" ? "granted" : "disabled"} />
            <ScopeRow label="Campaign & ad analytics" scope="r_ads_reporting" status={connection === "error" ? "missing" : (isConnected ? "granted" : "disabled")} />
            <ScopeRow label="Company page information" scope="r_organization_social" status={isConnected || connection === "error" ? "granted" : "disabled"} />
            <ScopeRow label="Publish posts to company page" scope="w_organization_social" status="disabled" />
            <ScopeRow label="Create or edit ad campaigns" scope="rw_ads" status="disabled" />
          </div>
          <p className="text-[11px] mt-3" style={{ color: COLORS.textTertiary }}>
            Publishing and campaign-write scopes are intentionally not requested. This integration is read + sync only; any future write capability would require a separate, explicit authorization and would still route through manual approval below.
          </p>
        </Panel>

        {/* Lead sync + Campaign sync */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
          <Panel
            title="Lead sync"
            description="Leads captured through LinkedIn Lead Gen Forms"
            action={<Badge tone={isConnected ? "success" : "pending"} icon={isConnected ? RefreshCw : Clock}>{isConnected ? "Auto-sync on" : "Paused"}</Badge>}
          >
            <div className="space-y-3">
              {forms.length === 0 && <p className="text-xs py-2" style={{ color: COLORS.textTertiary }}>No lead forms found.</p>}
              {forms.map((form) => (
                <div key={form.form_urn} className="flex items-center justify-between py-2" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Users size={15} style={{ color: COLORS.textTertiary, flexShrink: 0 }} />
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: COLORS.textPrimary }}>{form.name}</p>
                      <p className="text-[11px]" style={{ color: COLORS.textTertiary }}>{form.new_lead_count} new leads · last sync {form.last_synced_at ? new Date(form.last_synced_at).toLocaleString() : 'never'}</p>
                    </div>
                  </div>
                  {form.status === "synced" && <Badge tone="success" icon={CheckCircle2}>Synced</Badge>}
                  {form.status === "pending_approval" && <Badge tone="warning" icon={Clock}>Needs approval</Badge>}
                  {form.status === "failed" && <Badge tone="danger" icon={XCircle}>Failed</Badge>}
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            title="Campaign sync"
            description="Ad campaigns pulled from connected ad accounts"
            action={<Badge tone={isConnected ? "success" : "pending"} icon={isConnected ? RefreshCw : Clock}>{isConnected ? "Auto-sync on" : "Paused"}</Badge>}
          >
            <div className="space-y-3">
              {campaigns.length === 0 && <p className="text-xs py-2" style={{ color: COLORS.textTertiary }}>No campaigns found.</p>}
              {campaigns.map((c) => (
                <div key={c.campaign_urn} className="flex items-center justify-between py-2" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <BarChart3 size={15} style={{ color: COLORS.textTertiary, flexShrink: 0 }} />
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: COLORS.textPrimary }}>{c.name}</p>
                      <p className="text-[11px]" style={{ color: COLORS.textTertiary }}>Spend to date ${(c.spend_to_date_cents / 100).toFixed(2)}</p>
                    </div>
                  </div>
                  {c.sync_status === "synced" && <Badge tone="success" icon={CheckCircle2}>Synced</Badge>}
                  {c.sync_status === "failed" && <Badge tone="danger" icon={XCircle}>Missing scope</Badge>}
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* Analytics panel */}
        <Panel title="Campaign & ad performance" description="Aggregated across connected LinkedIn ad accounts, last 14 days" className="mb-5">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
            {[
              ["Impressions", metrics?.summary ? metrics.summary.impressions.toLocaleString() : "—"],
              ["Clicks", metrics?.summary ? metrics.summary.clicks.toLocaleString() : "—"],
              ["CTR", metrics?.summary ? `${metrics.summary.ctr}%` : "—"],
              ["Spend", metrics?.summary ? `$${(metrics.summary.spend_cents / 100).toLocaleString()}` : "—"],
              ["Leads captured", metrics?.summary ? metrics.summary.leads.toLocaleString() : "—"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg p-3" style={{ background: COLORS.bg }}>
                <p className="text-[11px]" style={{ color: COLORS.textTertiary }}>{label}</p>
                <p className="text-base font-semibold mt-0.5" style={{ color: COLORS.textPrimary }}>{value}</p>
              </div>
            ))}
          </div>
          <div style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid stroke={COLORS.border} vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: COLORS.textTertiary }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: COLORS.textTertiary }} axisLine={false} tickLine={false} width={40} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${COLORS.border}` }}
                  formatter={(v) => [`${v}%`, "CTR"]}
                  labelFormatter={(l) => `Day ${l}`}
                />
                <Line type="monotone" dataKey="ctr" stroke={COLORS.accent} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        {/* Manual approval workflow */}
        <Panel
          title="Pending approval"
          description="Actions that touch CRM records or leave this workspace wait for a human decision before they run"
          action={pendingApprovals.length > 0 && <Badge tone="warning" icon={Clock}>{pendingApprovals.length} waiting</Badge>}
          className="mb-5"
        >
          {pendingApprovals.length === 0 ? (
            <p className="text-xs py-2" style={{ color: COLORS.textTertiary }}>Nothing waiting on review right now.</p>
          ) : (
            <div className="space-y-2">
              {approvals.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-4 rounded-lg px-3.5 py-3"
                  style={{ background: a.status === "pending" ? COLORS.bg : "transparent", opacity: a.status === "pending" ? 1 : 0.55 }}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium" style={{ color: COLORS.textPrimary }}>{a.title}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: COLORS.textTertiary }}>{a.detail}</p>
                  </div>
                  {a.status === "pending" ? (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs" style={{ border: `1px solid ${COLORS.borderStrong}`, color: COLORS.textSecondary }}>
                        <Eye size={12} /> Review
                      </button>
                      <button
                        onClick={() => resolveApproval(a.id, "rejected")}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs"
                        style={{ border: `1px solid ${COLORS.borderStrong}`, color: COLORS.danger }}
                      >
                        <X size={12} /> Reject
                      </button>
                      <button
                        onClick={() => resolveApproval(a.id, "approved")}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-white"
                        style={{ background: COLORS.success }}
                      >
                        <Check size={12} /> Approve
                      </button>
                    </div>
                  ) : (
                    <Badge tone={a.status === "approved" ? "success" : "danger"} icon={a.status === "approved" ? CheckCircle2 : XCircle}>
                      {a.status === "approved" ? "Approved" : "Rejected"}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Sync logs table */}
        <Panel title="Sync logs" description="Full history of syncs, approvals, and connection events">
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-xs" style={{ minWidth: 640 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  {["Time", "Module", "Event", "Status", "Actor"].map((h) => (
                    <th key={h} className="text-left font-medium px-2 py-2" style={{ color: COLORS.textTertiary }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                    <td className="px-2 py-2.5" style={{ color: COLORS.textTertiary, fontFamily: fontMono, whiteSpace: "nowrap" }}>{new Date(log.time).toLocaleString()}</td>
                    <td className="px-2 py-2.5" style={{ color: COLORS.textSecondary, whiteSpace: "nowrap" }}>{log.module}</td>
                    <td className="px-2 py-2.5" style={{ color: COLORS.textPrimary }}>{log.event}</td>
                    <td className="px-2 py-2.5">
                      {log.status === "success" && <Badge tone="success" icon={CheckCircle2}>Success</Badge>}
                      {log.status === "failed" && <Badge tone="danger" icon={XCircle}>Failed</Badge>}
                      {log.status === "pending" && <Badge tone="warning" icon={Clock}>Pending</Badge>}
                    </td>
                    <td className="px-2 py-2.5" style={{ color: COLORS.textSecondary, whiteSpace: "nowrap" }}>{log.actor?.type || 'System'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <p className="text-[11px] text-center mt-6" style={{ color: COLORS.textTertiary }}>
          Built on the official LinkedIn Marketing API. No scraping, no unofficial endpoints, no posting access beyond what's shown above.
        </p>
      </div>
    </div>
  );
}
