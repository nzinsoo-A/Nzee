// Test dell'invio email (provider HTTP simulati) e dei testi delle email.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { encodeHeaderWords, mailStatus, parseAddress, sendMail } from '../src/mailer.js';
import { buildEmail } from '../src/emails.js';
import { DEFAULT_SETTINGS } from '../src/store.js';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function captureFetch(status = 201) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ messageId: 'x' }), { status });
  };
  return calls;
}

const message = {
  to: 'mario@example.com',
  subject: '🐾 Prenotazione ricevuta – numeri 812 e 845',
  html: '<p>Ciao</p>',
  text: 'Ciao',
  replyTo: 'info@associazione.it',
  fromName: 'Associazione',
};

test('stato della configurazione email', () => {
  assert.equal(mailStatus({}).ready, false);
  assert.equal(mailStatus({ BREVO_API_KEY: 'k' }).ready, false, 'senza MAIL_FROM non è pronta');
  assert.deepEqual(mailStatus({ BREVO_API_KEY: 'k', MAIL_FROM: 'Lotteria <a@b.it>' }), {
    provider: 'brevo',
    ready: true,
    from: 'a@b.it',
  });
  assert.equal(
    mailStatus({ SMTP_HOST: 'smtp.gmail.com', SMTP_USER: 'x@gmail.com', SMTP_PASS: 'p' }).from,
    'x@gmail.com',
  );
  assert.equal(mailStatus({ RESEND_API_KEY: 'k', MAIL_FROM: 'lotteria@dominio.it' }).provider, 'resend');
});

test('senza configurazione le email vengono saltate (senza errori)', async () => {
  const result = await sendMail({}, message);
  assert.equal(result.status, 'skipped');
});

test('invio con Brevo', async () => {
  const calls = captureFetch(201);
  const result = await sendMail(
    { BREVO_API_KEY: 'chiave', MAIL_FROM: 'Lotteria Zampette <lotteria@example.com>' },
    message,
  );
  assert.equal(result.status, 'sent');
  assert.equal(calls[0].url, 'https://api.brevo.com/v3/smtp/email');
  assert.equal(calls[0].init.headers['api-key'], 'chiave');
  assert.deepEqual(calls[0].body.sender, { name: 'Lotteria Zampette', email: 'lotteria@example.com' });
  assert.deepEqual(calls[0].body.to, [{ email: 'mario@example.com' }]);
  assert.deepEqual(calls[0].body.replyTo, { email: 'info@associazione.it' });
  assert.equal(calls[0].body.subject, message.subject);
});

test('invio con Resend', async () => {
  const calls = captureFetch(200);
  const result = await sendMail({ RESEND_API_KEY: 're_x', MAIL_FROM: 'lotteria@example.com' }, message);
  assert.equal(result.status, 'sent');
  assert.equal(calls[0].url, 'https://api.resend.com/emails');
  assert.equal(calls[0].init.headers.authorization, 'Bearer re_x');
  assert.equal(calls[0].body.from, 'Associazione <lotteria@example.com>');
  assert.deepEqual(calls[0].body.to, ['mario@example.com']);
  assert.equal(calls[0].body.reply_to, 'info@associazione.it');
});

test('un errore del servizio email viene riportato, non lanciato', async () => {
  captureFetch(401);
  const result = await sendMail({ BREVO_API_KEY: 'sbagliata', MAIL_FROM: 'a@b.it' }, message);
  assert.equal(result.status, 'failed');
  assert.match(result.error, /401/);
});

test('indirizzi e intestazioni', () => {
  assert.deepEqual(parseAddress('Lotteria Zampette <lotteria@gmail.com>'), {
    name: 'Lotteria Zampette',
    email: 'lotteria@gmail.com',
  });
  assert.deepEqual(parseAddress('lotteria@gmail.com'), { name: '', email: 'lotteria@gmail.com' });
  assert.equal(parseAddress('non valido'), null);
  assert.equal(encodeHeaderWords('Solo ASCII'), 'Solo ASCII');
  const encoded = encodeHeaderWords('🐾 Prenotazione ricevuta – numeri 812, 845 e 870 per la lotteria di beneficenza');
  for (const word of encoded.split('\r\n ')) {
    assert.match(word, /^=\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=$/);
    assert.ok(word.length <= 75);
  }
  const decoded = encoded
    .split('\r\n ')
    .map((w) => Buffer.from(w.slice(10, -2), 'base64').toString('utf8'))
    .join('');
  assert.equal(decoded, '🐾 Prenotazione ricevuta – numeri 812, 845 e 870 per la lotteria di beneficenza');
});

test('testi delle email: dati del bonifico, link e protezione da HTML', () => {
  const settings = {
    ...DEFAULT_SETTINGS,
    organization: 'Amici a 4 Zampe',
    beneficiary: 'Amici a 4 Zampe ODV',
    iban: 'IT60X0542811101000000123456',
    contactEmail: 'info@associazione.it',
    drawDate: '2026-12-20T18:00',
  };
  const order = {
    id: 1,
    code: 'K7M2Q',
    token: 'tok',
    name: 'Mario <b>Rossi</b>',
    email: 'mario@example.com',
    phone: '',
    note: '',
    numbers: [812, 845],
    totalCents: 2000,
    createdAt: Date.UTC(2026, 9, 12, 10, 0),
  };
  const origin = 'https://lotteria.example';

  const reservation = buildEmail('reservation', { order, settings, origin });
  assert.equal(reservation.subject, '🐾 Prenotazione ricevuta – numeri 812 e 845');
  assert.ok(reservation.html.includes('IT60 X054 2811 1010 0000 0123 456'));
  assert.ok(reservation.html.includes('Lotteria K7M2Q - N. 812 845'));
  assert.ok(reservation.html.includes('20,00'));
  assert.ok(reservation.html.includes(`${origin}/ordine?c=K7M2Q&amp;t=tok`));
  assert.ok(!reservation.html.includes('<b>Rossi</b>'), 'il nome viene trattato come testo');
  assert.ok(reservation.text.includes('IBAN: IT60 X054 2811 1010 0000 0123 456'));
  assert.ok(!/\n\n\n/.test(reservation.text), 'niente righe vuote di troppo');

  const confirmed = buildEmail('confirmed', { order, settings, origin, message: 'Grazie!' });
  assert.match(confirmed.subject, /confermati$/);
  assert.ok(confirmed.html.includes('domenica 20 dicembre 2026, ore 18:00'));
  assert.ok(confirmed.html.includes('Grazie!'));

  const cancelled = buildEmail('cancelled', { order, settings, origin, reason: 'Bonifico non ricevuto' });
  assert.match(cancelled.subject, /^Prenotazione annullata/);
  assert.ok(cancelled.html.includes('Bonifico non ricevuto'));
  assert.ok(cancelled.html.includes('info@associazione.it'));

  const admin = buildEmail('admin_new', { order, settings, origin });
  assert.ok(admin.html.includes(`${origin}/admin`));

  const noBank = buildEmail('reservation', { order, settings: DEFAULT_SETTINGS, origin });
  assert.ok(noBank.html.includes('Ti invieremo a breve i dati'));
});
