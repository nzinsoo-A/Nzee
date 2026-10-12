// Prova completa nel browser (Chromium): due persone prenotano, l'admin conferma e annulla.
// Avvio: npm run test:e2e   (serve Chromium per Playwright: npx playwright install chromium)
// Gli screenshot finiscono in test-results/.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { client, startMailbox, startSite } from './helpers.js';

const PASSWORD = 'password-e2e-123';
const SHOTS = new URL('../test-results/', import.meta.url).pathname;
const DESKTOP = { viewport: { width: 1280, height: 900 }, locale: 'it-IT', timezoneId: 'Europe/Rome' };
const MOBILE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'it-IT',
  timezoneId: 'Europe/Rome',
};

let site;
let mailbox;
let browser;
const pageErrors = [];
const orders = {};

async function newPage(options) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('console', (msg) => {
    // Le risposte 4xx previste dai test (password errata, numero conteso…) non sono errori della pagina.
    if (msg.type() === 'error' && !msg.text().startsWith('Failed to load resource')) pageErrors.push(msg.text());
  });
  return page;
}

const shot = (page, name, fullPage = false) => page.screenshot({ path: `${SHOTS}${name}.png`, fullPage });

before(async () => {
  mkdirSync(SHOTS, { recursive: true });
  mailbox = await startMailbox();
  site = await startSite({
    ADMIN_PASSWORD: PASSWORD,
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: String(mailbox.port),
    SMTP_USER: mailbox.username,
    SMTP_PASS: mailbox.password,
    MAIL_FROM: 'Lotteria Zampette <lotteria@example.com>',
  });
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  await site?.stop();
  await mailbox?.close();
});

test("l'admin entra e configura i dati per il bonifico", async () => {
  const page = await newPage(DESKTOP);
  await page.goto(`${site.url}/admin`);
  await page.fill('#password', 'sbagliata');
  await page.click('#login-submit');
  await page.waitForSelector('#login-error:not([hidden])');
  assert.match(await page.textContent('#login-error'), /Password errata/);

  await page.fill('#password', PASSWORD);
  await page.click('#login-submit');
  await page.waitForSelector('#dash-view:not([hidden])');
  assert.match(await page.textContent('#alerts'), /Mancano i dati per il bonifico/);

  await page.click('[data-tab="settings"]');
  await page.fill('#s-organization', 'Amici a 4 Zampe ODV');
  await page.fill('#s-prizes', 'Cesto gastronomico\nBuono toelettatura\nKit cuccia');
  await page.fill('#s-drawDate', '2026-12-20T18:00');
  await page.fill('#s-drawPlace', 'Piazza del Municipio');
  await page.fill('#s-beneficiary', 'Amici a 4 Zampe ODV');
  await page.fill('#s-iban', 'IT60 X054 2811 1010 0000 0123 450');
  await page.fill('#s-contactEmail', 'organizzatori@example.com');
  await page.click('#settings-save');
  await page.waitForSelector('[data-field="iban"].has-error');
  assert.match(await page.textContent('[data-field="iban"] .field-error'), /IBAN non valido/);

  await page.fill('#s-iban', 'IT60 X054 2811 1010 0000 0123 456');
  await page.click('#settings-save');
  await page.waitForSelector('.toast.is-success');
  await page.waitForFunction(() => !document.querySelector('#alerts').textContent.includes('Mancano i dati'));
  await shot(page, 'admin-impostazioni', true);
  await page.context().close();
});

