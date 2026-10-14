// Logica dei dati della lotteria: numeri, ordini, impostazioni, sessioni admin.
//
// Il codice è indipendente dalla piattaforma: lavora su un piccolo "adattatore" SQL
// sincrono. In produzione è il database SQLite del Durable Object di Cloudflare,
// nei test è node:sqlite.

import { formatCsvDate, formatIban } from './format.js';

export const DEFAULT_SETTINGS = Object.freeze({
  title: 'Lotteria Zampette',
  tagline: 'Un biglietto, mille code felici',
  description:
    'Scegli il tuo numero fortunato e aiutaci a prenderci cura dei nostri amici a quattro zampe. ' +
    'Tutto il ricavato sarà devoluto in beneficenza.',
  organization: '',
  prizes: '',
  drawDate: '',
  drawPlace: '',
  ticketPriceCents: 1000,
  // Gruppi di numeri in vendita ("da" … "a"); se ne possono aggiungere altri dall'area riservata.
  numberRanges: Object.freeze([Object.freeze({ from: 801, to: 900 })]),
  maxPerOrder: 10,
  salesOpen: true,
  beneficiary: '',
  iban: '',
  bic: '',
  bankName: '',
  causalePrefix: 'Lotteria',
  paymentNotes: '',
  contactEmail: '',
  notifyAdmin: true,
});

const SETTINGS_RULES = {
  title: { type: 'text', max: 80, required: true },
  tagline: { type: 'text', max: 160 },
  description: { type: 'multiline', max: 2000 },
  organization: { type: 'text', max: 120 },
  prizes: { type: 'multiline', max: 2000 },
  drawDate: { type: 'drawDate' },
  drawPlace: { type: 'text', max: 160 },
  ticketPriceCents: { type: 'int', min: 1, max: 100000, message: 'Inserisci un prezzo tra 0,01 € e 1.000 €.' },
  numberRanges: { type: 'ranges' },
  maxPerOrder: { type: 'int', min: 1, max: 20 },
  salesOpen: { type: 'bool' },
  beneficiary: { type: 'text', max: 120 },
  iban: { type: 'iban' },
  bic: { type: 'bic' },
  bankName: { type: 'text', max: 120 },
  causalePrefix: { type: 'text', max: 40 },
  paymentNotes: { type: 'multiline', max: 1000 },
  contactEmail: { type: 'email' },
  notifyAdmin: { type: 'bool' },
};

const MAX_TOTAL_NUMBERS = 1000;
const MAX_RANGES = 20;
const MAX_NUMBER = 99999;
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:".]{2,}$/;
const PHONE_RE = /^[+0-9 ().\-/]{5,30}$/;
const STATUS_LABELS = { pending: 'In attesa di pagamento', confirmed: 'Confermato', cancelled: 'Annullato' };

export class AppError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
  }

  toJSON() {
    return { code: this.code, message: this.message, ...(this.details ? { details: this.details } : {}) };
  }
}

// Adattatore per lo SQLite dei Durable Object di Cloudflare.
export function doSqlAdapter(storage) {
  const sql = storage.sql;
  return {
    all: (query, ...params) => sql.exec(query, ...params).toArray(),
    get: (query, ...params) => sql.exec(query, ...params).toArray()[0] ?? null,
    run: (query, ...params) => {
      sql.exec(query, ...params).toArray();
    },
    tx: (fn) => storage.transactionSync(fn),
  };
}

export class RaffleStore {
  constructor(sql, { now = () => Date.now() } = {}) {
    this.sql = sql;
    this.now = now;
  }

  migrate() {
    const statements = [
      `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        token TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'cancelled')),
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL DEFAULT '',
        note TEXT NOT NULL DEFAULT '',
        numbers TEXT NOT NULL,
        unit_price_cents INTEGER NOT NULL,
        total_cents INTEGER NOT NULL,
        source TEXT NOT NULL DEFAULT 'web',
        cancel_reason TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        confirmed_at INTEGER,
        cancelled_at INTEGER
      )`,
      `CREATE INDEX IF NOT EXISTS orders_status ON orders (status, created_at)`,
      // Un numero può stare in questa tabella una sola volta: è la garanzia
      // che lo stesso numero non venga mai venduto a due persone.
      `CREATE TABLE IF NOT EXISTS tickets (
        number INTEGER PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders (id)
      )`,
      `CREATE INDEX IF NOT EXISTS tickets_order ON tickets (order_id)`,
      `CREATE TABLE IF NOT EXISTS emails (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER,
        kind TEXT NOT NULL,
        recipient TEXT NOT NULL,
        status TEXT NOT NULL,
        error TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS emails_order ON emails (order_id)`,
      `CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      )`,
    ];
    for (const statement of statements) this.sql.run(statement);
  }

