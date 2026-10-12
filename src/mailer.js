// Invio delle email. Si sceglie il servizio in base ai "Secrets" configurati:
//   BREVO_API_KEY  -> Brevo (API HTTP)
//   RESEND_API_KEY -> Resend (API HTTP)
//   SMTP_HOST + SMTP_USER + SMTP_PASS -> SMTP (es. Gmail con password per le app)
// MAIL_FROM indica il mittente, es. "Lotteria Zampette <lotteria@gmail.com>".

const TIMEOUT_MS = 15000;

export function mailProvider(env) {
  if (env.BREVO_API_KEY) return 'brevo';
  if (env.RESEND_API_KEY) return 'resend';
  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) return 'smtp';
  return null;
}

// Stato della configurazione, mostrato nella dashboard admin.
export function mailStatus(env) {
  const provider = mailProvider(env);
  if (!provider) {
    return { provider: null, ready: false, problem: 'Invio email non configurato: le email non verranno inviate.' };
  }
  const from = parseAddress(env.MAIL_FROM || (provider === 'smtp' ? env.SMTP_USER : ''));
  if (!from) {
    return { provider, ready: false, problem: 'Manca MAIL_FROM (il mittente delle email).' };
  }
  return { provider, ready: true, from: from.email };
}

/**
 * Invia un'email. Non lancia mai eccezioni: restituisce
 * { status: 'sent' } | { status: 'failed', error } | { status: 'skipped', error }.
 */
export async function sendMail(env, { to, subject, html, text, replyTo, fromName }) {
  const status = mailStatus(env);
  if (!status.ready) return { status: 'skipped', error: status.problem };
  const parsed = parseAddress(env.MAIL_FROM || env.SMTP_USER);
  const from = { email: parsed.email, name: parsed.name || fromName || '' };
  const message = { from, to, subject, html, text, replyTo: replyTo && replyTo !== from.email ? replyTo : '' };
  try {
    if (status.provider === 'brevo') await sendWithBrevo(env, message);
    else if (status.provider === 'resend') await sendWithResend(env, message);
    else await sendWithSmtp(env, message);
    return { status: 'sent' };
  } catch (err) {
    console.error(`Invio email a ${to} non riuscito (${status.provider}):`, err);
    return { status: 'failed', error: describeError(err) };
  }
}

async function sendWithBrevo(env, { from, to, subject, html, text, replyTo }) {
  const res = await fetch(env.BREVO_API_URL || 'https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: from.name ? { name: from.name, email: from.email } : { email: from.email },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
      ...(replyTo ? { replyTo: { email: replyTo } } : {}),
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Brevo ha risposto ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

async function sendWithResend(env, { from, to, subject, html, text, replyTo }) {
  const res = await fetch(env.RESEND_API_URL || 'https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: from.name ? `${from.name.replace(/[<>"]/g, '')} <${from.email}>` : from.email,
      to: [to],
      subject,
      html,
      text,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Resend ha risposto ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

async function sendWithSmtp(env, { from, to, subject, html, text, replyTo }) {
  // Import dinamico: 'worker-mailer' usa le socket TCP di Cloudflare.
  const { WorkerMailer, LogLevel } = await import('worker-mailer');
  const port = Number(env.SMTP_PORT || 465);
  const secure = env.SMTP_SECURE ? env.SMTP_SECURE === 'true' : port === 465;
  const send = WorkerMailer.send(
    {
      host: env.SMTP_HOST,
      port,
      secure,
      startTls: !secure,
      credentials: { username: env.SMTP_USER, password: env.SMTP_PASS },
      authType: ['plain', 'login'],
      socketTimeoutMs: TIMEOUT_MS,
      responseTimeoutMs: TIMEOUT_MS,
      logLevel: LogLevel.WARN,
    },
    {
      from,
      to: { email: to },
      ...(replyTo ? { reply: { email: replyTo } } : {}),
      subject,
      text,
      html,
      // Intestazioni codificate secondo RFC 2047, così accenti ed emoji arrivano corretti.
      headers: {
        From: formatAddressHeader(from),
        Subject: encodeHeaderWords(subject),
      },
    },
  );
  await withTimeout(send, TIMEOUT_MS * 2, 'Timeout durante la connessione al server SMTP');
}

// ------------------------------------------------------------------ utilità

// "Nome <email@x.it>" oppure "email@x.it"
export function parseAddress(value) {
  const text = String(value || '').trim();
  const match = /^(.*?)\s*<([^<>\s]+@[^<>\s]+)>$/.exec(text);
  if (match) return { name: match[1].replace(/^"|"$/g, '').trim(), email: match[2] };
  if (/^[^\s@<>]+@[^\s@<>]+$/.test(text)) return { name: '', email: text };
  return null;
}

export function encodeHeaderWords(value) {
  const text = String(value).replace(/[\r\n]+/g, ' ');
  if (/^[\x20-\x7e]*$/.test(text)) return text;
  const encoder = new TextEncoder();
  const words = [];
  let chunk = '';
  for (const ch of text) {
    if (encoder.encode(chunk + ch).length > 45) {
      words.push(chunk);
      chunk = ch;
    } else {
      chunk += ch;
    }
  }
  if (chunk) words.push(chunk);
  return words.map((word) => `=?UTF-8?B?${toBase64(encoder.encode(word))}?=`).join('\r\n ');
}

function formatAddressHeader({ name, email }) {
  if (!name) return email;
  if (/^[\x20-\x7e]*$/.test(name)) return `"${name.replace(/["\\]/g, '')}" <${email}>`;
  return `${encodeHeaderWords(name)} <${email}>`;
}

function toBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function withTimeout(promise, ms, message) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

function describeError(err) {
  const message = String(err?.message || err || 'Errore sconosciuto');
  if (/535|Username and Password not accepted|authentication/i.test(message)) {
    return `Credenziali SMTP rifiutate: controlla utente e password per le app. (${message.slice(0, 200)})`;
  }
  return message.slice(0, 300);
}
