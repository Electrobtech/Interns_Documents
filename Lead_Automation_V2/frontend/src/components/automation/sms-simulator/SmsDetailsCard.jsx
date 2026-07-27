'use client';

// Cost + segmentation math intentionally lives here (not the parent) since
// it's purely derived from `message` + GSM-7 vs UCS-2 charset — no state of
// its own, just a formatter for whatever text is currently simulated.
const GSM7_RE = /^[A-Za-z0-9 \r\n@£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ!"#$%&'()*+,\-./:;<=>?¡ÄÖÑÜ§¿äöñüà^{}\\\[~\]|€]*$/;

function segmentInfo(message) {
  const len = message.length;
  const isGsm7 = GSM7_RE.test(message);
  const singleLimit = isGsm7 ? 160 : 70;
  const multiLimit = isGsm7 ? 153 : 67;
  const segments = len === 0 ? 1 : len <= singleLimit ? 1 : Math.ceil(len / multiLimit);
  return { len, limit: segments === 1 ? singleLimit : multiLimit, segments };
}

const RATE_PER_SEGMENT = 0.2; // ₹, mock unit cost per SMS segment

export default function SmsDetailsCard({ phone, message, status, timeLabel }) {
  const { len, limit, segments } = segmentInfo(message);
  const cost = (segments * RATE_PER_SEGMENT).toFixed(2);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <h3 className="text-[14px] font-bold text-slate-800 mb-3">SMS Details</h3>
      <dl className="space-y-2.5 text-[13px]">
        <Row label="Channel" value="SMS" />
        <Row label="To" value={phone || '—'} />
        <Row
          label="Status"
          value={
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                status === 'success'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {status === 'success' ? 'Simulated' : 'Pending'}
            </span>
          }
        />
        <Row label="Time" value={timeLabel || '—'} />
        <Row label="Characters" value={`${len} / ${limit} (${segments} SMS)`} />
        <Row label="Cost (Est.)" value={`₹${cost} (Per SMS)`} />
      </dl>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-800 font-medium">{value}</dd>
    </div>
  );
}
