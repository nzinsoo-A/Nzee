// Punto di ingresso su Cloudflare Workers.
//
// - Le pagine in /public sono servite direttamente da Cloudflare (static assets).
// - Le richieste /api/* arrivano qui (Hono) e leggono/scrivono i dati tramite il
//   Durable Object "Raffle", che custodisce il database SQLite della lotteria.

import { DurableObject } from 'cloudflare:workers';
import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { AppError, RaffleStore, doSqlAdapter, randomToken } from './store.js';
import { buildEmail } from './emails.js';
import { mailStatus, sendMail } from './mailer.js';

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_BODY_BYTES = 32 * 1024;
const ERROR_STATUS = {
  invalid_input: 400,
  invalid_settings: 400,
  bad_request: 400,
  unauthorized: 401,
  bad_password: 401,
  forbidden: 403,
  not_found: 404,
  numbers_taken: 409,
  sales_closed: 409,
  invalid_state: 409,
  unsupported_media_type: 415,
  rate_limited: 429,
  not_configured: 503,
};

// ====================================================================== database

export class Raffle extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.store = new RaffleStore(doSqlAdapter(ctx.storage));
    this.store.migrate();
    this.rateBuckets = new Map();
    // Copie in memoria dei dati letti più spesso (home page e controlli periodici):
    // si azzerano a ogni modifica, così il database lavora solo quando serve.
    this.cache = {};
  }

  #changed(result) {
    this.cache = {};
    return result;
  }

  // Esegue un'operazione del database e trasforma gli errori "previsti" in risultati.
  #call(fn) {
    try {
      return { ok: true, data: fn() };
    } catch (err) {
      if (err instanceof AppError) return { ok: false, error: err.toJSON() };
      throw err;
    }
  }

  #allow(key, limit, windowMs) {
    const now = Date.now();
    let bucket = this.rateBuckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      this.rateBuckets.set(key, bucket);
    }
    bucket.count++;
    if (this.rateBuckets.size > 5000) {
      for (const [k, b] of this.rateBuckets) if (b.resetAt <= now) this.rateBuckets.delete(k);
    }
    return bucket.count <= limit;
  }

  publicState() {
    return (this.cache.publicState ??= this.store.publicState());
  }

  settings() {
    return (this.cache.settings ??= this.store.getSettings());
  }

  createOrder(input, clientKey) {
    if (!this.#allow(`order:${clientKey}`, 8, 10 * 60 * 1000)) {
      return {
        ok: false,
        error: { code: 'rate_limited', message: 'Troppe prenotazioni in poco tempo: riprova tra qualche minuto.' },
      };
    }
    return this.#changed(this.#call(() => this.store.createOrder(input)));
  }

  buyerOrder(code, token) {
    return this.#call(() => this.store.buyerOrder(code, token));
  }

  overview() {
    return this.store.adminOverview();
  }

  order(code) {
    return this.#call(() => this.store.getOrder(code));
  }

  confirmOrder(code) {
    return this.#changed(this.#call(() => this.store.confirmOrder(code)));
  }

  cancelOrder(code, reason) {
    return this.#changed(this.#call(() => this.store.cancelOrder(code, reason)));
  }

  deleteOrder(code) {
    return this.#changed(this.#call(() => this.store.deleteOrder(code)));
  }

  updateSettings(patch) {
    return this.#changed(this.#call(() => this.store.updateSettings(patch)));
  }

  logEmail(entry) {
    this.store.logEmail(entry);
  }

  exportCsv() {
    return this.store.exportCsv();
  }

  allowLoginAttempt(clientKey) {
    return this.#allow(`login:${clientKey}`, 10, 15 * 60 * 1000);
  }

  allowTestEmail() {
    return this.#allow('test-email', 10, 60 * 60 * 1000);
  }

  createSession(idHash) {
    this.store.createSession(idHash, SESSION_TTL_MS);
  }

  verifySession(idHash) {
    return this.store.verifySession(idHash);
  }

  deleteSession(idHash) {
    this.store.deleteSession(idHash);
  }
}

// ====================================================================== API HTTP

const app = new Hono();

// Un solo database per tutta la lotteria, creato in Europa occidentale (vicino a chi la usa).
const raffle = (c) => c.env.RAFFLE.get(c.env.RAFFLE.idFromName('lotteria'), { locationHint: 'weur' });

function fail(c, code, message, details) {
  return c.json({ error: { code, message, ...(details ? { details } : {}) } }, ERROR_STATUS[code] || 400);
}

function failWith(c, error) {
  return c.json({ error }, ERROR_STATUS[error.code] || 400);
}

function clientKey(c) {
  return c.req.header('cf-connecting-ip') || 'local';
}

