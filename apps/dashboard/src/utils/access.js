/**
 * Returns true when the app is accessed via local network (towerhill.local,
 * localhost, or a private IP). Used to gate configurable UI and the LLM
 * description on towerhill.app (Cloudflare tunnel).
 */
export function isLocalAccess() {
  if (typeof window === 'undefined' || !window.location?.hostname) return false;
  const h = window.location.hostname;

  if (h === 'towerhill.local' || h === 'localhost' || h === '127.0.0.1') return true;

  // Private IPv4 ranges
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(h)) return true;

  return false;
}
