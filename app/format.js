/* EXSALA HERMES MOD · powered by Gienetic */
/* Pure formatting helpers — no DOM, no imports. */

const ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** HTML-escape & < > " ' */
export function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

/** 1234 -> "$1,234", 1234.5 -> "$1,234.50", null -> "$0" */
export function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '$0';

  const fixed = Math.abs(n).toFixed(2);
  const [whole, cents] = fixed.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const body = cents === '00' ? grouped : `${grouped}.${cents}`;
  const negative = n < 0 && Number(fixed) !== 0;

  return `${negative ? '-' : ''}$${body}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** ISO -> "17 Nov 2026" */
export function date(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** ISO -> "3d 4h" / "5h 12m" / "42m" / "Closed" */
export function timeLeft(iso) {
  if (!iso) return '';
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return '';

  const ms = target - Date.now();
  if (ms <= 0) return 'Closed';

  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/** "85kF...AhEX" (4 + ellipsis + 4); full string when short. */
export function shortWallet(address) {
  const value = address === null || address === undefined ? '' : String(address);
  if (value.length <= 9) return value;
  return `${value.slice(0, 4)}\u2026${value.slice(-4)}`;
}

/** plural(1, 'bounty') -> "1 bounty"; plural(3, 'bounty') -> "3 bountys" */
export function plural(n, word) {
  const raw = Number(n);
  const count = Number.isFinite(raw) ? raw : 0;
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}