test('una persona sceglie due numeri e vede i dati per il bonifico', async () => {
  const page = await newPage(DESKTOP);
  await page.goto(site.url);
  await page.waitForSelector('.num[data-n="900"]');
  assert.equal(await page.locator('.num[data-n]').count(), 100);
  assert.equal(await page.textContent('h1'), 'Lotteria Zampette');
  assert.ok(await page.isVisible('#premi'), 'i premi sono mostrati');
  await shot(page, 'home-desktop');

  await page.click('.num[data-n="812"]');
  await page.click('.num[data-n="845"]');
  await page.waitForSelector('#selection-bar.is-visible');
  assert.match(await page.textContent('#selection-count'), /2 numeri scelti · 20,00/);
  await shot(page, 'selezione-desktop');

  await page.click('#open-checkout');
  await page.waitForSelector('#checkout[open]');
  await page.fill('#f-name', 'Mario Rossi');
  await page.fill('#f-email', 'mario@example.com');
  await page.click('#checkout-submit');
  await page.waitForSelector('[data-field="privacy"] .field-error');
  await page.check('#f-privacy');
  await shot(page, 'scheda-conferma-desktop');

  await Promise.all([page.waitForURL(/\/ordine\?c=/), page.click('#checkout-submit')]);
  await page.waitForSelector('.order-title');
  const url = new URL(page.url());
  orders.mario = { code: url.searchParams.get('c'), token: url.searchParams.get('t') };
  assert.ok(!url.searchParams.has('nuovo'), 'il parametro della festa viene tolto dal link');
  const text = await page.textContent('main');
  assert.match(text, /In attesa di pagamento/);
  assert.match(text, /IT60 X054 2811 1010 0000 0123 456/);
  assert.match(text, new RegExp(`Lotteria ${orders.mario.code} - N\\. 812 845`));
  assert.match(text, /20,00/);
  await page.waitForTimeout(1800);
  await shot(page, 'bonifico-desktop', true);

  const mail = await mailbox.waitFor((m) => m.envelopeTo.includes('mario@example.com'));
  assert.ok(mail.html.includes(orders.mario.code));

  await page.goto(site.url);
  await page.waitForSelector('.my-order');
  assert.match(await page.textContent('#my-orders'), new RegExp(orders.mario.code));
  await page.context().close();
});

test('da telefono: i numeri presi sono bloccati, si sceglie e si prenota', async () => {
  const page = await newPage(MOBILE);
  await page.goto(site.url);
  await page.waitForSelector('.num[data-n="812"].is-reserved');
  assert.equal(await page.isDisabled('.num[data-n="812"]'), true);
  assert.equal(await page.isDisabled('.num[data-n="845"]'), true);
  await shot(page, 'home-mobile');

  await page.locator('.num[data-n="846"]').tap();
  await page.locator('#random-pick').tap();
  await page.waitForFunction(() => document.querySelectorAll('.num[aria-pressed="true"]').length === 2);
  await page.locator('#numeri').scrollIntoViewIfNeeded();
  await shot(page, 'griglia-mobile');

  await page.locator('#open-checkout').tap();
  await page.waitForSelector('#checkout[open]');
  const random = await page.$$eval('.num[aria-pressed="true"]', (els) =>
    els.map((e) => Number(e.dataset.n)).filter((n) => n !== 846),
  );
  await page.locator(`#checkout-chips .chip-remove[aria-label="Togli il numero ${random[0]}"]`).tap();
  await page.waitForFunction(() => document.querySelectorAll('#checkout-chips .chip').length === 1);
  await page.fill('#f-name', 'Giulia Verdi');
  await page.fill('#f-email', 'giulia@example.com');
  await page.fill('#f-phone', '+39 333 1234567');
  await page.check('#f-privacy');
  await shot(page, 'scheda-conferma-mobile');
  await Promise.all([page.waitForURL(/\/ordine\?c=/), page.locator('#checkout-submit').tap()]);
  await page.waitForSelector('.order-title');
  const url = new URL(page.url());
  orders.giulia = { code: url.searchParams.get('c'), token: url.searchParams.get('t') };
  assert.match(await page.textContent('.big-chips'), /846/);
  await page.waitForTimeout(1800);
  await shot(page, 'bonifico-mobile', true);
  await page.context().close();
});

test('se qualcuno prenota lo stesso numero un attimo prima, si viene avvisati', async () => {
  const page = await newPage(DESKTOP);
  await page.goto(site.url);
  await page.waitForSelector('.num[data-n="850"]');
  await page.click('.num[data-n="850"]');
  await page.click('.num[data-n="851"]');
  await page.click('#open-checkout');
  await page.fill('#f-name', 'Paolo Gialli');
  await page.fill('#f-email', 'paolo@example.com');
  await page.check('#f-privacy');

  const other = await client(site.url)('/api/orders', {
    method: 'POST',
    body: { numbers: [850], name: 'Più Veloce', email: 'veloce@example.com', privacy: true },
  });
  assert.equal(other.status, 201);

  await page.click('#checkout-submit');
  await page.waitForSelector('#checkout-error:not([hidden])');
  assert.match(await page.textContent('#checkout-error'), /850 è appena stato prenotato/);
  assert.equal(await page.locator('#checkout-chips .chip').count(), 1, 'il numero perso viene tolto dalla selezione');
  await shot(page, 'numero-conteso');
  await Promise.all([page.waitForURL(/\/ordine\?c=/), page.click('#checkout-submit')]);
  await page.context().close();
});

