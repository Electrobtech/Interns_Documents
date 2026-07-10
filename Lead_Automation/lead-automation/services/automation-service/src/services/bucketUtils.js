/**
 * Produces the current time-bucket string for a given throttle window.
 * Bucketing this way means "reset limits daily" requires zero cron jobs —
 * the bucket key itself rolls over naturally at midnight/week/month boundary.
 */
function getCurrentBucket(window) {
  const now = new Date();
  switch (window) {
    case 'daily':
      return now.toISOString().slice(0, 10); // "2026-07-03"
    case 'weekly': {
      const oneJan = new Date(now.getFullYear(), 0, 1);
      const week = Math.ceil((((now - oneJan) / 86400000) + oneJan.getDay() + 1) / 7);
      return `${now.getFullYear()}-W${String(week).padStart(2, '0')}`;
    }
    case 'monthly':
      return now.toISOString().slice(0, 7); // "2026-07"
    case 'all_time':
    default:
      return 'all';
  }
}
 
module.exports = { getCurrentBucket };