  // ---------------------------------------------------------------- impostazioni

  getSettings() {
    const settings = structuredClone(DEFAULT_SETTINGS);
    for (const row of this.sql.all('SELECT key, value FROM settings')) {
      if (!(row.key in DEFAULT_SETTINGS)) continue;
      try {
        settings[row.key] = JSON.parse(row.value);
      } catch {
        // valore corrotto: resta quello predefinito
      }
    }
    return settings;
  }

  updateSettings(patch) {
    const current = this.getSettings();
    const merged = { ...current };
    for (const key of Object.keys(SETTINGS_RULES)) {
      if (patch && Object.hasOwn(patch, key)) merged[key] = patch[key];
    }
    const next = validateSettings(merged);

    // Un numero già prenotato o venduto non può sparire dalla vendita.
    const outside = this.sql
      .all('SELECT number FROM tickets ORDER BY number')
      .map((row) => row.number)
      .filter((n) => !inRanges(n, next.numberRanges));
    if (outside.length) {
      const list = outside.slice(0, 5).join(', ') + (outside.length > 5 ? '…' : '');
      throw new AppError('invalid_settings', 'Controlla le impostazioni.', {
        fields: {
          numberRanges:
            outside.length === 1
              ? `Il numero ${list} è già prenotato o venduto: non puoi toglierlo dalla vendita.`
              : `I numeri ${list} sono già prenotati o venduti: non puoi toglierli dalla vendita.`,
        },
      });
    }

    this.sql.tx(() => {
      for (const key of Object.keys(SETTINGS_RULES)) {
        if (JSON.stringify(next[key]) === JSON.stringify(current[key])) continue;
        this.sql.run(
          `INSERT INTO settings (key, value) VALUES (?, ?)
           ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
          key,
          JSON.stringify(next[key]),
        );
      }
    });
    return this.getSettings();
  }

  // ---------------------------------------------------------------- pubblico

  publicState() {
    const settings = this.getSettings();
    const { taken, sold, reserved } = this.#takenNumbers(settings);
    const total = rangesTotal(settings.numberRanges);
    return {
      settings: publicSettings(settings),
      taken,
      counts: { total, sold, reserved, available: total - sold - reserved },
    };
  }

  // ---------------------------------------------------------------- ordini

  createOrder(input, { source = 'web' } = {}) {
    const settings = this.getSettings();
    if (!settings.salesOpen && source === 'web') {
      throw new AppError('sales_closed', 'Le vendite dei biglietti sono chiuse.');
    }
    const data = validateOrderInput(input, settings);

    return this.sql.tx(() => {
      const placeholders = data.numbers.map(() => '?').join(', ');
      const taken = this.sql
        .all(`SELECT number FROM tickets WHERE number IN (${placeholders}) ORDER BY number`, ...data.numbers)
        .map((row) => row.number);
      if (taken.length) {
        const message =
          taken.length === 1
            ? `Il numero ${taken[0]} è appena stato prenotato da qualcun altro.`
            : `I numeri ${taken.join(', ')} sono appena stati prenotati da qualcun altro.`;
        throw new AppError('numbers_taken', message, { numbers: taken });
      }

      const now = this.now();
      const code = this.#newOrderCode();
      const row = this.sql.get(
        `INSERT INTO orders (code, token, status, name, email, phone, note, numbers,
                             unit_price_cents, total_cents, source, created_at, updated_at)
         VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING id`,
        code,
        randomToken(16),
        data.name,
        data.email,
        data.phone,
        data.note,
        JSON.stringify(data.numbers),
        settings.ticketPriceCents,
        settings.ticketPriceCents * data.numbers.length,
        source,
        now,
        now,
      );
      for (const number of data.numbers) {
        this.sql.run('INSERT INTO tickets (number, order_id) VALUES (?, ?)', number, row.id);
      }
      return this.#orderById(row.id);
    });
  }

  getOrder(code) {
    const row = this.sql.get('SELECT * FROM orders WHERE code = ?', normalizeCode(code));
    if (!row) throw new AppError('not_found', 'Ordine non trovato.');
    return mapOrder(row);
  }

  // Vista per chi ha prenotato: serve il codice ordine + il token segreto del link.
  buyerOrder(code, token) {
    const row = this.sql.get('SELECT * FROM orders WHERE code = ?', normalizeCode(code));
    if (!row || !safeEqual(String(token || ''), row.token)) {
      throw new AppError('not_found', 'Ordine non trovato. Controlla il link ricevuto via email.');
    }
    return buyerView(mapOrder(row), this.getSettings());
  }

  confirmOrder(code) {
    return this.sql.tx(() => {
      const order = this.getOrder(code);
      if (order.status !== 'pending') {
        throw new AppError(
          'invalid_state',
          `L'ordine ${order.code} è già ${STATUS_LABELS[order.status].toLowerCase()}.`,
        );
      }
      const now = this.now();
      this.sql.run(
        `UPDATE orders SET status = 'confirmed', confirmed_at = ?, updated_at = ? WHERE id = ?`,
        now,
        now,
        order.id,
      );
      return this.#orderById(order.id);
    });
  }

