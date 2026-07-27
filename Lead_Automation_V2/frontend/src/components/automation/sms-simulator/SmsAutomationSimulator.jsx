'use client';
import { useMemo, useState } from 'react';
import { Workflow, Plus, Trash2 } from 'lucide-react';
import PhonePreview from './PhonePreview';
import SimulationForm from './SimulationForm';
import SmsDetailsCard from './SmsDetailsCard';
import EngineDiagnostics from './EngineDiagnostics';
import ActivityLogTable from './ActivityLogTable';
import NewFlowModal from './NewFlowModal';

// Seed flow catalog — the starting state for `flows` below. Each flow's
// message body may reference {{variables}}, resolved against `demoContext`
// at simulate-time — mirrors how a real send would merge lead/contact
// fields into a template. Flows created via "+ New Flow" are appended to
// this at runtime (in-memory only; nothing is persisted to a backend yet).
const INITIAL_FLOWS = [
  {
    id: 'new_lead_welcome_sms',
    name: 'New Lead Welcome SMS',
    trigger: 'new_lead_created',
    senderId: 'ELECTRB',
    smsType: 'transactional',
    demoContext: { name: 'Arjun' },
    nodes: [
      {
        id: 'start',
        type: 'sms',
        position: { x: 620, y: 40 },
        body: 'Hi {{name}},\nThank you for registering with Electrobtech!\nOur team will contact you shortly.\n\n- Electrobtech Team',
      },
    ],
  },
  {
    id: 'appointment_reminder_sms',
    name: 'Appointment Reminder SMS',
    trigger: 'appointment_scheduled',
    senderId: 'ELECTRB',
    smsType: 'transactional',
    demoContext: { name: 'Arjun', time: '4:00 PM' },
    nodes: [
      {
        id: 'start',
        type: 'sms',
        position: { x: 620, y: 40 },
        body: 'Hi {{name}}, this is a reminder for your appointment today at {{time}}. Reply STOP to opt out.',
      },
    ],
  },
  {
    id: 'payment_confirmation_sms',
    name: 'Payment Confirmation SMS',
    trigger: 'payment_received',
    senderId: 'ELECTRB',
    smsType: 'transactional',
    demoContext: { name: 'Arjun', amount: '₹2,499' },
    nodes: [
      {
        id: 'start',
        type: 'sms',
        position: { x: 620, y: 40 },
        body: 'Hi {{name}}, we\u2019ve received your payment of {{amount}}. Thank you for your business!',
      },
    ],
  },
];

function renderTemplate(body, context) {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key) => context[key] ?? `{{${key}}}`);
}

function formatTimestamp(date) {
  const time = date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  const day = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  return `${time}, ${day}`;
}

