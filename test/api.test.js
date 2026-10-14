// Test d'integrazione: avvia il sito vero (wrangler dev, runtime di Cloudflare)
// e un finto server email, poi prova tutto il percorso via HTTP.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { client, startMailbox, startSite } from './helpers.js';

const PASSWORD = 'password-di-prova-123';
let site;
let mailbox;
let api;
let admin;
let ipCounter = 0;
const nextIp = () => `203.0.113.${++ipCounter}`;

const BANK = {
  organization: 'Amici a 4 Zampe ODV',
  beneficiary: 'Amici a 4 Zampe ODV',
  iban: 'IT60X0542811101000000123456',
  bankName: 'Banca di Esempio',
  contactEmail: 'organizzatori@example.com',
  notifyAdmin: true,
};

function book(numbers, extra = {}) {
  return api('/api/orders', {
    method: 'POST',
    headers: { 'cf-connecting-ip': nextIp() },
    body: { numbers, name: 'Giulia Verdi', email: 'giulia@example.com', privacy: true, ...extra },
  });
}

before(async () => {
  mailbox = await startMailbox();
  site = await startSite({
    ADMIN_PASSWORD: PASSWORD,
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: String(mailbox.port),
    SMTP_USER: mailbox.username,
    SMTP_PASS: mailbox.password,
    MAIL_FROM: 'Lotteria Zampette <lotteria@example.com>',
  });
  api = client(site.url);
  admin = client(site.url);
  const login = await admin('/api/admin/login', { method: 'POST', body: { password: PASSWORD } });
  assert.equal(login.status, 200, JSON.stringify(login.data));
  const saved = await admin('/api/admin/settings', { method: 'PUT', body: BANK });
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
});

after(async () => {
  await site?.stop();
  await mailbox?.close();
});

test('pagine del sito', async () => {
  const home = await api('/');
  assert.equal(home.status, 200);
  assert.match(home.data, /<title>Lotteria Zampette 🐾 Scegli il tuo numero<\/title>/);
  assert.ok(home.data.includes(`content="${site.url}/img/og.png"`), "l'anteprima usa un indirizzo assoluto");
  assert.match(home.headers.get('content-security-policy') || '', /default-src 'self'/);

  for (const path of ['/admin', '/ordine', '/privacy', '/css/style.css', '/js/home.js', '/img/icons.svg']) {
    assert.equal((await api(path)).status, 200, path);
  }
  assert.equal((await api('/pagina-che-non-esiste')).status, 404);
  assert.equal((await api('/_headers')).status, 404, 'i file di configurazione non sono pubblici');
});

test('stato pubblico: 100 numeri dal 801 al 900, niente dati bancari', async () => {
  const { status, data } = await api('/api/public');
  assert.equal(status, 200);
  assert.deepEqual(data.settings.numberRanges, [{ from: 801, to: 900 }]);
  assert.equal(data.counts.total, 100);
  assert.equal(data.settings.iban, undefined);
  assert.equal(data.settings.organization, BANK.organization);
});

test('prenotazione: dati per il bonifico + email al cliente e agli organizzatori', async () => {
  const res = await book([845, 812], { name: 'Mario Rossi', email: 'mario@example.com', phone: '333 1234567' });
  assert.equal(res.status, 201, JSON.stringify(res.data));
  const { code, token } = res.data;

  const view = await api(`/api/orders/${code}?t=${token}`);
  assert.equal(view.status, 200);
  assert.equal(view.data.status, 'pending');
  assert.deepEqual(view.data.numbers, [812, 845]);
  assert.equal(view.data.payment.iban, BANK.iban);
  assert.equal(view.data.payment.amountCents, 2000);
  assert.equal(view.data.payment.causale, `Lotteria ${code} - N. 812 845`);

  assert.equal((await api(`/api/orders/${code}?t=sbagliato`)).status, 404, 'senza token giusto non si vede');

  const state = await api('/api/public');
  assert.equal(state.data.taken[812], 'reserved');
  assert.equal(state.data.taken[845], 'reserved');

  const mail = await mailbox.waitFor(
    (m) => m.envelopeTo.includes('mario@example.com') && /Prenotazione ricevuta/.test(m.subject),
  );
  assert.equal(mail.subject, '🐾 Prenotazione ricevuta – numeri 812 e 845');
  assert.equal(mail.from.value[0].address, 'lotteria@example.com');
  assert.equal(mail.from.value[0].name, 'Lotteria Zampette');
  assert.equal(mail.replyTo?.value[0].address, BANK.contactEmail);
  assert.ok(mail.html.includes('IT60 X054 2811 1010 0000 0123 456'));
  assert.ok(mail.html.includes(`Lotteria ${code} - N. 812 845`));
  assert.ok(mail.html.includes(`${site.url}/ordine?c=${code}&amp;t=${token}`));
  assert.ok(mail.text.includes('Causale: Lotteria'));

  const notice = await mailbox.waitFor((m) => m.envelopeTo.includes(BANK.contactEmail) && m.subject.includes(code));
  assert.match(notice.subject, /Nuova prenotazione/);
  assert.equal(notice.replyTo?.value[0].address, 'mario@example.com');
});