  // Annulla l'ordine e rimette in vendita i suoi numeri.
  cancelOrder(code, reason = '') {
    return this.sql.tx(() => {
      const order = this.getOrder(code);
      if (order.status === 'cancelled') {
        throw new AppError('invalid_state', `L'ordine ${order.code} è già annullato.`);
      }
      const now = this.now();
      this.sql.run(
        `UPDATE orders SET status = 'cancelled', cancelled_at = ?, cancel_reason = ?, updated_at = ? WHERE id = ?`,
        now,
        cleanText(reason, true).slice(0, 500),
        now,
        order.id,
      );
      this.sql.run('DELETE FROM tickets WHERE order_id = ?', order.id);
      return this.#orderById(order.id);
    });
  }

  // Elimina definitivamente un ordine annullato (es. ordini di prova o richiesta di cancellazione dei dati).
  deleteOrder(code) {
    return this.sql.tx(() => {
      const order = this.getOrder(code);
      if (order.status !== 'cancelled') {
        throw new AppError('invalid_state', "Si possono eliminare solo gli ordini annullati: prima annulla l'ordine.");
      }
      this.sql.run('DELETE FROM emails WHERE order_id = ?', order.id);
      this.sql.run('DELETE FROM orders WHERE id = ?', order.id);
      return { code: order.code };
    });
  }

  listOrders() {
    const orders = this.sql.all('SELECT * FROM orders ORDER BY created_at DESC, id DESC').map(mapOrder);
    const emails = this.sql.all(
      `SELECT order_id, kind, recipient, status, error, created_at
       FROM emails WHERE order_id IS NOT NULL ORDER BY id`,
    );
    const byOrder = new Map();
    for (const email of emails) {
      if (!byOrder.has(email.order_id)) byOrder.set(email.order_id, []);
      byOrder.get(email.order_id).push({
        kind: email.kind,
        recipient: email.recipient,
        status: email.status,
        error: email.error,
        createdAt: email.created_at,
      });
    }
    for (const order of orders) order.emails = byOrder.get(order.id) || [];
    return orders;
  }

