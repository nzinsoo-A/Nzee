// Test della logica dei dati (gira con node:sqlite, senza Cloudflare).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { RaffleStore, AppError, isValidIban, buildCausale, priceFor, savingsCents } from '../src/store.js';

function nodeSqlAdapter(db) {
  return {
    all: (q, ...p) => db.prepare(q).all(...p),
    get: (q, ...p) => db.prepare(q).get(...p) ?? null,
    run: (q, ...p) => {
      db.prepare(q).run(...p);
    },
    tx: (fn) => {
      db.exec('BEGIN');
      try {
        const out = fn();
        db.exec('COMMIT');
        return out;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
}

function newStore(options) {
  const store = new RaffleStore(nodeSqlAdapter(new DatabaseSync(':memory:')), options);
  store.migrate();
  return store;
}

const buyer = (numbers, extra = {}) => ({
  numbers,
  name: 'Mario Rossi',
  email: 'mario.rossi@example.com',
  phone: '+39 333 1234567',
  privacy: true,
  ...extra,
});

function expectAppError(fn, code) {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof AppError, `atteso AppError, ricevuto ${e}`);
    assert.equal(e.code, code);
    return e;
  }
  assert.fail(`atteso errore ${code}`);
}

test('stato iniziale: 100 numeri liberi dal 801 al 900', () => {
  const store = newStore();
  const state = store.publicState();
  assert.deepEqual(state.settings.numberRanges, [{ from: 801, to: 900 }]);
  assert.deepEqual(state.taken, {});
  assert.deepEqual(state.counts, { total: 100, sold: 0, reserved: 0, available: 100 });
  assert.equal(state.settings.iban, undefined, 'i dati bancari non sono nella vista pubblica');
});

test('prenotazione: riserva i numeri, calcola il totale, genera codice e token', () => {
  const store = newStore();
  const order = store.createOrder(buyer([845, 812, 812]));
  assert.equal(order.status, 'pending');
  assert.deepEqual(order.numbers, [812, 845]);
  assert.equal(order.totalCents, 2000);
  assert.match(order.code, /^[A-Z2-9]{5}$/);
  assert.ok(order.token.length >= 20);

  const state = store.publicState();
  assert.deepEqual(state.taken, { 812: 'reserved', 845: 'reserved' });
  assert.equal(state.counts.available, 98);
});

test('lo stesso numero non può essere venduto due volte', () => {
  const store = newStore();
  store.createOrder(buyer([801, 802]));
  const err = expectAppError(
    () => store.createOrder(buyer([803, 802], { email: 'altro@example.com' })),
    'numbers_taken',
  );
  assert.deepEqual(err.details.numbers, [802]);
  // l'ordine fallito non deve aver bloccato il numero 803
  assert.equal(store.publicState().taken[803], undefined);
  assert.equal(store.listOrders().length, 1);
});

test('validazione dei dati di chi prenota', () => {
  const store = newStore();
  const err = expectAppError(
    () => store.createOrder({ numbers: [700, 801], name: 'x', email: 'non-una-email', privacy: false }),
    'invalid_input',
  );
  assert.ok(err.details.fields.numbers);
  assert.ok(err.details.fields.name);
  assert.ok(err.details.fields.email);
  assert.ok(err.details.fields.privacy);

  expectAppError(() => store.createOrder(buyer([])), 'invalid_input');
  expectAppError(() => store.createOrder(buyer([801.5])), 'invalid_input');
  const tooMany = Array.from({ length: 11 }, (_, i) => 801 + i);
  expectAppError(() => store.createOrder(buyer(tooMany)), 'invalid_input');
  expectAppError(() => store.createOrder(buyer([801], { phone: 'chiamami' })), 'invalid_input');
});

test('conferma: il numero risulta venduto e non si può confermare due volte', () => {
  const store = newStore();
  const order = store.createOrder(buyer([850]));
  const confirmed = store.confirmOrder(order.code.toLowerCase());
  assert.equal(confirmed.status, 'confirmed');
  assert.ok(confirmed.confirmedAt);
  assert.deepEqual(store.publicState().taken, { 850: 'sold' });
  expectAppError(() => store.confirmOrder(order.code), 'invalid_state');
});

test('annullamento: i numeri tornano in vendita e si possono riprenotare', () => {
  const store = newStore();
  const order = store.createOrder(buyer([860, 861]));
  const cancelled = store.cancelOrder(order.code, 'Bonifico non ricevuto');
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.cancelReason, 'Bonifico non ricevuto');
  assert.deepEqual(store.publicState().taken, {});
  expectAppError(() => store.cancelOrder(order.code), 'invalid_state');
  expectAppError(() => store.confirmOrder(order.code), 'invalid_state');

  const again = store.createOrder(buyer([861], { email: 'nuovo@example.com' }));
  assert.equal(again.status, 'pending');
});

