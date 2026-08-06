'use client';
import { useMemo, useState } from 'react';
import { DollarSign, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useLeadFields, useLeads, useUpdateLead } from '@/lib/queries/crm';
import { useUpdateSalesAgentConfig } from '@/lib/queries/aiAgents';

// "+ Set Up Deal Values" CTA (SalesWorkspace.jsx Pipeline Value card).
//
// Two jobs in one modal because they're genuinely coupled: picking *which*
// field to sum is useless until at least a few leads actually have that
// field populated, and the Pipeline Value card's empty state already
// distinguishes "not mapped" from "mapped but nothing set yet" — so a rep
// who opens this from the second empty state needs the quick-set list, not
// just the dropdown again.
export default function DealValueFieldModal({ config, onClose }) {
  const { data: fields, isLoading: fieldsLoading } = useLeadFields();
  const { data: leads } = useLeads();
  const updateConfig = useUpdateSalesAgentConfig();
  const updateLead = useUpdateLead();

  const [selected, setSelected] = useState(config?.deal_value_field || '');
  const [draftValues, setDraftValues] = useState({});
  const [savedField, setSavedField] = useState(false);
  const [err, setErr] = useState('');

  const missingValueLeads = useMemo(() => {
    if (!leads || !selected) return [];
    return leads.filter((l) => l[selected] == null || l[selected] === '').slice(0, 8);
  }, [leads, selected]);

  const saveField = async () => {
    setErr('');
    try {
      await updateConfig.mutateAsync({ deal_value_field: selected || null });
      setSavedField(true);
    } catch (ex) {
      setErr(ex.message || 'Failed to save deal value field');
    }
  };

  const saveLeadValue = async (leadId) => {
    const raw = draftValues[leadId];
    if (raw === undefined || raw === '') return;
    const num = Number(raw);
    if (Number.isNaN(num)) return;
    await updateLead.mutateAsync({ id: leadId, [selected]: num });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-card-lg w-full max-w-lg border border-slate-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-50 to-green-100 text-emerald-600">
              <DollarSign size={15} />
            </div>
            <div>
              <h2 className="font-bold text-slate-800 text-sm">Set Up Deal Values</h2>
              <p className="text-[11px] text-slate-400">Choose which CRM field feeds the Pipeline Value metric</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-2">Deal value field</label>
            {fieldsLoading ? (
              <div className="text-xs text-slate-400">Loading available fields…</div>
            ) : (
              <div className="space-y-2">
                {(fields || []).map((f) => (
                  <label
                    key={f.key}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                      selected === f.key ? 'border-emerald-300 bg-emerald-50' : 'border-[#E4E8F0] hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="deal_value_field"
                      className="mt-0.5"
                      checked={selected === f.key}
                      onChange={() => { setSelected(f.key); setSavedField(false); }}
                    />
                    <div>
                      <div className="text-sm font-medium text-slate-700">{f.label}</div>
                      {f.description && <div className="text-xs text-slate-400 mt-0.5">{f.description}</div>}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {err && <div className="text-xs text-red-500 flex items-center gap-1.5"><AlertTriangle size={12} /> {err}</div>}

          <div className="flex items-center justify-between pt-1">
            {savedField ? (
              <span className="text-xs text-emerald-600 flex items-center gap-1.5"><CheckCircle2 size={13} /> Saved</span>
            ) : <span />}
            <button
              onClick={saveField}
              disabled={updateConfig.isPending || !selected}
              className="px-4 py-2 rounded-xl text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {updateConfig.isPending ? 'Saving…' : 'Save mapping'}
            </button>
          </div>

          {selected && missingValueLeads.length > 0 && (
            <div className="pt-4 border-t border-[#E4E8F0]">
              <div className="text-xs font-medium text-slate-600 mb-2">
                {missingValueLeads.length} lead(s) don&apos;t have {fields?.find((f) => f.key === selected)?.label || selected} set yet
              </div>
              <div className="space-y-2">
                {missingValueLeads.map((l) => (
                  <div key={l.id} className="flex items-center gap-2">
                    <span className="text-xs text-slate-600 flex-1 truncate">{l.name || 'Unnamed lead'}</span>
                    <input
                      type="number"
                      placeholder="0"
                      className="w-24 px-2 py-1 text-xs border border-[#E4E8F0] rounded-lg"
                      value={draftValues[l.id] ?? ''}
                      onChange={(e) => setDraftValues((d) => ({ ...d, [l.id]: e.target.value }))}
                    />
                    <button
                      onClick={() => saveLeadValue(l.id)}
                      disabled={updateLead.isPending || draftValues[l.id] === undefined || draftValues[l.id] === ''}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-40 transition-colors"
                    >
                      Set
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