  stats(settings = this.getSettings()) {
    const tickets = this.#takenNumbers(settings);
    const orders = this.sql.get(
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pending,
         COALESCE(SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END), 0) AS confirmed,
         COALESCE(SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END), 0) AS cancelled,
         COALESCE(SUM(CASE WHEN status = 'confirmed' THEN total_cents ELSE 0 END), 0) AS raised_cents,
         COALESCE(SUM(CASE WHEN status = 'pending' THEN total_cents ELSE 0 END), 0) AS pending_cents
       FROM orders`,
    );
    const total = rangesTotal(settings.numberRanges);
    return {
      total,
      sold: tickets.sold,
      reserved: tickets.reserved,
      available: total - tickets.sold - tickets.reserved,
      ordersPending: orders.pending,
      ordersConfirmed: orders.confirmed,
      ordersCancelled: orders.cancelled,
      raisedCents: orders.raised_cents,
      pendingCents: orders.pending_cents,
    };
  }

  adminOverview() {
    const settings = this.getSettings();
    return { settings, orders: this.listOrders(), stats: this.stats(settings), taken: this.publicState().taken };
  }

  logEmail({ orderId = null, kind, recipient, status, error = '' }) {
    this.sql.run(
      `INSERT INTO emails (order_id, kind, recipient, status, error, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      orderId,
      kind,
      recipient || '',
      status,
      String(error || '').slice(0, 500),
      this.now(),
    );
  }

  exportCsv() {
    const header = [
      'Codice',
      'Stato',
      'Numeri',
      'Quantità',
      'Importo (€)',
      'Nome',
      'Email',
      'Telefono',
      'Messaggio',
      'Prenotato il',
      'Confermato il',
      'Annullato il',
      'Motivo annullamento',
      'Origine',
    ];
    const rows = this.listOrders()
      .reverse()
      .map((o) => [
        o.code,
        STATUS_LABELS[o.status],
        o.numbers.join(' '),
        String(o.numbers.length),
        (o.totalCents / 100).toFixed(2).replace('.', ','),
        safeCsvText(o.name),
        safeCsvText(o.email),
        o.phone,
        safeCsvText(o.note),
        formatCsvDate(o.createdAt),
        formatCsvDate(o.confirmedAt),
        formatCsvDate(o.cancelledAt),
        safeCsvText(o.cancelReason),
        o.source === 'admin' ? 'Inserito da admin' : 'Sito',
      ]);
    // Punto e virgola + BOM: si apre correttamente con Excel in italiano.
    return String.fromCharCode(0xfeff) + [header, ...rows].map((r) => r.map(csvCell).join(';')).join('\r\n') + '\r\n';
  }

  // ---------------------------------------------------------------- sessioni admin

  createSession(idHash, ttlMs) {
    const now = this.now();
    this.sql.run('DELETE FROM sessions WHERE expires_at <= ?', now);
    this.sql.run('INSERT INTO sessions (id, created_at, expires_at) VALUES (?, ?, ?)', idHash, now, now + ttlMs);
  }

  verifySession(idHash) {
    const row = this.sql.get('SELECT expires_at FROM sessions WHERE id = ?', idHash);
    return Boolean(row && row.expires_at > this.now());
  }

  deleteSession(idHash) {
    this.sql.run('DELETE FROM sessions WHERE id = ?', idHash);
  }

  // ---------------------------------------------------------------- interni

  // Numeri in vendita già presi: { taken: { 812: 'reserved', 845: 'sold' }, sold, reserved }
  #takenNumbers(settings) {
    const rows = this.sql.all(
      `SELECT t.number AS number, o.status AS status FROM tickets t JOIN orders o ON o.id = t.order_id`,
    );
    const taken = {};
    let sold = 0;
    let reserved = 0;
    for (const row of rows) {
      if (!inRanges(row.number, settings.numberRanges)) continue;
      if (row.status === 'confirmed') {
        taken[row.number] = 'sold';
        sold++;
      } else {
        taken[row.number] = 'reserved';
        reserved++;
      }
    }
    return { taken, sold, reserved };
  }

  #orderById(id) {
    return mapOrder(this.sql.get('SELECT * FROM orders WHERE id = ?', id));
  }

  #newOrderCode() {
    for (let attempt = 0; attempt < 20; attempt++) {
      const code = randomCode(5);
      if (!this.sql.get('SELECT 1 AS found FROM orders WHERE code = ?', code)) return code;
    }
    throw new Error('Impossibile generare un codice ordine univoco');
  }
}

// ------------------------------------------------------------------ viste

export function publicSettings(s) {
  return {
    title: s.title,
    tagline: s.tagline,
    description: s.description,
    organization: s.organization,
    prizes: s.prizes,
    drawDate: s.drawDate,
    drawPlace: s.drawPlace,
    ticketPriceCents: s.ticketPriceCents,
    numberRanges: s.numberRanges.map((r) => ({ from: r.from, to: r.to })),
    maxPerOrder: s.maxPerOrder,
    salesOpen: s.salesOpen,
    contactEmail: s.contactEmail,
  };
}

export function buyerView(order, settings) {
  return {
    code: order.code,
    status: order.status,
    name: order.name,
    email: order.email,
    numbers: order.numbers,
    unitPriceCents: order.unitPriceCents,
    totalCents: order.totalCents,
    createdAt: order.createdAt,
    confirmedAt: order.confirmedAt,
    cancelledAt: order.cancelledAt,
    cancelReason: order.cancelReason,
    payment: paymentInfo(order, settings),
    event: publicSettings(settings),
  };
}