test('un numero già prenotato non può essere preso da altri', async () => {
  assert.equal((await book([830])).status, 201);
  const res = await book([831, 830], { email: 'altro@example.com' });
  assert.equal(res.status, 409);
  assert.equal(res.data.error.code, 'numbers_taken');
  assert.deepEqual(res.data.error.details.numbers, [830]);
  const state = await api('/api/public');
  assert.equal(state.data.taken[831], undefined, "l'ordine rifiutato non blocca altri numeri");
});

test('prenotazioni contemporanee sullo stesso numero: vince una sola', async () => {
  const results = await Promise.all(
    Array.from({ length: 6 }, (_, i) => book([899], { email: `corsa${i}@example.com` })),
  );
  assert.equal(results.filter((r) => r.status === 201).length, 1);
  assert.equal(results.filter((r) => r.status === 409).length, 5);
});

test('validazione dei dati', async () => {
  const res = await book([700], { name: '', email: 'sbagliata', privacy: false });
  assert.equal(res.status, 400);
  assert.deepEqual(Object.keys(res.data.error.details.fields).sort(), ['email', 'name', 'numbers', 'privacy']);
});

test('protezioni: origine esterna, formato non JSON, campo trappola per bot', async () => {
  const foreign = await api('/api/orders', {
    method: 'POST',
    headers: { origin: 'https://sito-malevolo.example' },
    body: { numbers: [850], name: 'Bot', email: 'bot@example.com', privacy: true },
  });
  assert.equal(foreign.status, 403);

  const form = await fetch(`${site.url}/api/orders`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'numbers=850',
  });
  assert.equal(form.status, 415);

  const bot = await book([850], { website: 'http://spam.example' });
  assert.equal(bot.status, 400);
  assert.equal((await api('/api/public')).data.taken[850], undefined);
});

test('area admin: serve la password giusta', async () => {
  const anon = client(site.url);
  assert.equal((await anon('/api/admin/overview')).status, 401);
  assert.deepEqual((await anon('/api/admin/session')).data, { configured: true, authenticated: false });
  const wrong = await anon('/api/admin/login', { method: 'POST', body: { password: 'nope' } });
  assert.equal(wrong.status, 401);
  assert.equal((await anon('/api/admin/overview')).status, 401);
  assert.equal((await anon('/api/admin/orders/XXXXX/confirm', { method: 'POST', body: {} })).status, 401);
  assert.equal((await anon('/api/admin/export.csv')).status, 401);

  assert.deepEqual((await admin('/api/admin/session')).data, { configured: true, authenticated: true });
  const overview = await admin('/api/admin/overview');
  assert.equal(overview.status, 200);
  assert.equal(overview.data.mail.ready, true);
  assert.equal(overview.data.mail.provider, 'smtp');
});

test('troppi tentativi di accesso vengono bloccati', async () => {
  const anon = client(site.url);
  const headers = { 'cf-connecting-ip': '198.51.100.77' };
  const statuses = [];
  for (let i = 0; i < 11; i++) {
    statuses.push(
      (await anon('/api/admin/login', { method: 'POST', headers, body: { password: `tentativo-${i}` } })).status,
    );
  }
  assert.deepEqual(statuses.slice(0, 10), Array(10).fill(401));
  assert.equal(statuses[10], 429);
  const right = await anon('/api/admin/login', { method: 'POST', headers, body: { password: PASSWORD } });
  assert.equal(right.status, 429, 'anche la password giusta aspetta la fine del blocco');
});

