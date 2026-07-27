'use client';
import { Send, CheckCircle2, ChevronDown } from 'lucide-react';

/**
 * Middle column (top half) — the test/simulate control panel. Fully
 * controlled by the parent so a flow/node change can immediately drive the
 * phone preview + diagnostics panel without any local echo state here.
 */
export default function SimulationForm({
  phone,
  onPhoneChange,
  flows,
  flowId,
  onFlowChange,
  nodeId,
  onNodeChange,
  onSimulate,
  simulating,
  justSimulated,
}) {
  const activeFlow = flows.find((f) => f.id === flowId) || flows[0];
  const phoneValid = /^\+?\d[\d\s]{9,14}$/.test(phone.trim());

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <h3 className="text-[15px] font-bold text-slate-800">Test / Simulate SMS</h3>
      <p className="text-[13px] text-slate-500 mt-1">
        Send a test SMS to a number to preview the message.
      </p>

      <div className="mt-5">
        <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Phone Number</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          placeholder="+91 98765 43210"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
        />
        <p className={`mt-1 text-[11.5px] ${phoneValid ? 'text-slate-400' : 'text-amber-600'}`}>
          Enter a valid 10 digit mobile number.
        </p>
      </div>

      <div className="mt-4">
        <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Select Flow</label>
        <SelectField
          value={flowId}
          onChange={onFlowChange}
          options={flows.map((f) => ({ value: f.id, label: f.name }))}
        />
      </div>

      <div className="mt-4">
        <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Select Entry Node</label>
        <SelectField
          value={nodeId}
          onChange={onNodeChange}
          options={(activeFlow?.nodes || []).map((n) => ({ value: n.id, label: n.id }))}
        />
      </div>

      <button
        onClick={onSimulate}
        disabled={simulating || !phoneValid}
        className="mt-5 w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 shadow-sm transition-colors"
      >
        <Send size={15} />
        {simulating ? 'Simulating…' : 'Simulate SMS'}
      </button>

      {justSimulated && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
          <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-[13px] font-semibold text-emerald-800">SMS Simulated Successfully!</p>
            <p className="text-[12px] text-emerald-700 leading-snug">
              The message has been simulated and added to the activity log.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function SelectField({ value, onChange, options }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 pr-8 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
    </div>
  );
}