test('un ordine già confermato può essere annullato (rimborso)', () => {
  const store = newStore();
  const order = store.createOrder(buyer([870]));
  store.confirmOrder(order.code);
  store.cancelOrder(order.code);
  assert.deepEqual(store.publicState().taken, {});
});

test('vista acquirente: serve il token corretto', () => {
  const store = newStore();
  store.updateSettings({ beneficiary: 'Associazione Amici a 4 Zampe', iban: 'it60 x054 2811 1010 0000 0123 456' });
  const order = store.createOrder(buyer([801, 802]));
  expectAppError(() => store.buyerOrder(order.code, 'sbagliato'), 'not_found');
  expectAppError(() => store.buyerOrder('ZZZZZ', order.token), 'not_found');
  const view = store.buyerOrder(order.code, order.token);
  assert.equal(view.payment.iban, 'IT60X0542811101000000123456');
  assert.equal(view.payment.ibanFormatted, 'IT60 X054 2811 1010 0000 0123 456');
  assert.equal(view.payment.amountCents, 2000);
  assert.equal(view.payment.causale, `Lotteria ${order.code} - N. 801 802`);
  assert.equal(view.token, undefined, 'il token non viene restituito');
});

test('statistiche per la dashboard', () => {
  const store = newStore();
  const a = store.createOrder(buyer([801, 802]));
  const b = store.createOrder(buyer([803]));
  const c = store.createOrder(buyer([804]));
  store.confirmOrder(a.code);
  store.cancelOrder(c.code);
  const stats = store.stats();
  assert.equal(stats.sold, 2);
  assert.equal(stats.reserved, 1);
  assert.equal(stats.available, 97);
  assert.equal(stats.raisedCents, 2000);
  assert.equal(stats.pendingCents, 1000);
  assert.equal(stats.ordersPending, 1);
  assert.equal(stats.ordersConfirmed, 1);
  assert.equal(stats.ordersCancelled, 1);
  assert.equal(b.status, 'pending');
});

test('impostazioni: validazione e salvataggio', () => {
  const store = newStore();
  const err = expectAppError(
    () =>
      store.updateSettings({
        title: '',
        iban: 'IT00X0000000000000000000000',
        contactEmail: 'boh',
        numberRanges: [{ from: 900, to: 800 }],
        ticketPriceCents: 0,
      }),
    'invalid_settings',
  );
  for (const field of ['title', 'iban', 'contactEmail', 'numberRanges', 'ticketPriceCents']) {
    assert.ok(err.details.fields[field], `errore atteso su ${field}`);
  }

  const saved = store.updateSettings({ ticketPriceCents: '500', salesOpen: false, bic: 'bpmoit22xxx', unknown: 1 });
  assert.equal(saved.ticketPriceCents, 500);
  assert.equal(saved.salesOpen, false);
  assert.equal(saved.bic, 'BPMOIT22XXX');
  assert.equal(saved.unknown, undefined);
  assert.equal(store.getSettings().ticketPriceCents, 500);
});

test('vendite chiuse: niente nuove prenotazioni', () => {
  const store = newStore();
  store.updateSettings({ salesOpen: false });
  expectAppError(() => store.createOrder(buyer([801])), 'sales_closed');
});

