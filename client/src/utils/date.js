// Centralised date formatting for the whole frontend.
// Backend sends dates as 'YYYY-MM-DD' or datetimes as 'YYYY-MM-DD HH:MM:SS' / ISO.
// We parse the leading parts with a regex (no `new Date()`) to avoid timezone drift.

// -> 'DD-MM-YYYY' (empty string for falsy/unparseable-but-empty input)
export function formatDate(value) {
  if (!value) return '';
  const s = String(value);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  // Fallback for other parseable formats
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}-${mm}-${d.getFullYear()}`;
  }
  return s;
}

// -> 'DD-MM-YYYY HH:MM' (keeps the time part when present)
export function formatDateTime(value) {
  if (!value) return '';
  const s = String(value);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]} ${m[4]}:${m[5]}`;
  return formatDate(s);
}