test('conferma del pagamento: numeri venduti ed email di conferma', async () => {
  const { data } = await book([801, 802], { name: 'Anna Bianchi', email: 'anna@example.com' });
  const res = await admin(`/api/admin/orders/${data.code}/confirm`, {
    method: 'POST',
    body: { notify: true, message: 'Grazie mille, ci vediamo in piazza!' },
  });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  assert.equal(res.data.order.status, 'confirmed');
  assert.equal(res.data.email.status, 'sent');

  const state = await api('/api/public');
  assert.equal(state.data.taken[801], 'sold');
  assert.equal(state.data.taken[802], 'sold');

  const mail = await mailbox.waitFor(
    (m) => m.envelopeTo.includes('anna@example.com') && /Pagamento ricevuto/.test(m.subject),
  );
  assert.ok(mail.html.includes('Grazie mille, ci vediamo in piazza!'));

  const again = await admin(`/api/admin/orders/${data.code}/confirm`, { method: 'POST', body: {} });
  assert.equal(again.status, 409);

  const view = await api(`/api/orders/${data.code}?t=${data.token}`);
  assert.equal(view.data.status, 'confirmed');
});

test('annullamento: i numeri tornano in vendita ed email con il motivo', async () => {
  const { data } = await book([820, 821], { name: 'Luca Neri', email: 'luca@example.com' });
  const res = await admin(`/api/admin/orders/${data.code}/cancel`, {
    method: 'POST',
    body: { notify: true, reason: 'Non abbiamo ricevuto il bonifico.' },
  });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  assert.equal(res.data.order.status, 'cancelled');
  assert.equal(res.data.email.status, 'sent');

  const state = await api('/api/public');
  assert.equal(state.data.taken[820], undefined);
  assert.equal(state.data.taken[821], undefined);

  const mail = await mailbox.waitFor((m) => m.envelopeTo.includes('luca@example.com') && /annullata/.test(m.subject));
  assert.ok(mail.html.includes('Non abbiamo ricevuto il bonifico.'));

  assert.equal((await book([820], { email: 'nuovo@example.com' })).status, 201, 'il numero si può riprenotare');
});

test('annullamento senza email al cliente', async () => {
  const { data } = await book([822], { email: 'silenzio@example.com' });
  const res = await admin(`/api/admin/orders/${data.code}/cancel`, { method: 'POST', body: { notify: false } });
  assert.equal(res.data.email.status, 'skipped');
  await new Promise((r) => setTimeout(r, 1500));
  assert.equal(
    mailbox.messages.filter((m) => m.envelopeTo.includes('silenzio@example.com') && /annullata/.test(m.subject)).length,
    0,
  );
});

test("reinvio dell'email e storico delle email nell'ordine", async () => {
  const { data } = await book([840], { email: 'reinvio@example.com' });
  await mailbox.waitFor((m) => m.envelopeTo.includes('reinvio@example.com'));
  const res = await admin(`/api/admin/orders/${data.code}/resend`, { method: 'POST', body: {} });
  assert.equal(res.data.email.status, 'sent');
  const overview = await admin('/api/admin/overview');
  const order = overview.data.orders.find((o) => o.code === data.code);
  assert.deepEqual(
    order.emails.filter((e) => e.recipient === 'reinvio@example.com').map((e) => [e.kind, e.status]),
    [
      ['reservation', 'sent'],
      ['reservation', 'sent'],
    ],
  );
});

test('impostazioni: errori chiari e salvataggio', async () => {
  const bad = await admin('/api/admin/settings', { method: 'PUT', body: { iban: 'IT00 1234', ticketPriceCents: 0 } });
  assert.equal(bad.status, 400);
  assert.ok(bad.data.error.details.fields.iban);
  assert.ok(bad.data.error.details.fields.ticketPriceCents);

  const ok = await admin('/api/admin/settings', {
    method: 'PUT',
    body: { title: 'Lotteria di Natale', ticketPriceCents: 500, drawDate: '2026-12-20T18:00' },
  });
  assert.equal(ok.status, 200);
  const state = await api('/api/public');
  assert.equal(state.data.settings.title, 'Lotteria di Natale');
  assert.equal(state.data.settings.ticketPriceCents, 500);
  const home = await api('/');
  assert.match(home.data, /<title>Lotteria di Natale 🐾/);

  await admin('/api/admin/settings', { method: 'PUT', body: { title: 'Lotteria Zampette', ticketPriceCents: 1000 } });
});