test('si possono aggiungere altri gruppi di numeri ("da" … "a")', () => {
  const store = newStore();
  const saved = store.updateSettings({
    numberRanges: [
      { from: '1001', to: '1050' },
      { from: 801, to: 900 },
    ],
  });
  assert.deepEqual(saved.numberRanges, [
    { from: 801, to: 900 },
    { from: 1001, to: 1050 },
  ]);
  const state = store.publicState();
  assert.equal(state.counts.total, 150);
  assert.equal(store.stats().available, 150);

  assert.deepEqual(store.createOrder(buyer([1001, 850])).numbers, [850, 1001]);
  assert.equal(store.publicState().taken[1001], 'reserved');
  const err = expectAppError(() => store.createOrder(buyer([950])), 'invalid_input');
  assert.match(err.details.fields.numbers, /801–900, 1001–1050/);
});

test('gruppi di numeri: errori chiari', () => {
  const store = newStore();
  const problem = (ranges) =>
    expectAppError(() => store.updateSettings({ numberRanges: ranges }), 'invalid_settings').details.fields
      .numberRanges;
  assert.match(problem([]), /almeno un gruppo/);
  assert.match(problem([{ from: 801, to: '' }]), /"da" e il numero "a"/);
  assert.match(problem([{ from: 950, to: 901 }]), /più piccolo/);
  assert.match(
    problem([
      { from: 801, to: 900 },
      { from: 890, to: 950 },
    ]),
    /801–900 e 890–950 si sovrappongono/,
  );
  assert.match(problem([{ from: 1, to: 1001 }]), /al massimo 1000 numeri/);
  // gruppi consecutivi vanno bene
  store.updateSettings({
    numberRanges: [
      { from: 801, to: 900 },
      { from: 901, to: 950 },
    ],
  });
  assert.equal(store.publicState().counts.total, 150);
});

test('non si possono togliere dalla vendita numeri già prenotati', () => {
  const store = newStore();
  store.updateSettings({
    numberRanges: [
      { from: 801, to: 900 },
      { from: 1001, to: 1010 },
    ],
  });
  store.createOrder(buyer([1005, 895]));
  const err = expectAppError(
    () => store.updateSettings({ numberRanges: [{ from: 801, to: 900 }] }),
    'invalid_settings',
  );
  assert.match(err.details.fields.numberRanges, /1005/);
  expectAppError(
    () =>
      store.updateSettings({
        numberRanges: [
          { from: 801, to: 890 },
          { from: 1001, to: 1010 },
        ],
      }),
    'invalid_settings',
  );
  // un gruppo senza numeri presi si può togliere
  store.updateSettings({
    numberRanges: [
      { from: 801, to: 900 },
      { from: 1001, to: 1010 },
      { from: 2001, to: 2005 },
    ],
  });
  store.updateSettings({
    numberRanges: [
      { from: 801, to: 900 },
      { from: 1001, to: 1010 },
    ],
  });
  assert.equal(store.publicState().counts.total, 110);
});

test('il prezzo di un ordine resta quello del momento della prenotazione', () => {
  const store = newStore();
  const order = store.createOrder(buyer([801]));
  store.updateSettings({ ticketPriceCents: 2500 });
  assert.equal(store.getOrder(order.code).totalCents, 1000);
  assert.equal(store.createOrder(buyer([802])).totalCents, 2500);
});

test('sessioni admin con scadenza', () => {
  let now = 1_000_000;
  const store = newStore({ now: () => now });
  store.createSession('hash-1', 60_000);
  assert.equal(store.verifySession('hash-1'), true);
  assert.equal(store.verifySession('hash-2'), false);
  now += 61_000;
  assert.equal(store.verifySession('hash-1'), false);
  store.createSession('hash-3', 60_000);
  store.deleteSession('hash-3');
  assert.equal(store.verifySession('hash-3'), false);
});

test('registro email per ordine', () => {
  const store = newStore();
  const order = store.createOrder(buyer([801]));
  store.logEmail({ orderId: order.id, kind: 'reservation', recipient: order.email, status: 'sent' });
  store.logEmail({ orderId: order.id, kind: 'confirmed', recipient: order.email, status: 'failed', error: 'timeout' });
  const [listed] = store.listOrders();
  assert.deepEqual(
    listed.emails.map((e) => [e.kind, e.status, e.error]),
    [
      ['reservation', 'sent', ''],
      ['confirmed', 'failed', 'timeout'],
    ],
  );
});

