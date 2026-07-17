'use client';
import { passwordStrength } from '@/lib/companyValidation';

const COLORS = ['bg-red-400', 'bg-red-400', 'bg-amber-400', 'bg-amber-400', 'bg-emerald-500', 'bg-emerald-500'];

export default function PasswordStrengthMeter({ password }) {
  const { score, label } = passwordStrength(password || '');
  if (!password) return null;
  return (
    <div className="mt-1.5">
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full ${i < score ? COLORS[score] : 'bg-slate-200'}`} />
        ))}
      </div>
      <p className="text-[11px] text-slate-400 mt-1">{label}</p>
    </div>
  );
}
