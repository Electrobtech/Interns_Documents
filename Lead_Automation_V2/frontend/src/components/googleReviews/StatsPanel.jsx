'use client';
import { Star, MessageSquareText, Clock3, CheckCircle2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

function StatCard({ icon: Icon, label, value, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-50 text-slate-500',
    amber: 'bg-amber-50 text-amber-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
  };
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg grid place-items-center ${tones[tone]}`}><Icon size={16} /></div>
      <div>
        <p className="text-lg font-bold text-slate-800 leading-tight">{value}</p>
        <p className="text-xs text-slate-400">{label}</p>
      </div>
    </div>
  );
}

export default function StatsPanel({ stats }) {
  if (!stats) return null;

  const distribution = [5, 4, 3, 2, 1].map((n) => ({
    star: `${n}★`,
    count: Number(stats[`star${n}`] || 0),
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Star} tone="amber" label="Average Rating" value={Number(stats.averageRating || 0).toFixed(1)} />
        <StatCard icon={MessageSquareText} tone="blue" label="Total Reviews" value={stats.total ?? 0} />
        <StatCard icon={Clock3} tone="slate" label="Pending Replies" value={stats.pendingReplies ?? 0} />
        <StatCard icon={CheckCircle2} tone="emerald" label="Completed Replies" value={stats.completedReplies ?? 0} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-slate-700 mb-2">Rating Distribution</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={distribution}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="star" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} width={28} />
              <Tooltip />
              <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-slate-700 mb-2">Monthly Reviews</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={stats.monthlyReviews || []}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} width={28} />
              <Tooltip />
              <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {!!(stats.replyTrend && stats.replyTrend.length) && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-slate-700 mb-2">Reply Trend</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={stats.replyTrend}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} width={28} />
              <Tooltip />
              <Bar dataKey="count" fill="#059669" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {stats.latestReviewAt && (
        <p className="text-xs text-slate-400">Latest review: {new Date(stats.latestReviewAt).toLocaleString()}</p>
      )}
    </div>
  );
}