test('esportazione CSV per Excel', () => {
  const store = newStore();
  const order = store.createOrder(buyer([801, 802], { name: '=HYPERLINK("x")', note: 'Ciao; "grazie"' }));
  store.confirmOrder(order.code);
  const csv = store.exportCsv();
  assert.ok(csv.startsWith('﻿Codice;Stato;Numeri'));
  assert.ok(csv.includes(`${order.code};Confermato;801 802;2;20,00;`));
  assert.ok(csv.includes(`"'=HYPERLINK(""x"")"`), 'le formule vengono neutralizzate');
  assert.ok(csv.includes('"Ciao; ""grazie"""'));
});

test('IBAN e causale', () => {
  assert.equal(isValidIban('IT60X0542811101000000123456'), true);
  assert.equal(isValidIban('IT60X0542811101000000123457'), false);
  assert.equal(isValidIban('GB82WEST12345698765432'), true);
  const many = Array.from({ length: 20 }, (_, i) => 801 + i);
  const causale = buildCausale(
    { code: 'ABCDE', numbers: many },
    { causalePrefix: 'Lotteria di beneficenza Amici Zampette' },
  );
  assert.ok(causale.length <= 140);
  assert.equal(buildCausale({ code: 'ABCDE', numbers: [801] }, { causalePrefix: '' }), 'Lotteria ABCDE - N. 801');
});

test('eliminazione di un ordine annullato', () => {
  const store = newStore();
  const order = store.createOrder(buyer([801]));
  store.logEmail({ orderId: order.id, kind: 'reservation', recipient: order.email, status: 'sent' });
  expectAppError(() => store.deleteOrder(order.code), 'invalid_state');
  store.cancelOrder(order.code);
  store.deleteOrder(order.code);
  assert.equal(store.listOrders().length, 0);
  expectAppError(() => store.getOrder(order.code), 'not_found');
});

test('offerta pacchetto: 3 biglietti a prezzo scontato', () => {
  const store = newStore();
  assert.equal(store.createOrder(buyer([801, 802, 803])).totalCents, 3000, 'senza offerta si paga il prezzo pieno');

  store.updateSettings({ bundleEnabled: true, bundleSize: '3', bundlePriceCents: 2500 });
  const pub = store.publicState().settings;
  assert.equal(pub.bundleEnabled, true);
  assert.equal(pub.bundleSize, 3);
  assert.equal(pub.bundlePriceCents, 2500);

  const totals = [1, 2, 3, 4, 6, 7].map((count, i) => {
    const numbers = Array.from({ length: count }, (_, k) => 810 + i * 10 + k);
    return store.createOrder(buyer(numbers)).totalCents;
  });
  assert.deepEqual(totals, [1000, 2000, 2500, 3500, 5000, 6000]);

  const order = store.listOrders()[0];
  assert.equal(savingsCents(order), 1000, '7 biglietti: due pacchetti, si risparmiano 10 €');
  assert.equal(priceFor(5, store.getSettings()), 4500);
});

test("offerta pacchetto: deve essere davvero un'offerta", () => {
  const store = newStore();
  const field = (patch) => expectAppError(() => store.updateSettings(patch), 'invalid_settings').details.fields;
  assert.match(field({ bundleEnabled: true, bundleSize: 3, bundlePriceCents: 3000 }).bundlePriceCents, /meno di 30,00/);
  assert.ok(field({ bundleEnabled: true, bundleSize: 1, bundlePriceCents: 500 }).bundleSize);
  assert.match(
    field({ bundleEnabled: true, bundleSize: 5, bundlePriceCents: 4000, maxPerOrder: 4 }).bundleSize,
    /al massimo 4 numeri/,
  );
  // spenta, non viene controllata
  store.updateSettings({ bundleEnabled: false, bundlePriceCents: 9999 });
  assert.equal(store.createOrder(buyer([801, 802, 803])).totalCents, 3000);
});