export default function SmsAutomationSimulator() {
  const [tab, setTab] = useState('simulate'); // 'builder' | 'simulate'

  const [flows, setFlows] = useState(INITIAL_FLOWS);
  const [phone, setPhone] = useState('+91 98765 43210');
  const [flowId, setFlowId] = useState(INITIAL_FLOWS[0].id);
  const [nodeId, setNodeId] = useState(INITIAL_FLOWS[0].nodes[0].id);
  const [simulating, setSimulating] = useState(false);
  const [lastResult, setLastResult] = useState(null); // { message, timeLabel, status }
  const [justSimulated, setJustSimulated] = useState(false);
  const [entries, setEntries] = useState([]);
  const [showNewFlow, setShowNewFlow] = useState(false);

  const activeFlow = useMemo(
    () => flows.find((f) => f.id === flowId) || flows[0],
    [flows, flowId],
  );
  const activeNode = useMemo(
    () => activeFlow.nodes.find((n) => n.id === nodeId) || activeFlow.nodes[0],
    [activeFlow, nodeId],
  );

  function handleFlowChange(nextFlowId) {
    setFlowId(nextFlowId);
    const nextFlow = flows.find((f) => f.id === nextFlowId);
    setNodeId(nextFlow?.nodes?.[0]?.id || 'start');
  }

  function handleCreateFlow(newFlow) {
    setFlows((prev) => [...prev, newFlow]);
    setShowNewFlow(false);
    setFlowId(newFlow.id);
    setNodeId(newFlow.nodes[0].id);
    setTab('simulate');
  }

  function handleDeleteFlow(id) {
    setFlows((prev) => {
      if (prev.length <= 1) return prev; // keep at least one flow to simulate against
      const next = prev.filter((f) => f.id !== id);
      if (id === flowId) {
        const fallback = next[0];
        setFlowId(fallback.id);
        setNodeId(fallback.nodes[0].id);
      }
      return next;
    });
  }

  function handleSimulate() {
    setSimulating(true);
    setJustSimulated(false);
    // Mock async engine call — a real implementation would POST to
    // /automation/sms/simulate and await the rendered payload.
    setTimeout(() => {
      const now = new Date();
      const message = renderTemplate(activeNode.body, activeFlow.demoContext);
      const timeLabel = formatTimestamp(now);

      setLastResult({ message, timeLabel, status: 'success' });
      setEntries((prev) => [
        {
          id: `${now.getTime()}`,
          time: timeLabel,
          channel: 'SMS',
          to: phone,
          message,
          status: 'Simulated',
        },
        ...prev,
      ].slice(0, 20));
      setSimulating(false);
      setJustSimulated(true);
      setTimeout(() => setJustSimulated(false), 5000);
    }, 500);
  }

  const exportedFlow = {
    flow: {
      id: activeFlow.id,
      name: activeFlow.name,
      trigger: activeFlow.trigger,
      channel: 'sms',
    },
    node: {
      id: activeNode.id,
      type: 'sms',
      position: activeNode.position,
      data: {
        message: activeNode.body,
        sender_id: activeFlow.senderId,
        sms_type: activeFlow.smsType,
      },
    },
  };

  const sessionState = {
    currentSessionNode: nodeId,
    recipientPhone: phone,
    channel: 'sms',
    'nodesToRender[]': [activeNode.id],
    flowName: activeFlow.name,
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Sub-tabs */}
      <div className="flex items-center gap-1 px-1 pt-1 border-b border-slate-200 bg-white shrink-0">
        <TabButton active={tab === 'builder'} onClick={() => setTab('builder')}>Builder</TabButton>
        <TabButton active={tab === 'simulate'} onClick={() => setTab('simulate')}>Simulate</TabButton>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto bg-slate-50">
        {tab === 'builder' ? (
          <BuilderPlaceholder
            flows={flows}
            activeFlowId={flowId}
            onSelectFlow={handleFlowChange}
            onGoSimulate={() => setTab('simulate')}
            onNewFlow={() => setShowNewFlow(true)}
            onDeleteFlow={handleDeleteFlow}
          />
        ) : (
          <div className="p-5 grid grid-cols-1 lg:grid-cols-[300px_340px_1fr] gap-5 items-start">
            {/* Column 1 */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 flex justify-center">
              <PhonePreview
                recipientPhone={phone}
                message={lastResult?.message}
                timestampLabel={lastResult ? `Today, ${lastResult.timeLabel.split(',')[0]}` : undefined}
              />
            </div>

            {/* Column 2 */}
            <div className="space-y-5">
              <SimulationForm
                phone={phone}
                onPhoneChange={setPhone}
                flows={flows}
                flowId={flowId}
                onFlowChange={handleFlowChange}
                nodeId={nodeId}
                onNodeChange={setNodeId}
                onSimulate={handleSimulate}
                simulating={simulating}
                justSimulated={justSimulated}
              />
              <SmsDetailsCard
                phone={phone}
                message={lastResult?.message || ''}
                status={lastResult?.status}
                timeLabel={lastResult?.timeLabel}
              />
            </div>

            {/* Column 3 */}
            <div className="space-y-5 min-w-0">
              <EngineDiagnostics sessionState={sessionState} flow={exportedFlow} />
              <ActivityLogTable entries={entries} />
            </div>
          </div>
        )}
      </div>

      {showNewFlow && (
        <NewFlowModal
          existingIds={flows.map((f) => f.id)}
          onClose={() => setShowNewFlow(false)}
          onCreate={handleCreateFlow}
        />
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="text-sm font-medium px-3 py-2 border-b-2 -mb-px transition-colors"
      style={{
        borderColor: active ? '#2563eb' : 'transparent',
        color: active ? '#2563eb' : '#8A8578',
      }}
    >
      {children}
    </button>
  );
}

function BuilderPlaceholder({ flows, activeFlowId, onSelectFlow, onGoSimulate, onNewFlow, onDeleteFlow }) {
  const [confirmId, setConfirmId] = useState(null);
  const canDelete = flows.length > 1;

  return (
    <div className="p-8 max-w-2xl mx-auto text-center">
      <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
        <Workflow size={22} />
      </div>
      <h3 className="text-[16px] font-bold text-slate-800">SMS flows</h3>
      <p className="text-[13px] text-slate-500 mt-1 mb-6">
        Pick a flow to test in the Simulate tab, or create a new one. A visual drag-and-drop builder for SMS is on the way.
      </p>

      <button
        onClick={onNewFlow}
        className="mb-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 shadow-sm transition-colors"
      >
        <Plus size={15} /> New Flow
      </button>

      <div className="space-y-2 text-left">
        {flows.map((f) => {
          const isConfirming = confirmId === f.id;
          return (
            <div
              key={f.id}
              className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-sm transition-colors ${
                isConfirming
                  ? 'border-red-200 bg-red-50'
                  : f.id === activeFlowId
                  ? 'border-blue-300 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {isConfirming ? (
                <>
                  <span className="text-[13px] text-red-700">
                    Delete <span className="font-semibold">{f.name}</span>?
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setConfirmId(null)}
                      className="px-2.5 py-1 rounded-md text-[12.5px] font-medium text-slate-600 hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => { onDeleteFlow(f.id); setConfirmId(null); }}
                      className="px-2.5 py-1 rounded-md text-[12.5px] font-semibold text-white bg-red-600 hover:bg-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <button
                    onClick={() => { onSelectFlow(f.id); onGoSimulate(); }}
                    className="flex-1 min-w-0 flex items-center justify-between gap-3 text-left"
                  >
                    <span className="font-medium truncate">{f.name}</span>
                    <span className="text-[11px] text-slate-400 shrink-0">{f.trigger}</span>
                  </button>
                  {canDelete && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmId(f.id); }}
                      title="Delete flow"
                      className="ml-3 shrink-0 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md p-1.5 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
      {!canDelete && (
        <p className="mt-3 text-[11.5px] text-slate-400">
          Keep at least one flow — create another before deleting this one.
        </p>
      )}
    </div>
  );
}
