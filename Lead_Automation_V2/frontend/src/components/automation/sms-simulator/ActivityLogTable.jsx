'use client';

/**
 * Right column (bottom half) — compact rolling log of simulated sends.
 * Newest first; parent unshifts each new run onto `entries`. Purely a view —
 * no fetching here, "View All Logs" is a placeholder link for the full
 * activity log page (out of scope for this simulator).
 */
export default function ActivityLogTable({ entries }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
        <h3 className="text-[14px] font-bold text-slate-800">Activity Log</h3>
        <a href="#" className="text-[12.5px] font-medium text-blue-600 hover:underline">
          View All Logs
        </a>
      </div>

      {entries.length === 0 ? (
        <div className="px-5 py-8 text-center text-[12.5px] text-slate-400">
          No simulations yet — run one above to see it here.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-100">
                <th className="font-semibold px-5 py-2 whitespace-nowrap">Time</th>
                <th className="font-semibold px-3 py-2 whitespace-nowrap">Channel</th>
                <th className="font-semibold px-3 py-2 whitespace-nowrap">To</th>
                <th className="font-semibold px-3 py-2">Message</th>
                <th className="font-semibold px-3 py-2 whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((row) => (
                <tr key={row.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-2.5 text-slate-500 whitespace-nowrap">{row.time}</td>
                  <td className="px-3 py-2.5 text-slate-700">{row.channel}</td>
                  <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">{row.to}</td>
                  <td className="px-3 py-2.5 text-slate-500 max-w-[220px] truncate">{row.message}</td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700">
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
