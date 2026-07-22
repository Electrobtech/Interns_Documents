'use client';
import { useState } from 'react';

const input = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm';

// Renders a form from a `fields` config. `initial` pre-fills values when editing.
export default function ResourceForm({ fields, initial = {}, onSubmit, onCancel, submitting }) {
  const [values, setValues] = useState(() => {
    const v = {};
    for (const f of fields) v[f.key] = initial[f.key] ?? (f.type === 'checkbox' ? false : '');
    return v;
  });

  const set = (key, val) => setValues((prev) => ({ ...prev, [key]: val }));

  function submit(e) {
    e.preventDefault();
    onSubmit(values);
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {fields.map((f) => (
        <div key={f.key}>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            {f.label}{f.required && <span className="text-red-500"> *</span>}
          </label>
          {f.type === 'textarea' ? (
            <textarea className={input} rows={3} required={f.required}
              value={values[f.key]} onChange={(e) => set(f.key, e.target.value)} />
          ) : f.type === 'select' ? (
            <select className={input} required={f.required}
              value={values[f.key]} onChange={(e) => set(f.key, e.target.value)}>
              <option value="">Select…</option>
              {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : f.type === 'checkbox' ? (
            <input type="checkbox" className="w-4 h-4 accent-brand"
              checked={!!values[f.key]} onChange={(e) => set(f.key, e.target.checked)} />
          ) : (
            <input type={f.type === 'number' ? 'number' : f.type === 'datetime' ? 'datetime-local' : 'text'}
              className={input} required={f.required}
              value={values[f.key]} onChange={(e) => set(f.key, e.target.value)} />
          )}
        </div>
      ))}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600">Cancel</button>
        <button type="submit" disabled={submitting}
          className="px-4 py-2 text-sm rounded-lg bg-brand text-white font-medium disabled:opacity-60">
          {submitting ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
