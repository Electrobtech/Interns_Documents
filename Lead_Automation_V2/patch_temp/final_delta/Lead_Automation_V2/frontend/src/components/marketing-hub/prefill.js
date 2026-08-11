'use client';
/**
 * The Marketing Hub shell (MarketingHub.jsx) swaps pages by re-mounting a
 * component, not via URL params, so there's no query string to carry a
 * "create a campaign for this channel" handoff from the Channels page into
 * Campaigns/Broadcasts. sessionStorage is the simplest correct fix: set it
 * right before navigating, the target page reads-and-clears it once on
 * mount. Kept out of React context entirely on purpose — it's a one-shot
 * handoff, not ongoing shared state.
 */
const KEY = 'mh_prefill_channel';

export function setPrefillChannel(channel) {
  try { sessionStorage.setItem(KEY, channel); } catch { /* sessionStorage unavailable — silently skip the prefill */ }
}

// Read-once: clears itself so navigating back to the same page later
// doesn't re-trigger the auto-open.
export function consumePrefillChannel() {
  try {
    const v = sessionStorage.getItem(KEY);
    if (v) sessionStorage.removeItem(KEY);
    return v;
  } catch {
    return null;
  }
}
