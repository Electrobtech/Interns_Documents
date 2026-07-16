'use client';

const base = 'w-full border rounded-lg px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-brand/30';

function borderClass(error) {
  return error ? 'border-red-300 focus:border-red-400' : 'border-slate-300 focus:border-brand';
}

export function TextField({ label, required, error, className = '', ...props }) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-xs font-medium text-slate-600 mb-1.5">
          {label}{required && <span className="text-red-400"> *</span>}
        </label>
      )}
      <input className={`${base} ${borderClass(error)}`} {...props} />
      {error && <p className="text-[11px] text-red-500 mt-1">{error}</p>}
    </div>
  );
}

export function SelectField({ label, required, error, options, placeholder = 'Select…', className = '', ...props }) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-xs font-medium text-slate-600 mb-1.5">
          {label}{required && <span className="text-red-400"> *</span>}
        </label>
      )}
      <select className={`${base} ${borderClass(error)} bg-white`} {...props}>
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          typeof opt === 'string'
            ? <option key={opt} value={opt}>{opt}</option>
            : <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <p className="text-[11px] text-red-500 mt-1">{error}</p>}
    </div>
  );
}

export function TextAreaField({ label, error, className = '', ...props }) {
  return (
    <div className={className}>
      {label && <label className="block text-xs font-medium text-slate-600 mb-1.5">{label}</label>}
      <textarea className={`${base} ${borderClass(error)} resize-none`} rows={3} {...props} />
      {error && <p className="text-[11px] text-red-500 mt-1">{error}</p>}
    </div>
  );
}
