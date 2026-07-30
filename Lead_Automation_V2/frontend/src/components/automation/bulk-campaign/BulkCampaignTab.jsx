'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  UploadCloud, FileText, Users, Type, X, ChevronDown, Send, Clock,
  CheckCircle2, XCircle, Loader2, AlertTriangle,
} from 'lucide-react';
import { useApi } from '@/lib/useApi';
import { parseCsv, parseManualRecipients, looksLikePhoneNumber } from './csvParser';

// Same palette as PlaybookStudioApp.jsx / DiagnosticBench.jsx so the third
// tab reads as part of the same app shell rather than a bolted-on page.
const tokens = {
  border: '#E7E4DD',
  bg: '#FAFAF9',
  text: '#26241F',
  muted: '#8A8578',
  primary: '#1D6FC4',
  primarySoft: '#EAF2FB',
  danger: '#C0433A',
  dangerSoft: '#FBEAE8',
  success: '#2E8B57',
  successSoft: '#EAF6EF',
};

const RECIPIENT_MODES = [
  { id: 'csv', label: 'Upload File', Icon: UploadCloud },
  { id: 'manual', label: 'Manual Entry', Icon: Type },
  { id: 'segment', label: 'Contact Segment', Icon: Users },
];

const ACTIVE_STATUSES = new Set(['queued', 'scheduled', 'processing']);

/**
 * <BulkCampaignTab /> — the "Bulk Campaign" tab alongside Builder/Simulate
 * (see SmsAutomationSimulator.jsx). Recipients are assembled entirely
 * client-side (CSV parse, manual entry parse, or a fetched contact segment)
 * into one common `{ phone, name, variables }[]` shape, then handed to
 * campaign-service's POST /campaigns/broadcast in a single request — that
 * endpoint creates the campaign_recipients rows and hands them to BullMQ
 * (see campaign-service/src/services/bulkCampaignQueue.js). This component
 * then polls GET /campaigns/:id for live sent/failed counts.
 *
 * `flows` comes straight from the Simulator's own local flow catalog
 * (SmsAutomationSimulator.jsx's `flows` state, i.e. INITIAL_FLOWS plus
 * anything created via "+ New Flow") rather than a server-side playbooks
 * API — SMS/RCS has no DB-backed flow builder the way WhatsApp/Instagram's
 * Playbook Studio does, so the picked flow's raw `{{variable}}` template is
 * sent to the backend as-is (`messageBody`) and resolved per-recipient by
 * the worker, instead of a flow id the backend would need to look up.
 */