async function readJson(c) {
  const text = await c.req.text();
  if (text.length > MAX_BODY_BYTES) throw new AppError('bad_request', 'Richiesta troppo grande.');
  if (!text) return {};
  try {
    const data = JSON.parse(text);
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch {
    throw new AppError('bad_request', 'Richiesta non valida.');
  }
}

async function sha256(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function passwordMatches(given, expected) {
  // Confronto a tempo costante (si confrontano gli hash, che hanno sempre la stessa lunghezza).
  const [a, b] = await Promise.all([sha256(`pw:${given}`), sha256(`pw:${expected}`)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function sessionCookieName(c) {
  return new URL(c.req.url).protocol === 'https:' ? '__Host-lotteria_admin' : 'lotteria_admin';
}

// Invia un'email legata a un ordine e la registra nello storico dell'ordine.
async function deliver(c, { kind, order, settings, message, reason, to }) {
  const recipient = to ?? (kind === 'admin_new' ? settings.contactEmail : order.email);
  if (!recipient) return { status: 'skipped', error: 'Nessun destinatario' };
  const origin = new URL(c.req.url).origin;
  const email = buildEmail(kind, { order, settings, origin, message, reason });
  const result = await sendMail(c.env, {
    to: recipient,
    ...email,
    replyTo: kind === 'admin_new' ? order?.email : settings.contactEmail,
    fromName: settings.organization || settings.title,
  });
  if (order) {
    await raffle(c).logEmail({
      orderId: order.id,
      kind,
      recipient,
      status: result.status,
      error: result.error || '',
    });
  }
  return result;
}

// Intestazioni comuni e gestione degli errori.
app.use('/api/*', async (c, next) => {
  await next();
  c.header('Cache-Control', 'no-store');
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'same-origin');
});

app.onError((err, c) => {
  if (err instanceof AppError) return fail(c, err.code, err.message, err.details);
  console.error('Errore inatteso:', err);
  return c.json({ error: { code: 'server_error', message: 'Si è verificato un errore. Riprova tra poco.' } }, 500);
});

// Protezione CSRF: le richieste che modificano dati devono essere JSON e provenire dal sito stesso.
app.use('/api/*', async (c, next) => {
  if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
    const origin = c.req.header('origin');
    if (origin && origin !== new URL(c.req.url).origin) return fail(c, 'forbidden', 'Origine non consentita.');
    if (!(c.req.header('content-type') || '').includes('application/json')) {
      return fail(c, 'unsupported_media_type', 'Formato della richiesta non supportato.');
    }
  }
  await next();
});

// ---------------------------------------------------------------- pubblico

app.get('/api/public', async (c) => c.json(await raffle(c).publicState()));

app.post('/api/orders', async (c) => {
  const body = await readJson(c);
  // Campo nascosto "website": se è compilato, è un bot.
  if (body.website) return fail(c, 'bad_request', 'Richiesta non valida.');
  const result = await raffle(c).createOrder(
    {
      numbers: body.numbers,
      name: body.name,
      email: body.email,
      phone: body.phone,
      note: body.note,
      privacy: body.privacy,
    },
    clientKey(c),
  );
  if (!result.ok) return failWith(c, result.error);

  const order = result.data;
  // Le email partono in background: chi prenota vede subito i dati del bonifico.
  c.executionCtx.waitUntil(
    (async () => {
      try {
        const settings = await raffle(c).settings();
        await deliver(c, { kind: 'reservation', order, settings });
        if (settings.notifyAdmin && settings.contactEmail) await deliver(c, { kind: 'admin_new', order, settings });
      } catch (err) {
        console.error(`Email per l'ordine ${order.code} non gestite:`, err);
      }
    })(),
  );
  return c.json({ code: order.code, token: order.token }, 201);
});

app.get('/api/orders/:code', async (c) => {
  const result = await raffle(c).buyerOrder(c.req.param('code'), c.req.query('t'));
  if (!result.ok) return failWith(c, result.error);
  return c.json(result.data);
});

// ---------------------------------------------------------------- area admin

app.get('/api/admin/session', async (c) => {
  const token = getCookie(c, sessionCookieName(c));
  const authenticated = Boolean(token) && (await raffle(c).verifySession(await sha256(token)));
  return c.json({ configured: Boolean(c.env.ADMIN_PASSWORD), authenticated });
});

app.post('/api/admin/login', async (c) => {
  const expected = c.env.ADMIN_PASSWORD;
  if (!expected) {
    return fail(c, 'not_configured', "La password dell'area riservata non è ancora stata impostata (ADMIN_PASSWORD).");
  }
  if (!(await raffle(c).allowLoginAttempt(clientKey(c)))) {
    return fail(c, 'rate_limited', 'Troppi tentativi: riprova tra 15 minuti.');
  }
  const { password } = await readJson(c);
  if (!(await passwordMatches(String(password ?? ''), expected))) {
    return fail(c, 'bad_password', 'Password errata.');
  }
  const token = randomToken(32);
  await raffle(c).createSession(await sha256(token));
  setCookie(c, sessionCookieName(c), token, {
    path: '/',
    httpOnly: true,
    secure: new URL(c.req.url).protocol === 'https:',
    sameSite: 'Strict',
    maxAge: SESSION_TTL_MS / 1000,
  });
  return c.json({ ok: true });
});

app.post('/api/admin/logout', async (c) => {
  const name = sessionCookieName(c);
  const token = getCookie(c, name);
  if (token) await raffle(c).deleteSession(await sha256(token));
  deleteCookie(c, name, { path: '/', secure: new URL(c.req.url).protocol === 'https:' });
  return c.json({ ok: true });
});

// Da qui in poi serve una sessione admin valida.
app.use('/api/admin/*', async (c, next) => {
  const token = getCookie(c, sessionCookieName(c));
  if (!token || !(await raffle(c).verifySession(await sha256(token)))) {
    return fail(c, 'unauthorized', 'Sessione scaduta: accedi di nuovo.');
  }
  await next();
});

app.get('/api/admin/overview', async (c) => {
  const overview = await raffle(c).overview();
  return c.json({ ...overview, mail: mailStatus(c.env) });
});

app.post('/api/admin/orders/:code/confirm', async (c) => {
  const { notify = true, message = '' } = await readJson(c);
  const result = await raffle(c).confirmOrder(c.req.param('code'));
  if (!result.ok) return failWith(c, result.error);
  const order = result.data;
  const email = notify
    ? await deliver(c, { kind: 'confirmed', order, settings: await raffle(c).settings(), message: String(message) })
    : { status: 'skipped' };
  return c.json({ order, email });
});

app.post('/api/admin/orders/:code/cancel', async (c) => {
  const { notify = true, reason = '' } = await readJson(c);
  const result = await raffle(c).cancelOrder(c.req.param('code'), String(reason));
  if (!result.ok) return failWith(c, result.error);
  const order = result.data;
  const email = notify
    ? await deliver(c, { kind: 'cancelled', order, settings: await raffle(c).settings(), reason: order.cancelReason })
    : { status: 'skipped' };
  return c.json({ order, email });
});

// Reinvia all'acquirente l'email corrispondente allo stato attuale dell'ordine.
app.post('/api/admin/orders/:code/resend', async (c) => {
  const result = await raffle(c).order(c.req.param('code'));
  if (!result.ok) return failWith(c, result.error);
  const order = result.data;
  const kind = { pending: 'reservation', confirmed: 'confirmed', cancelled: 'cancelled' }[order.status];
  const email = await deliver(c, {
    kind,
    order,
    settings: await raffle(c).settings(),
    reason: order.cancelReason,
  });
  return c.json({ order, email });
});

app.delete('/api/admin/orders/:code', async (c) => {
  const result = await raffle(c).deleteOrder(c.req.param('code'));
  if (!result.ok) return failWith(c, result.error);
  return c.json({ deleted: result.data.code });
});

app.put('/api/admin/settings', async (c) => {
  const result = await raffle(c).updateSettings(await readJson(c));
  if (!result.ok) return failWith(c, result.error);
  return c.json({ settings: result.data });
});

app.post('/api/admin/test-email', async (c) => {
  const { to } = await readJson(c);
  const recipient = String(to || '').trim();
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(recipient)) {
    return fail(c, 'invalid_input', 'Inserisci un indirizzo email valido.');
  }
  if (!(await raffle(c).allowTestEmail())) return fail(c, 'rate_limited', 'Troppe email di prova: riprova più tardi.');
  const email = await deliver(c, { kind: 'test', settings: await raffle(c).settings(), to: recipient });
  return c.json({ email });
});

app.get('/api/admin/export.csv', async (c) => {
  const csv = await raffle(c).exportCsv();
  const date = new Date().toISOString().slice(0, 10);
  return c.body(csv, 200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="lotteria-ordini-${date}.csv"`,
  });
});

app.all('/api/*', (c) => fail(c, 'not_found', 'Risorsa non trovata.'));

// ---------------------------------------------------------------- home page

// Inserisce titolo e descrizione della lotteria nei meta tag, così l'anteprima
// del link su WhatsApp, Facebook & co. mostra i dati giusti.
app.get('/', async (c) => {
  const response = await c.env.ASSETS.fetch(c.req.raw);
  if (!(response.headers.get('content-type') || '').includes('text/html')) return response;
  let settings;
  try {
    settings = await raffle(c).settings();
  } catch (err) {
    console.error('Impostazioni non disponibili per la home page:', err);
    return response;
  }
  const origin = new URL(c.req.url).origin;
  const title = `${settings.title} 🐾 Scegli il tuo numero`;
  const description = [settings.tagline, settings.description].filter(Boolean).join(' – ').slice(0, 300);
  const setContent = (value) => ({
    element(el) {
      el.setAttribute('content', value);
    },
  });
  const rewritten = new HTMLRewriter()
    .on('title', {
      element(el) {
        el.setInnerContent(title);
      },
    })
    .on('meta[name="description"]', setContent(description))
    .on('meta[property="og:title"]', setContent(title))
    .on('meta[property="og:description"]', setContent(description))
    .on('meta[property="og:image"]', setContent(`${origin}/img/og.png`))
    .transform(response);
  const headers = new Headers(rewritten.headers);
  headers.delete('etag');
  headers.set('cache-control', 'no-cache');
  return new Response(rewritten.body, { status: rewritten.status, headers });
});

export default app;
