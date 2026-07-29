'use client';

import { useState, useMemo, useEffect } from "react";
import {
  Link2, CheckCircle2, AlertTriangle, XCircle, RefreshCw, Clock, Shield,
  ShieldCheck, ShieldOff, Users, BarChart3, FileText, ChevronRight,
  ExternalLink, Building2, Check, X, Eye, Loader2, Info, Ban,
  Send, ThumbsUp, MessageCircle, Plus, Trash2, ChevronDown,
  Image as ImageIcon,
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

  // Posts — compose, feed, comments/reactions
  const [posts, setPosts] = useState([]);
  const [postText, setPostText] = useState("");
  const [postAsOrg, setPostAsOrg] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState("");
  const [expandedPostId, setExpandedPostId] = useState(null);
  const [commentsByPost, setCommentsByPost] = useState({});
  const [commentDraft, setCommentDraft] = useState({});
  const [syncingPostId, setSyncingPostId] = useState(null);
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState(null);
  const [uploadedMedia, setUploadedMedia] = useState(null); // { urn, type }
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [mediaError, setMediaError] = useState("");

  // Conversions API — offline/website conversion events
  const [conversionRuleUrn, setConversionRuleUrn] = useState("");
  const [savedRuleUrn, setSavedRuleUrn] = useState(null);
  const [savingRule, setSavingRule] = useState(false);
  const [conversionEvents, setConversionEvents] = useState([]);
  const [testConversion, setTestConversion] = useState({ email: "", value: "" });
  const [sendingConversion, setSendingConversion] = useState(false);
  const [conversionError, setConversionError] = useState("");
  const [conversionSent, setConversionSent] = useState(false);

  // Campaign creation
  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [campaignForm, setCampaignForm] = useState({ name: "", ad_account_urn: "", daily_budget: "" });
  const [creatingCampaign, setCreatingCampaign] = useState(false);
  const [campaignError, setCampaignError] = useState("");

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

  const fetchPosts = async () => {
    try {
      const res = await fetch(`${API}/api/v1/integrations/linkedin/posts`);
      const data = await res.json();
      setPosts(data.posts || []);
    } catch (error) {
      console.error('Posts error:', error);
    }
  };

  const pickMedia = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMediaError("");
    setUploadedMedia(null);
    setMediaFile(file);
    setMediaPreviewUrl(URL.createObjectURL(file));
  };

  const removeMedia = () => {
    if (mediaPreviewUrl) URL.revokeObjectURL(mediaPreviewUrl);
    setMediaFile(null);
    setMediaPreviewUrl(null);
    setUploadedMedia(null);
    setMediaError("");
  };

  const publishPost = async () => {
    if (!postText.trim()) return;
    setPosting(true);
    setPostError("");
    try {
      // Media (if any) must finish uploading to LinkedIn's Images/Videos API
      // and return a completed urn before the post itself can reference it —
      // LinkedIn rejects a post pointing at a still-processing asset.
      let media = uploadedMedia;
      if (mediaFile && !media) {
        setUploadingMedia(true);
        const form = new FormData();
        form.append('file', mediaFile);
        if (postAsOrg) form.append('as_organization', 'true');
        const upRes = await fetch(`${API}/api/v1/integrations/linkedin/posts/media`, { method: 'POST', body: form });
        const upData = await upRes.json();
        setUploadingMedia(false);
        if (!upRes.ok) {
          setMediaError(upData.message || upData.error || 'Failed to upload media');
          setPosting(false);
          return;
        }
        media = { urn: upData.urn, type: upData.type };
        setUploadedMedia(media);
      }

      const res = await fetch(`${API}/api/v1/integrations/linkedin/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: postText.trim(),
          ...(media ? { media_urn: media.urn, media_type: media.type } : {}),
          ...(postAsOrg ? { as_organization: true } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPostError(data.message || data.error || 'Failed to publish post');
        return;
      }
      setPostText("");
      removeMedia();
      fetchPosts();
    } catch (error) {
      setPostError(error.message);
    } finally {
      setPosting(false);
    }
  };

  const deletePost = async (id) => {
    if (!confirm('Delete this post from LinkedIn?')) return;
    try {
      await fetch(`${API}/api/v1/integrations/linkedin/posts/${id}`, { method: 'DELETE' });
      fetchPosts();
    } catch (error) {
      console.error('Delete post error:', error);
    }
  };

  const syncPost = async (id) => {
    setSyncingPostId(id);
    try {
      const res = await fetch(`${API}/api/v1/integrations/linkedin/posts/${id}/sync`, { method: 'POST' });
      const updated = await res.json();
      if (res.ok) {
        setPosts((prev) => prev.map((p) => (p.id === id ? updated : p)));
      }
    } catch (error) {
      console.error('Sync post error:', error);
    } finally {
      setSyncingPostId(null);
    }
  };

  const toggleComments = async (id) => {
    if (expandedPostId === id) {
      setExpandedPostId(null);
      return;
    }
    setExpandedPostId(id);
    try {
      const res = await fetch(`${API}/api/v1/integrations/linkedin/posts/${id}/comments`);
      const data = await res.json();
      setCommentsByPost((prev) => ({ ...prev, [id]: data.comments || [] }));
    } catch (error) {
      console.error('Comments error:', error);
    }
  };

  const submitComment = async (id) => {
    const text = (commentDraft[id] || "").trim();
    if (!text) return;
    try {
      await fetch(`${API}/api/v1/integrations/linkedin/posts/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      setCommentDraft((prev) => ({ ...prev, [id]: "" }));
      toggleComments(id); // close
      toggleComments(id); // reopen -> refetch
    } catch (error) {
      console.error('Comment error:', error);
    }
  };

  const likePost = async (id) => {
    try {
      await fetch(`${API}/api/v1/integrations/linkedin/posts/${id}/reactions`, { method: 'POST' });
      syncPost(id);
    } catch (error) {
      console.error('Like error:', error);
    }
  };

  const createCampaign = async () => {
    if (!campaignForm.name.trim() || !campaignForm.ad_account_urn.trim()) return;
    setCreatingCampaign(true);
    setCampaignError("");
    try {
      const res = await fetch(`${API}/api/v1/integrations/linkedin/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: campaignForm.name.trim(),
          ad_account_urn: campaignForm.ad_account_urn.trim(),
          daily_budget_cents: campaignForm.daily_budget ? Math.round(Number(campaignForm.daily_budget) * 100) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCampaignError(data.message || data.error || 'Failed to create campaign');
        return;
      }
      setCampaignForm({ name: "", ad_account_urn: "", daily_budget: "" });
      setShowCampaignForm(false);
      fetchCampaigns();
    } catch (error) {
      setCampaignError(error.message);
    } finally {
      setCreatingCampaign(false);
    }
  };

  const fetchConversionConfig = async () => {
    try {
      const res = await fetch(`${API}/api/v1/integrations/linkedin/conversion-config`);
      const data = await res.json();
      setSavedRuleUrn(data.conversion_rule_urn || null);
      setConversionRuleUrn(data.conversion_rule_urn || "");
    } catch (error) {
      console.error('Conversion config error:', error);
    }
  };

  const saveConversionRule = async () => {
    if (!conversionRuleUrn.trim()) return;
    setSavingRule(true);
    try {
      await fetch(`${API}/api/v1/integrations/linkedin/conversion-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversion_rule_urn: conversionRuleUrn.trim() }),
      });
      setSavedRuleUrn(conversionRuleUrn.trim());
    } catch (error) {
      console.error('Save conversion rule error:', error);
    } finally {
      setSavingRule(false);
    }
  };

  const fetchConversionEvents = async () => {
    try {
      const res = await fetch(`${API}/api/v1/integrations/linkedin/conversions`);
      const data = await res.json();
      setConversionEvents(data.events || []);
    } catch (error) {
      console.error('Conversion events error:', error);
    }
  };

  const sendTestConversion = async () => {
    if (!testConversion.email.trim()) return;
    setSendingConversion(true);
    setConversionError("");
    setConversionSent(false);
    try {
      const res = await fetch(`${API}/api/v1/integrations/linkedin/conversions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testConversion.email.trim(),
          value: testConversion.value ? Number(testConversion.value) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setConversionError(data.message || data.error || 'Failed to send conversion event');
        return;
      }
      setConversionSent(true);
      setTestConversion({ email: "", value: "" });
      fetchConversionEvents();
    } catch (error) {
      setConversionError(error.message);
    } finally {
      setSendingConversion(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchApprovals();
    fetchLogs();
    fetchForms();
    fetchCampaigns();
    fetchMetrics();
    fetchPosts();
    fetchConversionConfig();
    fetchConversionEvents();
  }, []);

  const isConnected = connection === "healthy" || connection === "expiring";
  const pendingApprovals = approvals.filter(a => a.status === "pending");

  return (
    <div className="w-full min-h-full" style={{ background: COLORS.bg, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, Helvetica, Arial, sans-serif" }}>
      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs mb-2" style={{ color: COLORS.textTertiary }}>
          <span>Channels</span>
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
            {/* Fallback, not just the 'disconnected' case: if /status fails the
                state is unknown, and a card with NO action at all is the worst
                outcome — offering Connect is always the safe default. */}
            {!isConnected && connection !== "connecting" && connection !== "expiring" && connection !== "error" && (
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
            {[
              ["Sign in & identity", "openid · profile · email"],
              ["Publish as yourself", "w_member_social"],
              ["Create / manage ad campaigns", "rw_ads"],
              ["Campaign & ad analytics", "r_ads_reporting"],
              ["Lead Gen Forms sync", "r_ads_leadgen_automation"],
              ["Offline conversion events", "rw_conversions"],
              ["Publish as your organization page", "w_organization_social"],
              ["Read org posts / comments / reactions", "r_organization_social"],
            ].map(([label, scope]) => {
              const s = statusData?.scope_status?.[scope.split(" · ")[0]];
              const status = s === "granted" ? "granted" : s === "needs_partner_approval" ? "missing" : "disabled";
              return <ScopeRow key={scope} label={label} scope={scope} status={status} />;
            })}
          </div>
          <p className="text-[11px] mt-3" style={{ color: COLORS.textTertiary }}>
            Posting as yourself, ad campaigns, lead sync, and conversion events are live (Advertising / Lead Sync / Conversions API approved). Organization-page posting and reading org comments/reactions need LinkedIn's Community Management API approval — not yet granted, so those actions are blocked with a clear message rather than silently failing.
          </p>
        </Panel>

        {/* Posts — compose, feed, comments/reactions */}
        <Panel
          title="Posts"
          description="Publish to LinkedIn as yourself and manage engagement on what you've posted"
          className="mb-5"
        >
          <div className="mb-4">
            {/* Post as: Me / Company Page — org posting stays disabled until
                Community Management API is approved (linkedin_org_urn null
                until then; see connection.js's organizationAcls fetch). */}
            <div className="flex items-center gap-1.5 mb-2.5">
              <span className="text-[11px] font-medium mr-1" style={{ color: COLORS.textTertiary }}>Post as:</span>
              <button
                onClick={() => setPostAsOrg(false)}
                disabled={!isConnected}
                className="px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
                style={!postAsOrg
                  ? { background: COLORS.linkedinSoft, color: COLORS.linkedin }
                  : { background: 'transparent', color: COLORS.textTertiary }}
              >
                {statusData?.display_name || 'Me'}
              </button>
              <button
                onClick={() => statusData?.can_manage_organization && setPostAsOrg(true)}
                disabled={!isConnected || !statusData?.can_manage_organization}
                title={statusData?.can_manage_organization ? undefined : 'Needs Community Management API approval — see Permissions & access above'}
                className="px-2.5 py-1 rounded-full text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={postAsOrg
                  ? { background: COLORS.linkedinSoft, color: COLORS.linkedin }
                  : { background: 'transparent', color: COLORS.textTertiary }}
              >
                Company Page{!statusData?.can_manage_organization ? ' 🔒' : ''}
              </button>
            </div>

            <textarea
              value={postText}
              onChange={(e) => setPostText(e.target.value)}
              placeholder="Share an update…"
              rows={3}
              className="w-full rounded-lg px-3 py-2.5 text-sm resize-none outline-none"
              style={{ border: `1px solid ${COLORS.border}`, color: COLORS.textPrimary }}
              disabled={!isConnected}
            />
            {postError && <p className="text-xs mt-1.5" style={{ color: COLORS.danger }}>{postError}</p>}
            {mediaError && <p className="text-xs mt-1.5" style={{ color: COLORS.danger }}>{mediaError}</p>}

            {/* Media preview */}
            {mediaPreviewUrl && (
              <div className="relative mt-2.5 rounded-lg overflow-hidden inline-block" style={{ border: `1px solid ${COLORS.border}` }}>
                {mediaFile?.type.startsWith('video/') ? (
                  <video src={mediaPreviewUrl} controls className="max-h-48 max-w-full block" />
                ) : (
                  <img src={mediaPreviewUrl} alt="attachment preview" className="max-h-48 max-w-full block" />
                )}
                <button
                  onClick={removeMedia}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center text-white"
                  style={{ background: 'rgba(0,0,0,0.6)' }}
                  title="Remove"
                >
                  <X size={13} />
                </button>
                {uploadingMedia && (
                  <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.7)' }}>
                    <Loader2 size={20} className="animate-spin" style={{ color: COLORS.linkedin }} />
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-3">
                <label
                  className="flex items-center gap-1.5 text-xs font-medium cursor-pointer"
                  style={{ color: isConnected ? COLORS.linkedin : COLORS.textTertiary }}
                >
                  <ImageIcon size={14} />
                  {mediaFile ? 'Change image/video' : 'Add image or video'}
                  <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={pickMedia}
                    disabled={!isConnected}
                    className="hidden"
                  />
                </label>
                <p className="text-[11px]" style={{ color: COLORS.textTertiary }}>
                  {isConnected ? "Posts publicly to your LinkedIn profile." : "Connect LinkedIn to publish."}
                </p>
              </div>
              <button
                onClick={publishPost}
                disabled={!isConnected || posting || !postText.trim()}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ background: COLORS.linkedin }}
              >
                <Send size={13} /> {posting ? (uploadingMedia ? "Uploading…" : "Publishing…") : "Publish"}
              </button>
            </div>
          </div>

          {posts.length === 0 ? (
            <p className="text-xs py-4 text-center" style={{ color: COLORS.textTertiary }}>No posts yet.</p>
          ) : (
            <div className="space-y-3">
              {posts.map((post) => (
                <div key={post.id} className="rounded-lg p-3.5" style={{ border: `1px solid ${COLORS.border}` }}>
                  <p className="text-sm whitespace-pre-line" style={{ color: COLORS.textPrimary }}>{post.text}</p>
                  {post.media_urn && (
                    <span className="inline-flex items-center gap-1 mt-1.5 text-[11px]" style={{ color: COLORS.textTertiary }}>
                      <ImageIcon size={11} /> {post.media_type === 'video' ? 'Video attached' : 'Image attached'}
                    </span>
                  )}
                  <div className="flex items-center gap-3 mt-2.5 flex-wrap">
                    <span className="text-[11px]" style={{ color: COLORS.textTertiary }}>
                      {post.published_at ? new Date(post.published_at).toLocaleString() : ''}
                    </span>
                    <button onClick={() => likePost(post.id)} className="flex items-center gap-1 text-xs" style={{ color: COLORS.textSecondary }}>
                      <ThumbsUp size={12} /> {post.metrics?.likes_count ?? 0}
                    </button>
                    <button onClick={() => toggleComments(post.id)} className="flex items-center gap-1 text-xs" style={{ color: COLORS.textSecondary }}>
                      <MessageCircle size={12} /> {post.metrics?.comments_count ?? 0}
                    </button>
                    <button onClick={() => syncPost(post.id)} className="flex items-center gap-1 text-xs" style={{ color: COLORS.textSecondary }}>
                      <RefreshCw size={11} className={syncingPostId === post.id ? "animate-spin" : ""} /> Sync
                    </button>
                    <button onClick={() => deletePost(post.id)} className="flex items-center gap-1 text-xs ml-auto" style={{ color: COLORS.danger }}>
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>

                  {expandedPostId === post.id && (
                    <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${COLORS.border}` }}>
                      {(commentsByPost[post.id] || []).length === 0 && (
                        <p className="text-xs" style={{ color: COLORS.textTertiary }}>No comments yet.</p>
                      )}
                      <div className="space-y-2 mb-2">
                        {(commentsByPost[post.id] || []).map((c, i) => (
                          <p key={i} className="text-xs" style={{ color: COLORS.textSecondary }}>
                            {c.message?.text || JSON.stringify(c)}
                          </p>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          value={commentDraft[post.id] || ""}
                          onChange={(e) => setCommentDraft((prev) => ({ ...prev, [post.id]: e.target.value }))}
                          placeholder="Write a comment…"
                          className="flex-1 rounded-md px-2.5 py-1.5 text-xs outline-none"
                          style={{ border: `1px solid ${COLORS.border}` }}
                        />
                        <button
                          onClick={() => submitComment(post.id)}
                          className="px-2.5 py-1.5 rounded-md text-xs font-medium text-white"
                          style={{ background: COLORS.linkedin }}
                        >
                          Reply
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Conversions API — report offline/website outcomes back to LinkedIn ads */}
        <Panel
          title="Conversion events"
          description="Report offline outcomes (a lead becoming a customer, a deal closing) back to LinkedIn so ad performance reflects real results, not just clicks"
          className="mb-5"
        >
          <div className="mb-4">
            <label className="text-[11px] font-medium block mb-1.5" style={{ color: COLORS.textSecondary }}>
              Conversion Rule URN
            </label>
            <div className="flex items-center gap-2">
              <input
                value={conversionRuleUrn}
                onChange={(e) => setConversionRuleUrn(e.target.value)}
                placeholder="urn:lla:llaPartnerConversion:1234567"
                className="flex-1 rounded-md px-2.5 py-1.5 text-xs outline-none"
                style={{ border: `1px solid ${COLORS.border}`, fontFamily: fontMono }}
              />
              <button
                onClick={saveConversionRule}
                disabled={savingRule || !conversionRuleUrn.trim()}
                className="px-3 py-1.5 rounded-md text-xs font-medium disabled:opacity-50"
                style={{ border: `1px solid ${COLORS.borderStrong}`, color: COLORS.textPrimary }}
              >
                {savingRule ? "Saving…" : "Save"}
              </button>
            </div>
            <p className="text-[11px] mt-1.5" style={{ color: COLORS.textTertiary }}>
              Find this in LinkedIn Campaign Manager under Analyze → Conversion Tracking → your conversion rule. LinkedIn doesn't offer an API to create one, so it's pasted here once.
              {savedRuleUrn && <span style={{ color: COLORS.success }}> · Currently saved.</span>}
            </p>
          </div>

          <div className="rounded-lg p-3 mb-4" style={{ background: COLORS.bg }}>
            <p className="text-xs font-medium mb-2" style={{ color: COLORS.textPrimary }}>Send a test event</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
              <input
                value={testConversion.email}
                onChange={(e) => setTestConversion((t) => ({ ...t, email: e.target.value }))}
                placeholder="Customer email (hashed before sending)"
                type="email"
                className="rounded-md px-2.5 py-1.5 text-xs outline-none"
                style={{ border: `1px solid ${COLORS.border}` }}
              />
              <input
                value={testConversion.value}
                onChange={(e) => setTestConversion((t) => ({ ...t, value: e.target.value }))}
                placeholder="Value in USD (optional)"
                type="number"
                className="rounded-md px-2.5 py-1.5 text-xs outline-none"
                style={{ border: `1px solid ${COLORS.border}` }}
              />
            </div>
            {conversionError && <p className="text-xs mb-2" style={{ color: COLORS.danger }}>{conversionError}</p>}
            {conversionSent && <p className="text-xs mb-2" style={{ color: COLORS.success }}>Sent to LinkedIn.</p>}
            <button
              onClick={sendTestConversion}
              disabled={sendingConversion || !testConversion.email.trim() || !savedRuleUrn}
              className="px-3 py-1.5 rounded-md text-xs font-medium text-white disabled:opacity-50"
              style={{ background: COLORS.linkedin }}
            >
              {sendingConversion ? "Sending…" : "Send conversion event"}
            </button>
            {!savedRuleUrn && <p className="text-[11px] mt-1.5" style={{ color: COLORS.textTertiary }}>Save a Conversion Rule URN above first.</p>}
          </div>

          <p className="text-xs font-medium mb-2" style={{ color: COLORS.textPrimary }}>Recent events</p>
          {conversionEvents.length === 0 ? (
            <p className="text-xs py-2" style={{ color: COLORS.textTertiary }}>No conversion events sent yet.</p>
          ) : (
            <div className="space-y-1.5">
              {conversionEvents.map((ev) => (
                <div key={ev.id} className="flex items-center justify-between py-1.5" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  <span className="text-[11px]" style={{ color: COLORS.textTertiary, fontFamily: fontMono }}>{ev.event_id}</span>
                  <span className="text-[11px]" style={{ color: COLORS.textSecondary }}>
                    {ev.value_cents ? `$${(ev.value_cents / 100).toFixed(2)} · ` : ''}{new Date(ev.sent_at).toLocaleString()}
                  </span>
                  {ev.status === 'sent'
                    ? <Badge tone="success" icon={CheckCircle2}>Sent</Badge>
                    : <Badge tone="danger" icon={XCircle}>Failed</Badge>}
                </div>
              ))}
            </div>
          )}
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
            action={
              <button
                onClick={() => setShowCampaignForm((v) => !v)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium"
                style={{ border: `1px solid ${COLORS.borderStrong}`, color: COLORS.textPrimary }}
              >
                <Plus size={12} /> New campaign
              </button>
            }
          >
            {showCampaignForm && (
              <div className="rounded-lg p-3 mb-3 space-y-2" style={{ background: COLORS.bg }}>
                <input
                  value={campaignForm.name}
                  onChange={(e) => setCampaignForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Campaign name"
                  className="w-full rounded-md px-2.5 py-1.5 text-xs outline-none"
                  style={{ border: `1px solid ${COLORS.border}` }}
                />
                <input
                  value={campaignForm.ad_account_urn}
                  onChange={(e) => setCampaignForm((f) => ({ ...f, ad_account_urn: e.target.value }))}
                  placeholder="Ad account URN (urn:li:sponsoredAccount:...)"
                  className="w-full rounded-md px-2.5 py-1.5 text-xs outline-none"
                  style={{ border: `1px solid ${COLORS.border}`, fontFamily: fontMono }}
                />
                <input
                  value={campaignForm.daily_budget}
                  onChange={(e) => setCampaignForm((f) => ({ ...f, daily_budget: e.target.value }))}
                  placeholder="Daily budget (USD, optional)"
                  type="number"
                  className="w-full rounded-md px-2.5 py-1.5 text-xs outline-none"
                  style={{ border: `1px solid ${COLORS.border}` }}
                />
                {campaignError && <p className="text-xs" style={{ color: COLORS.danger }}>{campaignError}</p>}
                <button
                  onClick={createCampaign}
                  disabled={creatingCampaign || !campaignForm.name.trim() || !campaignForm.ad_account_urn.trim()}
                  className="w-full px-3 py-1.5 rounded-md text-xs font-medium text-white disabled:opacity-50"
                  style={{ background: COLORS.linkedin }}
                >
                  {creatingCampaign ? "Creating…" : "Create as draft"}
                </button>
              </div>
            )}
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