test("l'admin conferma un pagamento e annulla una prenotazione", async () => {
  const page = await newPage(DESKTOP);
  await page.goto(`${site.url}/admin`);
  await page.fill('#password', PASSWORD);
  await page.click('#login-submit');
  await page.waitForSelector('#order-list .order-card');
  assert.equal(await page.textContent('#badge-pending'), '4');
  await shot(page, 'admin-ordini', true);

  // conferma Mario
  const mario = page.locator(`#order-list .order-card[data-code="${orders.mario.code}"]`);
  await mario.locator('.btn-success').click();
  await page.waitForSelector('#confirm-dialog[open]');
  await page.fill('#confirm-message', 'Grazie di cuore!');
  await shot(page, 'admin-conferma');
  await page.click('#confirm-submit');
  await page.waitForSelector('.toast.is-success');
  await page.waitForFunction(
    (code) => !document.querySelector(`#order-list .order-card[data-code="${code}"]`),
    orders.mario.code,
  );
  assert.match(await page.textContent('#stats'), /2 \/ 100/);
  const confirmMail = await mailbox.waitFor(
    (m) => m.envelopeTo.includes('mario@example.com') && /Pagamento ricevuto/.test(m.subject),
  );
  assert.ok(confirmMail.html.includes('Grazie di cuore!'));

  // annulla Giulia
  const giulia = page.locator(`#order-list .order-card[data-code="${orders.giulia.code}"]`);
  await giulia.locator('.btn-danger').click();
  await page.waitForSelector('#cancel-dialog[open]');
  await page.click('[data-reason="Non abbiamo ricevuto il bonifico."]');
  await page.click('#cancel-submit');
  await page.waitForFunction(
    (code) => !document.querySelector(`#order-list .order-card[data-code="${code}"]`),
    orders.giulia.code,
  );
  const cancelMail = await mailbox.waitFor(
    (m) => m.envelopeTo.includes('giulia@example.com') && /annullata/.test(m.subject),
  );
  assert.ok(cancelMail.html.includes('Non abbiamo ricevuto il bonifico.'));

  // griglia numeri
  await page.click('[data-tab="numbers"]');
  await page.click('#admin-grid .num[data-n="812"]');
  await page.waitForSelector('#order-dialog[open]');
  assert.match(await page.textContent('#order-dialog'), /Mario Rossi/);
  await shot(page, 'admin-numeri');
  await page.click('#order-dialog [data-close]');

  // ricerca
  await page.click('[data-tab="orders"]');
  await page.fill('#search', 'giulia');
  await page.waitForFunction(() => document.querySelectorAll('#order-list .order-card').length === 1);
  assert.match(await page.textContent('#order-list .order-card'), /Annullato/);
  await page.context().close();
});

test('chi ha pagato vede la conferma; i numeri annullati tornano liberi', async () => {
  const page = await newPage(MOBILE);
  await page.goto(`${site.url}/ordine?c=${orders.mario.code}&t=${orders.mario.token}`);
  await page.waitForSelector('.status-confirmed');
  assert.match(await page.textContent('main'), /Pagamento confermato/);
  await shot(page, 'ordine-confermato-mobile', true);

  await page.goto(`${site.url}/ordine?c=${orders.giulia.code}&t=${orders.giulia.token}`);
  await page.waitForSelector('.status-cancelled');
  assert.match(await page.textContent('main'), /Non abbiamo ricevuto il bonifico/);

  await page.goto(site.url);
  await page.waitForSelector('.num[data-n="846"]');
  assert.equal(await page.isDisabled('.num[data-n="846"]'), false, '846 è di nuovo libero');
  assert.ok(await page.locator('.num[data-n="812"].is-sold').count(), '812 risulta venduto');
  await page.locator('#numeri').scrollIntoViewIfNeeded();
  await shot(page, 'griglia-dopo-mobile');

  await page.goto(`${site.url}/ordine?c=${orders.mario.code}&t=sbagliato`);
  await page.waitForSelector('text=Prenotazione non trovata');
  await page.context().close();
});

test('nessun errore JavaScript nelle pagine', () => {
  assert.deepEqual(pageErrors, []);
});