export function paymentInfo(order, settings) {
  return {
    configured: Boolean(settings.iban && settings.beneficiary),
    beneficiary: settings.beneficiary,
    iban: settings.iban,
    ibanFormatted: formatIban(settings.iban),
    bic: settings.bic,
    bankName: settings.bankName,
    notes: settings.paymentNotes,
    amountCents: order.totalCents,
    causale: buildCausale(order, settings),
  };
}

// La causale del bonifico SEPA può contenere al massimo 140 caratteri.
export function buildCausale(order, settings) {
  const prefix = (settings.causalePrefix || 'Lotteria').trim();
  const full = `${prefix} ${order.code} - N. ${order.numbers.join(' ')}`;
  return full.length <= 140 ? full : `${prefix} ${order.code}`.slice(0, 140);
}

function mapOrder(row) {
  return {
    id: row.id,
    code: row.code,
    token: row.token,
    status: row.status,
    name: row.name,
    email: row.email,
    phone: row.phone,
    note: row.note,
    numbers: JSON.parse(row.numbers),
    unitPriceCents: row.unit_price_cents,
    totalCents: row.total_cents,
    source: row.source,
    cancelReason: row.cancel_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    confirmedAt: row.confirmed_at ?? null,
    cancelledAt: row.cancelled_at ?? null,
  };
}

// ------------------------------------------------------------------ validazione

function cleanText(value, multiline = false) {
  const text = String(value ?? '');
  return (
    multiline
      ? text.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
      : text.replace(/[\u0000-\u001f\u007f]+/g, ' ')
  ).trim();
}

export function validateOrderInput(input, settings) {
  const errors = {};
  const raw = Array.isArray(input?.numbers) ? input.numbers : [];
  const numbers = [...new Set(raw.map((n) => Number(n)))].sort((a, b) => a - b);
  if (!numbers.length) {
    errors.numbers = 'Seleziona almeno un numero.';
  } else if (numbers.some((n) => !Number.isInteger(n) || !inRanges(n, settings.numberRanges))) {
    errors.numbers = `Numero non valido: i numeri in vendita sono ${describeRanges(settings.numberRanges)}.`;
  } else if (numbers.length > settings.maxPerOrder) {
    errors.numbers = `Puoi prenotare al massimo ${settings.maxPerOrder} numeri per volta.`;
  }

  const name = cleanText(input?.name);
  if (name.length < 3 || !/\p{L}/u.test(name)) errors.name = 'Inserisci nome e cognome.';
  else if (name.length > 100) errors.name = 'Il nome è troppo lungo (massimo 100 caratteri).';

  const email = cleanText(input?.email);
  if (!EMAIL_RE.test(email) || email.length > 254) errors.email = 'Inserisci un indirizzo email valido.';

  const phone = cleanText(input?.phone);
  if (phone && !PHONE_RE.test(phone)) errors.phone = 'Il numero di telefono non sembra valido.';

  const note = cleanText(input?.note, true);
  if (note.length > 500) errors.note = 'Il messaggio è troppo lungo (massimo 500 caratteri).';

  if (input?.privacy !== true) errors.privacy = "Per continuare devi accettare l'informativa privacy.";

  if (Object.keys(errors).length) {
    throw new AppError('invalid_input', 'Controlla i dati inseriti.', { fields: errors });
  }
  return { numbers, name, email, phone, note };
}