export default function BulkCampaignTab({ channel = 'sms', flows = [] }) {
  const { call } = useApi();

  // ---- Recipients --------------------------------------------------
  const [recipientMode, setRecipientMode] = useState('csv');

  const [csvFileName, setCsvFileName] = useState('');
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [csvRows, setCsvRows] = useState([]);
  const [csvError, setCsvError] = useState('');
  const [phoneColumn, setPhoneColumn] = useState('');
  const [nameColumn, setNameColumn] = useState('');
  // header -> the variable name the flow should see it as (defaults to the header itself)
  const [variableMap, setVariableMap] = useState({});
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const [manualText, setManualText] = useState('');

  const [segments, setSegments] = useState([]);
  const [selectedSegment, setSelectedSegment] = useState('');
  const [segmentContacts, setSegmentContacts] = useState([]);
  const [segmentLoading, setSegmentLoading] = useState(false);

  // ---- Campaign configuration ---------------------------------------
  const [campaignName, setCampaignName] = useState('');
  const [selectedFlowId, setSelectedFlowId] = useState('');
  const [sendMode, setSendMode] = useState('immediate'); // 'immediate' | 'scheduled'
  const [scheduledAt, setScheduledAt] = useState('');
  const [throttlePerMinute, setThrottlePerMinute] = useState(60);

  // ---- Submission + live progress ------------------------------------
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [activeCampaign, setActiveCampaign] = useState(null); // latest GET /campaigns/:id response
  const [recipientDetails, setRecipientDetails] = useState([]);
  const [showDetails, setShowDetails] = useState(false);
  const pollTimerRef = useRef(null);

  const selectedFlow = useMemo(() => flows.find((f) => f.id === selectedFlowId), [flows, selectedFlowId]);

  // Load the contact-segment list once on mount (flows come in as a prop —
  // see the component docblock — so there's nothing to fetch for those).
  useEffect(() => {
    let cancelled = false;
    call('/contacts/segments')
      .then((data) => { if (!cancelled) setSegments(Array.isArray(data) ? data : []); })
      .catch((err) => console.warn('Failed to load contact segments:', err.message));
    return () => { cancelled = true; };
  }, [call]);

  // ---- CSV handling ---------------------------------------------------
  const handleCsvText = useCallback((text, fileName) => {
    try {
      const { headers, rows } = parseCsv(text);
      if (headers.length === 0 || rows.length === 0) {
        setCsvError('That file has no rows we could read.');
        return;
      }
      setCsvHeaders(headers);
      setCsvRows(rows);
      setCsvFileName(fileName);
      setCsvError('');

      // Best-effort auto-detect so most CSVs need zero manual mapping.
      const guessPhone = headers.find((h) => /phone|mobile|number/i.test(h)) || headers[0];
      const guessName = headers.find((h) => /^name$|full.?name|contact.?name/i.test(h)) || '';
      setPhoneColumn(guessPhone);
      setNameColumn(guessName);
      setVariableMap(Object.fromEntries(headers.map((h) => [h, h])));
    } catch (err) {
      setCsvError(`Could not parse that file: ${err.message}`);
    }
  }, []);

  const handleFileInput = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => handleCsvText(String(reader.result), file.name);
    reader.onerror = () => setCsvError('Could not read that file.');
    reader.readAsText(file);
  }, [handleCsvText]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => handleCsvText(String(reader.result), file.name);
    reader.onerror = () => setCsvError('Could not read that file.');
    reader.readAsText(file);
  }, [handleCsvText]);

  const clearCsv = useCallback(() => {
    setCsvFileName(''); setCsvHeaders([]); setCsvRows([]); setCsvError('');
    setPhoneColumn(''); setNameColumn(''); setVariableMap({});
  }, []);

  // ---- Segment handling -------------------------------------------------
  const handleSegmentChange = useCallback(async (tag) => {
    setSelectedSegment(tag);
    setSegmentContacts([]);
    if (!tag) return;
    setSegmentLoading(true);
    try {
      const contacts = await call(`/contacts?tag=${encodeURIComponent(tag)}`);
      setSegmentContacts(Array.isArray(contacts) ? contacts : []);
    } catch (err) {
      console.warn('Failed to load segment contacts:', err.message);
    } finally {
      setSegmentLoading(false);
    }
  }, [call]);

  // ---- Derive the final { phone, name, variables }[] recipient list ------
  const recipients = useMemo(() => {
    if (recipientMode === 'manual') return parseManualRecipients(manualText);

    if (recipientMode === 'segment') {
      return segmentContacts
        .filter((c) => c.phone)
        .map((c) => ({ phone: c.phone, name: c.name || '', variables: { name: c.name || '' } }));
    }

    // csv mode
    if (!phoneColumn) return [];
    const otherHeaders = csvHeaders.filter((h) => h !== phoneColumn && h !== nameColumn);
    return csvRows.map((row) => ({
      phone: row[phoneColumn] || '',
      name: nameColumn ? (row[nameColumn] || '') : '',
      variables: Object.fromEntries(otherHeaders.map((h) => [variableMap[h] || h, row[h]])),
    }));
  }, [recipientMode, manualText, segmentContacts, csvRows, csvHeaders, phoneColumn, nameColumn, variableMap]);

  const invalidPhoneCount = useMemo(
    () => recipients.filter((r) => !looksLikePhoneNumber(r.phone)).length,
    [recipients]
  );

  // ---- Submit -----------------------------------------------------------
  const canSubmit = campaignName.trim() && recipients.length > 0 &&
    (sendMode === 'immediate' || scheduledAt) && !submitting;

  const handleSubmit = useCallback(async () => {
    setSubmitError('');
    setSubmitting(true);
    try {
      const body = {
        name: campaignName.trim(),
        channelType: channel,
        messageBody: selectedFlow?.body || null,
        recipients,
        recipientSource: recipientMode,
        sendMode,
        scheduledAt: sendMode === 'scheduled' ? new Date(scheduledAt).toISOString() : undefined,
        throttlePerMinute,
      };
      const data = await call('/campaigns/broadcast', { method: 'POST', body });
      setActiveCampaign(data.campaign);
      setShowDetails(false);
    } catch (err) {
      setSubmitError(err.message || 'Failed to start the campaign.');
    } finally {
      setSubmitting(false);
    }
  }, [call, campaignName, channel, selectedFlow, recipients, recipientMode, sendMode, scheduledAt, throttlePerMinute]);

  // ---- Live progress polling --------------------------------------------
  useEffect(() => {
    if (!activeCampaign?.id) return undefined;
    if (!ACTIVE_STATUSES.has(activeCampaign.status)) return undefined;

    pollTimerRef.current = setInterval(async () => {
      try {
        const updated = await call(`/campaigns/${activeCampaign.id}`);
        setActiveCampaign(updated);
        if (showDetails) {
          const details = await call(`/campaigns/${activeCampaign.id}/recipients`);
          setRecipientDetails(Array.isArray(details) ? details : []);
        }
      } catch (err) {
        console.warn('Progress poll failed:', err.message);
      }
    }, 2000);

    return () => clearInterval(pollTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCampaign?.id, activeCampaign?.status, showDetails]);

  const handleToggleDetails = useCallback(async () => {
    const next = !showDetails;
    setShowDetails(next);
    if (next && activeCampaign?.id) {
      try {
        const details = await call(`/campaigns/${activeCampaign.id}/recipients`);
        setRecipientDetails(Array.isArray(details) ? details : []);
      } catch (err) {
        console.warn('Failed to load recipient details:', err.message);
      }
    }
  }, [showDetails, activeCampaign, call]);

  const startNewCampaign = useCallback(() => {
    setActiveCampaign(null);
    setRecipientDetails([]);
    setShowDetails(false);
    setSubmitError('');
  }, []);

  return (
    <div className="w-full h-full overflow-y-auto" style={{ background: tokens.bg }}>
      <div className="max-w-3xl mx-auto px-6 py-6 flex flex-col gap-6">

        {activeCampaign ? (
          <ProgressPanel
            campaign={activeCampaign}
            details={recipientDetails}
            showDetails={showDetails}
            onToggleDetails={handleToggleDetails}
            onStartNew={startNewCampaign}
          />
        ) : (
          <>
            <Section title="1. Recipients">
              <div className="flex gap-1 mb-4">
                {RECIPIENT_MODES.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    onClick={() => setRecipientMode(id)}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
                    style={{
                      background: recipientMode === id ? tokens.primarySoft : 'transparent',
                      color: recipientMode === id ? tokens.primary : tokens.muted,
                      border: `1px solid ${recipientMode === id ? tokens.primary : tokens.border}`,
                    }}
                  >
                    <Icon size={13} /> {label}
                  </button>
                ))}
              </div>

              {recipientMode === 'csv' && (
                <CsvUploader
                  fileName={csvFileName}
                  headers={csvHeaders}
                  rowCount={csvRows.length}
                  error={csvError}
                  isDraggingOver={isDraggingOver}
                  onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
                  onDragLeave={() => setIsDraggingOver(false)}
                  onDrop={handleDrop}
                  onFileInput={handleFileInput}
                  onClear={clearCsv}
                  phoneColumn={phoneColumn}
                  nameColumn={nameColumn}
                  variableMap={variableMap}
                  onPhoneColumnChange={setPhoneColumn}
                  onNameColumnChange={setNameColumn}
                  onVariableMapChange={setVariableMap}
                />
              )}

              {recipientMode === 'manual' && (
                <div>
                  <textarea
                    value={manualText}
                    onChange={(e) => setManualText(e.target.value)}
                    placeholder={'+1 555 010 0100, +1 555 010 0101\nor one number per line'}
                    rows={5}
                    className="w-full text-sm rounded-lg p-3 outline-none"
                    style={{ border: `1px solid ${tokens.border}`, color: tokens.text }}
                  />
                  <p className="text-xs mt-1" style={{ color: tokens.muted }}>
                    Separate numbers with commas or new lines.
                  </p>
                </div>
              )}

              {recipientMode === 'segment' && (
                <div>
                  <SelectField
                    value={selectedSegment}
                    onChange={(e) => handleSegmentChange(e.target.value)}
                    placeholder="Choose a segment…"
                    options={segments.map((s) => ({ value: s.tag, label: `${s.tag} (${s.contact_count})` }))}
                  />
                  {segmentLoading && <p className="text-xs mt-2" style={{ color: tokens.muted }}>Loading contacts…</p>}
                  {!segmentLoading && selectedSegment && (
                    <p className="text-xs mt-2" style={{ color: tokens.muted }}>
                      {segmentContacts.filter((c) => c.phone).length} contacts with a phone number in this segment.
                    </p>
                  )}
                </div>
              )}

              {recipients.length > 0 && (
                <div className="mt-3 flex items-center gap-3 text-xs">
                  <span style={{ color: tokens.text }}>
                    <strong>{recipients.length}</strong> recipient{recipients.length === 1 ? '' : 's'} ready
                  </span>
                  {invalidPhoneCount > 0 && (
                    <span className="flex items-center gap-1" style={{ color: tokens.danger }}>
                      <AlertTriangle size={12} /> {invalidPhoneCount} look invalid and will fail to send
                    </span>
                  )}
                </div>
              )}
            </Section>

            <Section title="2. Campaign Configuration">
              <Field label="Campaign name">
                <input
                  type="text"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="e.g. July Welcome Blast"
                  className="w-full text-sm rounded-lg px-3 py-2 outline-none"
                  style={{ border: `1px solid ${tokens.border}`, color: tokens.text }}
                />
              </Field>

              <Field label="Flow / Template">
                <SelectField
                  value={selectedFlowId}
                  onChange={(e) => setSelectedFlowId(e.target.value)}
                  placeholder="Use a generic message (no flow)"
                  options={flows.map((f) => ({ value: f.id, label: f.name }))}
                />
                {selectedFlow && (
                  <p className="text-xs mt-1.5" style={{ color: tokens.muted }}>
                    Template: <span style={{ color: tokens.text }}>{selectedFlow.body}</span>
                  </p>
                )}
              </Field>

              {csvHeaders.length > 0 && recipientMode === 'csv' && (
                <Field label="Column mapping">
                  <ColumnMappingTable
                    headers={csvHeaders.filter((h) => h !== phoneColumn && h !== nameColumn)}
                    variableMap={variableMap}
                    onChange={setVariableMap}
                  />
                </Field>
              )}

              <Field label="Sending">
                <div className="flex gap-2 mb-2">
                  <ToggleButton active={sendMode === 'immediate'} onClick={() => setSendMode('immediate')}>
                    Send Immediately
                  </ToggleButton>
                  <ToggleButton active={sendMode === 'scheduled'} onClick={() => setSendMode('scheduled')}>
                    <Clock size={12} className="inline mr-1" /> Schedule
                  </ToggleButton>
                </div>
                {sendMode === 'scheduled' && (
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="text-sm rounded-lg px-3 py-2 outline-none"
                    style={{ border: `1px solid ${tokens.border}`, color: tokens.text }}
                  />
                )}
              </Field>

              <Field label={`Send rate — ${throttlePerMinute} SMS/min`}>
                <input
                  type="range"
                  min={10}
                  max={200}
                  step={5}
                  value={throttlePerMinute}
                  onChange={(e) => setThrottlePerMinute(Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-[11px]" style={{ color: tokens.muted }}>
                  <span>10/min (gentle)</span>
                  <span>200/min (fast)</span>
                </div>
              </Field>
            </Section>

            <Section title="3. Send">
              {submitError && (
                <p className="text-xs mb-2 flex items-center gap-1" style={{ color: tokens.danger }}>
                  <AlertTriangle size={12} /> {submitError}
                </p>
              )}
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg"
                style={{
                  background: canSubmit ? tokens.primary : tokens.border,
                  color: canSubmit ? '#fff' : tokens.muted,
                  cursor: canSubmit ? 'pointer' : 'not-allowed',
                }}
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {sendMode === 'scheduled' ? 'Schedule Campaign' : `Send to ${recipients.length || 0} Recipients`}
              </button>
            </Section>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Presentational helpers                                              */
/* ------------------------------------------------------------------ */

function Section({ title, children }) {
  return (
    <div className="rounded-xl p-5" style={{ background: '#fff', border: `1px solid ${tokens.border}` }}>
      <h3 className="text-sm font-semibold mb-3" style={{ color: tokens.text }}>{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="mb-4 last:mb-0">
      <label className="block text-xs font-medium mb-1.5" style={{ color: tokens.muted }}>{label}</label>
      {children}
    </div>
  );
}

function SelectField({ value, onChange, options, placeholder }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={onChange}
        className="w-full text-sm rounded-lg px-3 py-2 pr-8 outline-none appearance-none bg-transparent"
        style={{ border: `1px solid ${tokens.border}`, color: tokens.text }}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: tokens.muted }} />
    </div>
  );
}

function ToggleButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="text-xs font-medium px-3 py-1.5 rounded-md"
      style={{
        background: active ? tokens.primarySoft : 'transparent',
        color: active ? tokens.primary : tokens.muted,
        border: `1px solid ${active ? tokens.primary : tokens.border}`,
      }}
    >
      {children}
    </button>
  );
}

