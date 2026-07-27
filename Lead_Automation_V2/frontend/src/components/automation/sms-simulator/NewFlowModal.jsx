'use client';
import { useMemo, useState } from 'react';
import { X, Sparkles } from 'lucide-react';

// Detects {{variable}} placeholders in a message body so the modal can offer
// a sample value for each one — mirrors how MOCK_FLOWS.demoContext is used
// to render previews in the Simulate tab.
function extractVariables(body) {
  const matches = body.matchAll(/\{\{(\w+)\}\}/g);
  return [...new Set([...matches].map((m) => m[1]))];
}

function slugify(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'sms_flow';
}

/**
 * "+ New Flow" form, opened from the Builder tab. Fully self-contained —
 * builds a MOCK_FLOWS-shaped object (single "start" sms node) and hands it
 * back to the parent via onCreate. No backend call: this simulator is
 * mock-driven end to end, same as the rest of this feature.
 */
export default function NewFlowModal({ existingIds, onClose, onCreate }) {
  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState('');
  const [senderId, setSenderId] = useState('ELECTRB');
  const [smsType, setSmsType] = useState('transactional');
  const [body, setBody] = useState('');
  const [sampleValues, setSampleValues] = useState({});
  const [error, setError] = useState('');

  const variables = useMemo(() => extractVariables(body), [body]);

  function updateSample(key, value) {
    setSampleValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return setError('Give the flow a name.');
    if (!trigger.trim()) return setError('Give the flow a trigger event.');
    if (!body.trim()) return setError('The SMS message can\u2019t be empty.');

    let id = slugify(name);
    if (existingIds.includes(id)) {
      let n = 2;
      while (existingIds.includes(`${id}_${n}`)) n += 1;
      id = `${id}_${n}`;
    }

    const demoContext = {};
    variables.forEach((v) => {
      demoContext[v] = sampleValues[v]?.trim() || v;
    });

    onCreate({
      id,
      name: name.trim(),
      trigger: trigger.trim(),
      senderId: senderId.trim() || 'ELECTRB',
      smsType,
      demoContext,
      nodes: [
        {
          id: 'start',
          type: 'sms',
          position: { x: 620, y: 40 },
          body,
        },
      ],
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Sparkles size={15} />
            </div>
            <h3 className="text-[15px] font-bold text-slate-800">New SMS Flow</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-md p-1"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <Field label="Flow Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Order Shipped SMS"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
            />
          </Field>

          <Field label="Trigger Event" hint="Snake_case event key that fires this flow, e.g. order_shipped">
            <input
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
              placeholder="e.g. order_shipped"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Sender ID">
              <input
                value={senderId}
                onChange={(e) => setSenderId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              />
            </Field>
            <Field label="SMS Type">
              <select
                value={smsType}
                onChange={(e) => setSmsType(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              >
                <option value="transactional">Transactional</option>
                <option value="promotional">Promotional</option>
              </select>
            </Field>
          </div>

          <Field label="Message" hint="Use {{variable}} for placeholders, e.g. {{name}}">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder={'Hi {{name}}, your order has shipped!'}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
            />
          </Field>

          {variables.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
              <p className="text-[12px] font-semibold text-slate-600">Sample values for Simulate preview</p>
              {variables.map((v) => (
                <div key={v} className="flex items-center gap-2">
                  <span className="text-[12px] font-mono text-slate-500 w-24 shrink-0">{`{{${v}}}`}</span>
                  <input
                    value={sampleValues[v] || ''}
                    onChange={(e) => updateSample(v, e.target.value)}
                    placeholder={v}
                    className="flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                  />
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-[12.5px] text-red-600">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm"
            >
              Create Flow
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11.5px] text-slate-400">{hint}</p>}
    </div>
  );
}
