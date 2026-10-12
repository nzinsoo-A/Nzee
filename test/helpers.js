// Strumenti per i test: avvia il sito in locale (wrangler dev) e un finto server email.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SMTPServer } from 'smtp-server';
import { simpleParser } from 'mailparser';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const WRANGLER = join(ROOT, 'node_modules', '.bin', 'wrangler');

export async function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

/** Avvia `wrangler dev` con un database vuoto e le variabili indicate. */
export async function startSite(vars = {}) {
  const port = await freePort();
  const stateDir = mkdtempSync(join(tmpdir(), 'lotteria-test-'));
  const args = [
    'dev',
    '--port',
    String(port),
    '--ip',
    '127.0.0.1',
    '--persist-to',
    stateDir,
    '--show-interactive-dev-session=false',
  ];
  for (const [key, value] of Object.entries(vars)) args.push('--var', `${key}:${value}`);
  const child = spawn(WRANGLER, args, {
    cwd: ROOT,
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false', NO_COLOR: '1', CI: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (d) => (output += d));
  child.stderr.on('data', (d) => (output += d));

  const url = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 90_000;
  for (;;) {
    if (child.exitCode !== null) throw new Error(`wrangler dev si è fermato:\n${output}`);
    try {
      const res = await fetch(`${url}/api/public`);
      if (res.ok) break;
    } catch {
      // non ancora pronto
    }
    if (Date.now() > deadline) {
      child.kill('SIGTERM');
      throw new Error(`wrangler dev non risponde:\n${output}`);
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  return {
    url,
    logs: () => output,
    async stop() {
      child.kill('SIGTERM');
      await new Promise((resolve) => {
        if (child.exitCode !== null) return resolve();
        const timer = setTimeout(() => {
          child.kill('SIGKILL');
          resolve();
        }, 5000);
        child.once('exit', () => {
          clearTimeout(timer);
          resolve();
        });
      });
      rmSync(stateDir, { recursive: true, force: true });
    },
  };
}

/** Server SMTP finto: accetta le email (con autenticazione) e le conserva in memoria. */
export async function startMailbox({ username = 'lotteria@example.com', password = 'password-app' } = {}) {
  const port = await freePort();
  const messages = [];
  const waiters = [];
  const server = new SMTPServer({
    authOptional: false,
    allowInsecureAuth: true,
    disabledCommands: ['STARTTLS'],
    logger: false,
    onAuth(auth, _session, callback) {
      if (auth.username === username && auth.password === password) callback(null, { user: username });
      else callback(new Error('535 Username and Password not accepted'));
    },
    onData(stream, session, callback) {
      simpleParser(stream)
        .then((mail) => {
          mail.envelopeTo = session.envelope.rcptTo.map((r) => r.address);
          messages.push(mail);
          for (const waiter of [...waiters]) waiter();
          callback();
        })
        .catch(callback);
    },
  });
  // Connessioni interrotte (es. il sito viene spento mentre sta ancora inviando) non sono errori dei test.
  server.on('error', () => {});
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));

  return {
    port,
    username,
    password,
    messages,
    /** Aspetta un'email che soddisfa la condizione. */
    async waitFor(predicate, timeoutMs = 15_000) {
      const found = () => messages.find(predicate);
      if (found()) return found();
      return new Promise((resolve, reject) => {
        const check = () => {
          const mail = found();
          if (mail) {
            clearTimeout(timer);
            waiters.splice(waiters.indexOf(check), 1);
            resolve(mail);
          }
        };
        const timer = setTimeout(() => {
          waiters.splice(waiters.indexOf(check), 1);
          reject(new Error(`Email attesa non arrivata. Ricevute: ${messages.map((m) => m.subject).join(' | ')}`));
        }, timeoutMs);
        waiters.push(check);
      });
    },
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

/** Piccolo client HTTP che conserva il cookie di sessione (come un browser). */
export function client(baseUrl) {
  let cookie = '';
  return async function request(path, { method = 'GET', body, headers = {} } = {}) {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      redirect: 'manual',
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(cookie ? { cookie } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    const type = res.headers.get('content-type') || '';
    const data = type.includes('json') ? await res.json() : await res.text();
    return { status: res.status, headers: res.headers, data };
  };
}
