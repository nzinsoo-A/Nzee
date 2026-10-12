// Formattazione di importi, date e testi (lato server: email, CSV, causale).

const TIME_ZONE = 'Europe/Rome';

const euroFormatter = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
const dateTimeFormatter = new Intl.DateTimeFormat('it-IT', {
  timeZone: TIME_ZONE,
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const csvDateFormatter = new Intl.DateTimeFormat('it-IT', {
  timeZone: TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatEuro(cents) {
  return euroFormatter.format((cents || 0) / 100);
}

export function formatDateTime(ms) {
  return ms ? dateTimeFormatter.format(new Date(ms)) : '';
}

export function formatCsvDate(ms) {
  return ms ? csvDateFormatter.format(new Date(ms)).replace(',', '') : '';
}

// "2026-12-20T18:00" (ora italiana) -> "domenica 20 dicembre 2026, ore 18:00"
export function formatDrawDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(value || '');
  if (!m) return '';
  const [, y, mo, d, h, mi] = m;
  const date = new Date(Date.UTC(+y, +mo - 1, +d, +(h || 0), +(mi || 0)));
  const day = new Intl.DateTimeFormat('it-IT', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
  return h ? `${day}, ore ${h}:${mi}` : day;
}

export function formatIban(iban) {
  return (iban || '').replace(/(.{4})/g, '$1 ').trim();
}

// [812] -> "numero 812"; [812, 845, 870] -> "numeri 812, 845 e 870"
export function numbersLabel(numbers) {
  if (numbers.length === 1) return `numero ${numbers[0]}`;
  return `numeri ${numbers.slice(0, -1).join(', ')} e ${numbers[numbers.length - 1]}`;
}

export function escapeHtml(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch],
  );
}

export function firstName(fullName) {
  return (fullName || '').trim().split(/\s+/)[0] || '';
}