export function validateSettings(input) {
  const out = {};
  const errors = {};
  for (const [key, rule] of Object.entries(SETTINGS_RULES)) {
    const value = input[key];
    switch (rule.type) {
      case 'text':
      case 'multiline': {
        const text = cleanText(value, rule.type === 'multiline');
        if (rule.required && !text) errors[key] = 'Campo obbligatorio.';
        else if (text.length > rule.max) errors[key] = `Massimo ${rule.max} caratteri.`;
        out[key] = text;
        break;
      }
      case 'int': {
        const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
        if (!Number.isInteger(n) || n < rule.min || n > rule.max) {
          errors[key] = rule.message || `Inserisci un numero intero tra ${rule.min} e ${rule.max}.`;
        }
        out[key] = n;
        break;
      }
      case 'bool':
        out[key] = value === true || value === 'true' || value === 1 || value === 'on';
        break;
      case 'drawDate': {
        const text = cleanText(value);
        if (text && !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(text)) errors[key] = 'Data non valida.';
        out[key] = text;
        break;
      }
      case 'iban': {
        const iban = normalizeIban(value);
        if (iban && !isValidIban(iban)) errors[key] = 'IBAN non valido: controlla di averlo copiato correttamente.';
        out[key] = iban;
        break;
      }
      case 'bic': {
        const bic = cleanText(value).toUpperCase().replace(/\s+/g, '');
        if (bic && !/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic)) errors[key] = 'Codice BIC/SWIFT non valido.';
        out[key] = bic;
        break;
      }
      case 'email': {
        const email = cleanText(value);
        if (email && (!EMAIL_RE.test(email) || email.length > 254)) errors[key] = 'Indirizzo email non valido.';
        out[key] = email;
        break;
      }
      case 'ranges': {
        const ranges = (Array.isArray(value) ? value : []).map((r) => ({ from: toInt(r?.from), to: toInt(r?.to) }));
        const problem = rangesProblem(ranges);
        if (problem) errors[key] = problem;
        out[key] = ranges.sort((a, b) => a.from - b.from);
        break;
      }
    }
  }
  if (Object.keys(errors).length) {
    throw new AppError('invalid_settings', 'Controlla le impostazioni.', { fields: errors });
  }
  return out;
}

// ------------------------------------------------------------------ gruppi di numeri

export function inRanges(n, ranges) {
  return ranges.some((r) => n >= r.from && n <= r.to);
}

export function rangesTotal(ranges) {
  return ranges.reduce((sum, r) => sum + r.to - r.from + 1, 0);
}

// [{801, 900}, {1001, 1050}] -> "801–900, 1001–1050"
export function describeRanges(ranges) {
  return ranges.map((r) => (r.from === r.to ? String(r.from) : `${r.from}–${r.to}`)).join(', ');
}

function toInt(value) {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return Number.isInteger(n) ? n : NaN;
}

function rangesProblem(ranges) {
  if (!ranges.length) return 'Serve almeno un gruppo di numeri.';
  if (ranges.length > MAX_RANGES) return `Al massimo ${MAX_RANGES} gruppi di numeri.`;
  for (const r of ranges) {
    if (!Number.isInteger(r.from) || !Number.isInteger(r.to) || r.from < 0 || r.to > MAX_NUMBER) {
      return `Indica per ogni gruppo il numero "da" e il numero "a" (numeri interi da 0 a ${MAX_NUMBER}).`;
    }
    if (r.from > r.to) return `Nel gruppo ${r.from}–${r.to} il numero "da" deve essere più piccolo del numero "a".`;
  }
  const sorted = [...ranges].sort((a, b) => a.from - b.from);
  for (let i = 1; i < sorted.length; i++) {
    const [a, b] = [sorted[i - 1], sorted[i]];
    if (b.from <= a.to) return `I numeri ${describeRanges([a])} e ${describeRanges([b])} si sovrappongono.`;
  }
  const total = rangesTotal(sorted);
  if (total > MAX_TOTAL_NUMBERS) return `In totale al massimo ${MAX_TOTAL_NUMBERS} numeri (così sarebbero ${total}).`;
  return '';
}

// ------------------------------------------------------------------ IBAN

export function normalizeIban(value) {
  return String(value ?? '')
    .toUpperCase()
    .replace(/[\s-]+/g, '');
}

export function isValidIban(iban) {
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  if (iban.startsWith('IT') && iban.length !== 27) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const digits = ch >= 'A' ? String(ch.charCodeAt(0) - 55) : ch;
    for (const d of digits) remainder = (remainder * 10 + Number(d)) % 97;
  }
  return remainder === 1;
}

// ------------------------------------------------------------------ utilità

function normalizeCode(code) {
  return String(code ?? '')
    .trim()
    .toUpperCase();
}

function randomCode(length) {
  let code = '';
  const limit = 256 - (256 % CODE_ALPHABET.length);
  while (code.length < length) {
    for (const byte of crypto.getRandomValues(new Uint8Array(length * 2))) {
      if (byte < limit && code.length < length) code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
    }
  }
  return code;
}

export function randomToken(bytes = 16) {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Evita che un testo inserito da un utente venga interpretato come formula da Excel.
function safeCsvText(value) {
  return /^[=+\-@\t\r]/.test(value || '') ? `'${value}` : value || '';
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
