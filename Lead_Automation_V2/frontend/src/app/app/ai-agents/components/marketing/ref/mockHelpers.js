/** Shared helpers for mock-data tabs (white-theme charts + status tones). */

export const CHART = {
  grid: '#E4E8F0',
  tick: '#94A3B8',
  tooltip: {
    background: '#ffffff',
    border: '1px solid #E4E8F0',
    borderRadius: 8,
    fontSize: 12,
    color: '#334155',
  },
};

const STATUS_TONE = {
  Active: 'green',
  Paused: 'amber',
  Scheduled: 'blue',
  Draft: 'slate',
  Sent: 'green',
  Running: 'green',
};

export function campaignStatusTone(status) {
  return STATUS_TONE[status] || 'slate';
}

export function sparkline(seed, n = 8) {
  let v = 30 + seed * 7;
  return Array.from({ length: n }, () => {
    v = Math.max(5, Math.min(100, v + (Math.random() * 20 - 10)));
    return { v: Math.round(v) };
  });
}

export const KANBAN_COLS = ['Draft', 'Scheduled', 'Active', 'Paused'];
export const KANBAN_COLORS = {
  Draft: '#64748B',
  Scheduled: '#3B6EF0',
  Active: '#059669',
  Paused: '#D97706',
};
