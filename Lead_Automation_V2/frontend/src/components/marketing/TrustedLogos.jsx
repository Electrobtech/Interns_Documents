const LOGOS = ['Trident Systems', 'Padmini Décor', 'VOC Automotive', 'Skillfinity', 'Rankzy', 'Vertex Labs'];

export default function TrustedLogos() {
  return (
    <div className="max-w-5xl mx-auto px-6 pt-12 pb-2 text-center">
      <p className="text-[10px] tracking-wide text-slate-400 uppercase" style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>
        Answering for teams at
      </p>
      <div className="flex items-center justify-center gap-9 flex-wrap mt-4">
        {LOGOS.map((l) => (
          <span key={l} className="text-[16px] font-semibold tracking-tight text-slate-300" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}