function CsvUploader({
  fileName, headers, rowCount, error, isDraggingOver,
  onDragOver, onDragLeave, onDrop, onFileInput, onClear,
  phoneColumn, nameColumn, variableMap, onPhoneColumnChange, onNameColumnChange, onVariableMapChange,
}) {
  if (!fileName) {
    return (
      <label
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className="flex flex-col items-center justify-center gap-2 rounded-xl py-10 cursor-pointer transition-colors"
        style={{
          border: `2px dashed ${isDraggingOver ? tokens.primary : tokens.border}`,
          background: isDraggingOver ? tokens.primarySoft : tokens.bg,
        }}
      >
        <UploadCloud size={22} style={{ color: tokens.muted }} />
        <span className="text-sm" style={{ color: tokens.text }}>Drag & drop a CSV or Excel file</span>
        <span className="text-xs" style={{ color: tokens.muted }}>or click to browse — expects columns like phone, name</span>
        <input type="file" accept=".csv,.xlsx,.xls,text/csv" className="hidden" onChange={onFileInput} />
        {error && <span className="text-xs mt-1" style={{ color: tokens.danger }}>{error}</span>}
      </label>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between rounded-lg px-3 py-2 mb-3" style={{ background: tokens.bg, border: `1px solid ${tokens.border}` }}>
        <span className="flex items-center gap-2 text-sm" style={{ color: tokens.text }}>
          <FileText size={14} /> {fileName} <span style={{ color: tokens.muted }}>· {rowCount} rows</span>
        </span>
        <button onClick={onClear} aria-label="Remove file"><X size={14} style={{ color: tokens.muted }} /></button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Phone number column">
          <SelectField value={phoneColumn} onChange={(e) => onPhoneColumnChange(e.target.value)} placeholder="Select a column" options={headers.map((h) => ({ value: h, label: h }))} />
        </Field>
        <Field label="Name column (optional)">
          <SelectField value={nameColumn} onChange={(e) => onNameColumnChange(e.target.value)} placeholder="None" options={headers.map((h) => ({ value: h, label: h }))} />
        </Field>
      </div>
    </div>
  );
}

/** Maps every remaining CSV header to the {{variable}} name flows will see. */
function ColumnMappingTable({ headers, variableMap, onChange }) {
  if (headers.length === 0) {
    return <p className="text-xs" style={{ color: tokens.muted }}>No extra columns to map — only phone/name were detected.</p>;
  }
  return (
    <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${tokens.border}` }}>
      <div className="grid grid-cols-2 text-xs font-medium px-3 py-1.5" style={{ background: tokens.bg, color: tokens.muted }}>
        <span>CSV column</span><span>Flow variable ({'{{ }}'})</span>
      </div>
      {headers.map((h) => (
        <div key={h} className="grid grid-cols-2 items-center px-3 py-1.5 text-sm" style={{ borderTop: `1px solid ${tokens.border}` }}>
          <span style={{ color: tokens.text }}>{h}</span>
          <input
            value={variableMap[h] ?? h}
            onChange={(e) => onChange({ ...variableMap, [h]: e.target.value })}
            className="text-sm rounded-md px-2 py-1 outline-none"
            style={{ border: `1px solid ${tokens.border}`, color: tokens.text }}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * Live sent/failed progress + per-recipient diagnostics, shown once a
 * campaign has been created. Polled from the parent every 2s while the
 * campaign is still queued/scheduled/processing (see the polling effect
 * above); this component itself is purely presentational.
 */
function ProgressPanel({ campaign, details, showDetails, onToggleDetails, onStartNew }) {
  const total = campaign.total_recipients || 0;
  const sent = campaign.sent_count || 0;
  const failed = campaign.failed_count || 0;
  const done = sent + failed;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const isFinished = campaign.status === 'completed' || campaign.status === 'failed';

  return (
    <Section title="Execution & Diagnostics">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium" style={{ color: tokens.text }}>{campaign.name}</span>
        <StatusPill status={campaign.status} />
      </div>

      <div className="w-full h-2 rounded-full overflow-hidden mb-2" style={{ background: tokens.border }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: failed > 0 && sent === 0 ? tokens.danger : tokens.primary }}
        />
      </div>

      <div className="flex gap-4 text-xs mb-4">
        <span style={{ color: tokens.text }}>{done} / {total} processed</span>
        <span className="flex items-center gap-1" style={{ color: tokens.success }}><CheckCircle2 size={12} /> {sent} sent</span>
        <span className="flex items-center gap-1" style={{ color: tokens.danger }}><XCircle size={12} /> {failed} failed</span>
      </div>

      <div className="flex gap-2">
        <button onClick={onToggleDetails} className="text-xs font-medium px-3 py-1.5 rounded-md" style={{ border: `1px solid ${tokens.border}`, color: tokens.text }}>
          {showDetails ? 'Hide' : 'View'} recipient details
        </button>
        {isFinished && (
          <button onClick={onStartNew} className="text-xs font-medium px-3 py-1.5 rounded-md" style={{ background: tokens.primary, color: '#fff' }}>
            Start a new campaign
          </button>
        )}
      </div>

      {showDetails && (
        <div className="mt-3 rounded-lg overflow-hidden max-h-80 overflow-y-auto" style={{ border: `1px solid ${tokens.border}` }}>
          {details.length === 0 ? (
            <p className="text-xs p-3" style={{ color: tokens.muted }}>No recipient activity yet.</p>
          ) : details.map((r) => (
            <div key={r.id} className="px-3 py-2 text-xs" style={{ borderTop: `1px solid ${tokens.border}` }}>
              <div className="flex items-center justify-between mb-1">
                {/* Always show the phone number, even when a name is also
                    present — with duplicate numbers in a broadcast, the
                    phone is what actually distinguishes otherwise-identical-
                    looking rows. Each row is keyed by its own recipient id
                    (r.id), so duplicate phones never collapse into one. */}
                <span style={{ color: tokens.text }}>
                  {r.phone}{r.name ? <span style={{ color: tokens.muted }}> · {r.name}</span> : null}
                </span>
                <span className="flex items-center gap-1 shrink-0" style={{ color: r.status === 'sent' ? tokens.success : r.status === 'failed' ? tokens.danger : tokens.muted }}>
                  {r.status === 'sent' && <CheckCircle2 size={11} />}
                  {r.status === 'failed' && <XCircle size={11} />}
                  {r.status}
                </span>
              </div>
              {r.rendered_message && (
                <p className="rounded-md px-2 py-1.5" style={{ background: tokens.bg, color: tokens.text }}>
                  {r.rendered_message}
                </p>
              )}
              {r.error && (
                <p className="mt-1" style={{ color: tokens.danger }}>{r.error}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function StatusPill({ status }) {
  const styles = {
    queued: { bg: tokens.primarySoft, color: tokens.primary },
    scheduled: { bg: tokens.primarySoft, color: tokens.primary },
    processing: { bg: tokens.primarySoft, color: tokens.primary },
    completed: { bg: tokens.successSoft, color: tokens.success },
    failed: { bg: tokens.dangerSoft, color: tokens.danger },
  }[status] || { bg: tokens.bg, color: tokens.muted };

  return (
    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: styles.bg, color: styles.color }}>
      {status}
    </span>
  );
}