test("aggiunta di nuovi numeri dall'area riservata", async () => {
  const before = (await api('/api/public')).data;
  const res = await admin('/api/admin/settings', {
    method: 'PUT',
    body: { numberRanges: [...before.settings.numberRanges, { from: 1001, to: 1020 }] },
  });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  const after = (await api('/api/public')).data;
  assert.equal(after.counts.total, before.counts.total + 20);
  assert.equal((await book([1015], { email: 'nuovi@example.com' })).status, 201);
  assert.equal((await api('/api/public')).data.taken[1015], 'reserved');

  const overlap = await admin('/api/admin/settings', {
    method: 'PUT',
    body: { numberRanges: [...after.settings.numberRanges, { from: 1010, to: 1030 }] },
  });
  assert.equal(overlap.status, 400);
  assert.match(overlap.data.error.details.fields.numberRanges, /si sovrappongono/);

  const drop = await admin('/api/admin/settings', { method: 'PUT', body: { numberRanges: [{ from: 801, to: 900 }] } });
  assert.equal(drop.status, 400, 'il gruppo con il 1015 prenotato non si può togliere');
});

test('vendite chiuse', async () => {
  await admin('/api/admin/settings', { method: 'PUT', body: { salesOpen: false } });
  const res = await book([870]);
  assert.equal(res.status, 409);
  assert.equal(res.data.error.code, 'sales_closed');
  await admin('/api/admin/settings', { method: 'PUT', body: { salesOpen: true } });
  assert.equal((await book([870])).status, 201);
});

test('esportazione CSV', async () => {
  const res = await admin('/api/admin/export.csv');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/csv/);
  assert.match(res.headers.get('content-disposition'), /attachment; filename="lotteria-ordini-/);
  assert.ok(res.data.includes('Codice;Stato;Numeri'));
  assert.ok(res.data.includes('Mario Rossi'));
});

test('email di prova', async () => {
  const res = await admin('/api/admin/test-email', { method: 'POST', body: { to: 'prova@example.com' } });
  assert.equal(res.data.email.status, 'sent');
  const mail = await mailbox.waitFor((m) => m.envelopeTo.includes('prova@example.com'));
  assert.match(mail.subject, /Email di prova/);
});

test('troppe prenotazioni dallo stesso indirizzo vengono rallentate', async () => {
  const headers = { 'cf-connecting-ip': '198.51.100.99' };
  const statuses = [];
  for (let i = 0; i < 9; i++) {
    const res = await api('/api/orders', {
      method: 'POST',
      headers,
      body: { numbers: [880 + i], name: 'Spam Spam', email: 'spam@example.com', privacy: true },
    });
    statuses.push(res.status);
  }
  assert.deepEqual(statuses.slice(0, 8), Array(8).fill(201));
  assert.equal(statuses[8], 429);
});

test('uscita: la sessione non vale più', async () => {
  const session = client(site.url);
  await session('/api/admin/login', { method: 'POST', body: { password: PASSWORD } });
  assert.equal((await session('/api/admin/overview')).status, 200);
  assert.equal((await session('/api/admin/logout', { method: 'POST', body: {} })).status, 200);
  assert.equal((await session('/api/admin/overview')).status, 401);
});

test('eliminazione definitiva: solo per gli ordini annullati', async () => {
  const { data } = await book([860], { email: 'elimina@example.com' });
  const early = await admin(`/api/admin/orders/${data.code}`, { method: 'DELETE', body: {} });
  assert.equal(early.status, 409, 'un ordine attivo non si elimina');
  await admin(`/api/admin/orders/${data.code}/cancel`, { method: 'POST', body: { notify: false } });
  const res = await admin(`/api/admin/orders/${data.code}`, { method: 'DELETE', body: {} });
  assert.equal(res.status, 200);
  const overview = await admin('/api/admin/overview');
  assert.equal(
    overview.data.orders.find((o) => o.code === data.code),
    undefined,
  );
  assert.equal((await api(`/api/orders/${data.code}?t=${data.token}`)).status, 404);
  assert.equal((await client(site.url)(`/api/admin/orders/${data.code}`, { method: 'DELETE', body: {} })).status, 401);
});
