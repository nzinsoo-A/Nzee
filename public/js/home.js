// Pagina principale: griglia dei numeri, selezione e prenotazione.
import {
  $,
  $$,
  api,
  applyBranding,
  daysUntil,
  drawDateLabel,
  euro,
  groupLabel,
  h,
  icon,
  inRanges,
  loadMyOrders,
  numberGroups,
  numberTiles,
  offerLabel,
  pageUrl,
  plural,
  priceFor,
  rememberOrder,
  setLoading,
  setText,
  setupHeader,
  startPolling,
  toast,
} from './common.js';

const REFRESH_MS = 30000;

const state = {
  settings: null,
  taken: {},
  counts: null,
  selected: new Set(),
  rangeKey: '',
};

const grid = $('#grid');
const bar = $('#selection-bar');
const dialog = $('#checkout');
const form = $('#checkout-form');

setupHeader();
renderSkeleton();
renderMyOrders();
bindEvents();
refresh(true);
startPolling(refresh, REFRESH_MS, { isPaused: () => dialog.open });

// ------------------------------------------------------------------ dati

async function refresh(first = false) {
  try {
    const data = await api('/api/public');
    $('#load-error').hidden = true;
    applyState(data);
    return true;
  } catch {
    if (first || !state.settings) $('#load-error').hidden = false;
    return false;
  }
}

function applyState(data) {
  state.settings = data.settings;
  state.taken = data.taken;
  state.counts = data.counts;

  const ranges = state.settings.numberRanges;
  const lost = [...state.selected].filter((n) => state.taken[n] || !inRanges(n, ranges));
  if (lost.length) {
    lost.forEach((n) => state.selected.delete(n));
    toast(
      lost.length === 1
        ? `Il numero ${lost[0]} è appena stato preso da qualcun altro.`
        : `I numeri ${lost.join(', ')} sono appena stati presi da qualcun altro.`,
      'warning',
    );
  }

  renderInfo();
  const rangeKey = JSON.stringify(ranges);
  if (rangeKey !== state.rangeKey) {
    state.rangeKey = rangeKey;
    buildGrid();
  }
  updateGrid();
  updateSelection();
}

// ------------------------------------------------------------------ testi e informazioni

function renderInfo() {
  const s = state.settings;
  const c = state.counts;
  applyBranding(s);
  document.title = `${s.title} 🐾 Scegli il tuo numero`;
  setText('[data-bind="tagline"]', s.tagline);
  setText('[data-bind="description"]', s.description);
  setText('[data-bind="price"]', euro(s.ticketPriceCents));
  setText('[data-bind="price-sub"]', s.bundleEnabled ? `a biglietto · ${offerLabel(s)}` : 'a biglietto');
  $('#offer').hidden = !s.bundleEnabled || !s.salesOpen;
  if (s.bundleEnabled) {
    $('[data-bind="offer-text"]').replaceChildren(
      h('strong', {}, `Offerta: ${offerLabel(s)}`),
      ` invece di ${euro(s.bundleSize * s.ticketPriceCents)}. Lo sconto si applica da solo quando scegli ${s.bundleSize} numeri (o un multiplo).`,
    );
  }
  const groups = numberGroups(s.numberRanges);
  setText(
    '[data-bind="range"]',
    groups.length <= 2 ? groups.map(groupLabel).join(' · ') : `${groups[0].from} – ${groups[groups.length - 1].to}`,
  );
  setText('[data-bind="range-count"]', `${plural(c.total, 'numero', 'numeri')} in palio`);
  $('[data-bind="tagline"]').hidden = !s.tagline;

  // Estrazione
  const hasDraw = Boolean(s.drawDate);
  for (const el of $$('[data-if="draw"]')) el.hidden = !hasDraw;
  if (hasDraw) {
    setText('[data-bind="draw-short"]', drawDateLabel(s.drawDate, { weekday: false, time: false }));
    const days = daysUntil(s.drawDate);
    let countdown = 'giorno dell’estrazione';
    if (days > 1) countdown = `estrazione tra ${days} giorni`;
    else if (days === 1) countdown = 'estrazione domani!';
    else if (days === 0) countdown = 'estrazione oggi!';
    else countdown = 'estrazione avvenuta';
    if (s.drawPlace && days >= 0) countdown += ` · ${s.drawPlace}`;
    setText('[data-bind="draw-countdown"]', countdown);
  }

  // Premi
  const prizes = s.prizes
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  for (const el of $$('[data-if="prizes"]')) el.hidden = prizes.length === 0;
  $('#prizes').replaceChildren(
    ...prizes.map((text, i) =>
      h(
        'div',
        { class: 'prize' },
        h('div', { class: 'prize-rank', 'aria-hidden': 'true' }, icon('paw', ''), h('span', {}, `${i + 1}°`)),
        h('div', { class: 'prize-text' }, text),
      ),
    ),
  );

  // Avanzamento vendite
  const taken = c.sold + c.reserved;
  setText(
    '[data-bind="progress-text"]',
    taken === 0
      ? 'Sii il primo a scegliere un numero!'
      : `${plural(taken, 'numero già scelto', 'numeri già scelti')} su ${c.total}`,
  );
  setText('[data-bind="progress-available"]', `${plural(c.available, 'libero', 'liberi')}`);
  $('[data-bar="sold"]').style.width = `${(c.sold / c.total) * 100}%`;
  $('[data-bar="reserved"]').style.width = `${(c.reserved / c.total) * 100}%`;

  setText(
    '[data-bind="grid-summary"]',
    `${plural(c.available, 'numero libero', 'numeri liberi')} · ${plural(c.reserved, 'prenotato', 'prenotati')} · ${plural(c.sold, 'venduto', 'venduti')}`,
  );
  setText('[data-bind="max-per-order"]', `Massimo ${s.maxPerOrder} numeri per prenotazione`);

  $('#sales-closed').hidden = s.salesOpen;
  $('#random-pick').hidden = !s.salesOpen || c.available === 0;
}

// ------------------------------------------------------------------ griglia

function renderSkeleton() {
  grid.replaceChildren(
    ...Array.from({ length: 100 }, () =>
      h('button', { type: 'button', class: 'num is-skeleton', disabled: true, 'aria-hidden': 'true' }),
    ),
  );
}

function buildGrid() {
  grid.replaceChildren(
    ...numberTiles(state.settings.numberRanges, (n) =>
      h('button', { type: 'button', class: 'num', dataset: { n: String(n) } }, h('span', {}, String(n))),
    ),
  );
}

function updateGrid() {
  const open = state.settings.salesOpen;
  for (const tile of grid.querySelectorAll('.num')) {
    const n = Number(tile.dataset.n);
    const status = state.taken[n];
    const selected = state.selected.has(n);
    tile.classList.toggle('is-reserved', status === 'reserved');
    tile.classList.toggle('is-sold', status === 'sold');
    tile.disabled = Boolean(status) || !open;
    tile.setAttribute('aria-pressed', String(selected));
    const label =
      status === 'sold'
        ? `${n}, venduto`
        : status === 'reserved'
          ? `${n}, prenotato`
          : selected
            ? `${n}, scelto`
            : `${n}, libero`;
    tile.setAttribute('aria-label', label);
  }
  const free = Object.keys(state.taken).length < state.counts.total;
  const ticketNumber = $('[data-bind="ticket-number"]');
  if (ticketNumber.dataset.rolled !== 'true' && free) {
    ticketNumber.dataset.rolled = 'true';
    ticketNumber.textContent = String(randomFreeNumber() ?? state.settings.numberRanges[0].from);
  }
}

function randomFreeNumber() {
  const free = [];
  for (const r of state.settings.numberRanges) {
    for (let n = r.from; n <= r.to; n++) if (!state.taken[n] && !state.selected.has(n)) free.push(n);
  }
  return free.length ? free[Math.floor(Math.random() * free.length)] : null;
}

function toggleNumber(n, tile) {
  if (state.selected.has(n)) {
    state.selected.delete(n);
  } else {
    if (state.selected.size >= state.settings.maxPerOrder) {
      toast(`Puoi scegliere al massimo ${state.settings.maxPerOrder} numeri per prenotazione.`, 'warning');
      return;
    }
    state.selected.add(n);
  }
  tile.classList.remove('is-pop');
  void tile.offsetWidth;
  tile.classList.add('is-pop');
  updateGrid();
  updateSelection();
}

// ------------------------------------------------------------------ barra di selezione

function selectedNumbers() {
  return [...state.selected].sort((a, b) => a - b);
}

function updateSelection() {
  const numbers = selectedNumbers();
  const count = numbers.length;
  const visible = count > 0;
  bar.classList.toggle('is-visible', visible);
  bar.setAttribute('aria-hidden', String(!visible));
  bar.inert = !visible;
  if (!visible) return;
  const s = state.settings;
  const total = priceFor(count, s);
  const saved = count * s.ticketPriceCents - total;
  $('#selection-count').replaceChildren(
    `${plural(count, 'numero scelto', 'numeri scelti')} · `,
    h('strong', {}, euro(total)),
    saved > 0 ? ` (risparmi ${euro(saved)})` : '',
  );
  $('#selection-list').textContent = numbers.join(' · ');

  // Suggerimento: manca un numero per completare l'offerta.
  const hint = $('#selection-hint');
  const missing = s.bundleEnabled ? s.bundleSize - (count % s.bundleSize) : 0;
  const showHint = s.bundleEnabled && missing > 0 && missing <= 2 && count + missing <= s.maxPerOrder;
  hint.hidden = !showHint;
  if (showHint) {
    hint.textContent = `Scegline ${missing === 1 ? 'ancora 1' : `altri ${missing}`}: con l'offerta ${offerLabel(s)}!`;
  }
}

// ------------------------------------------------------------------ prenotazione

function openCheckout() {
  if (!state.selected.size) return;
  clearErrors();
  renderCheckout();
  dialog.showModal();
  if (!$('#f-name').value) $('#f-name').focus();
}

function renderCheckout() {
  const numbers = selectedNumbers();
  if (!numbers.length) {
    dialog.close();
    return;
  }
  $('#checkout-chips').replaceChildren(
    ...numbers.map((n) =>
      h(
        'span',
        { class: 'chip' },
        icon('paw'),
        String(n),
        h(
          'button',
          {
            type: 'button',
            class: 'chip-remove',
            'aria-label': `Togli il numero ${n}`,
            onclick: () => {
              state.selected.delete(n);
              updateGrid();
              updateSelection();
              renderCheckout();
            },
          },
          icon('x'),
        ),
      ),
    ),
  );
  const s = state.settings;
  const full = numbers.length * s.ticketPriceCents;
  const total = priceFor(numbers.length, s);
  $('#checkout-count').textContent =
    `${plural(numbers.length, 'biglietto', 'biglietti')} × ${euro(s.ticketPriceCents)}`;
  $('#checkout-total').textContent = euro(total);
  $('#checkout-full').textContent = euro(full);
  $('#checkout-full').hidden = total === full;
  $('#checkout-offer').textContent = `Offerta ${offerLabel(s)}: risparmi ${euro(full - total)}`;
  $('#checkout-offer').hidden = total === full;
}

function clearErrors() {
  $('#checkout-error').hidden = true;
  for (const field of $$('.field', form)) {
    field.classList.remove('has-error');
    $('.field-error', field)?.remove();
  }
}

function showFieldError(name, message) {
  const field = $(`[data-field="${name}"]`, form);
  if (!field) return false;
  field.classList.add('has-error');
  field.append(h('span', { class: 'field-error', role: 'alert' }, message));
  return true;
}

function showFormError(message) {
  const box = $('#checkout-error');
  $('p', box).textContent = message;
  box.hidden = false;
  box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function validateLocally(data) {
  const errors = {};
  if (data.name.length < 3) errors.name = 'Inserisci nome e cognome.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email)) errors.email = 'Inserisci un indirizzo email valido.';
  if (data.phone && !/^[+0-9 ().\-/]{5,30}$/.test(data.phone))
    errors.phone = 'Il numero di telefono non sembra valido.';
  if (!data.privacy) errors.privacy = "Per continuare devi accettare l'informativa privacy.";
  return errors;
}

async function submitCheckout(event) {
  event.preventDefault();
  clearErrors();
  const fields = form.elements;
  const data = {
    numbers: selectedNumbers(),
    name: fields.name.value.trim(),
    email: fields.email.value.trim(),
    phone: fields.phone.value.trim(),
    note: fields.note.value.trim(),
    privacy: fields.privacy.checked,
    website: fields.website.value,
  };
  const errors = validateLocally(data);
  if (Object.keys(errors).length) {
    for (const [name, message] of Object.entries(errors)) showFieldError(name, message);
    $('.has-error input, .has-error textarea', form)?.focus();
    return;
  }

  const button = $('#checkout-submit');
  setLoading(button, true, 'Sto riservando i tuoi numeri…');
  try {
    const result = await api('/api/orders', { method: 'POST', body: data });
    rememberOrder({ code: result.code, token: result.token, numbers: data.numbers });
    window.location.href = pageUrl('ordine', { c: result.code, t: result.token, nuovo: '1' });
  } catch (err) {
    setLoading(button, false);
    if (err.code === 'numbers_taken') {
      const lost = err.details?.numbers || [];
      for (const n of lost) {
        state.selected.delete(n);
        state.taken[n] = 'reserved';
      }
      updateGrid();
      updateSelection();
      renderCheckout();
      const removed = lost.length === 1 ? "L'abbiamo tolto" : 'Li abbiamo tolti';
      showFormError(
        state.selected.size
          ? `${err.message} ${removed} dalla tua selezione: puoi confermare i numeri rimasti o sceglierne altri.`
          : `${err.message} Scegli un altro numero dalla griglia.`,
      );
      refresh();
    } else if (err.code === 'invalid_input' && err.details?.fields) {
      let shown = false;
      for (const [name, message] of Object.entries(err.details.fields)) shown = showFieldError(name, message) || shown;
      if (err.details.fields.numbers) showFormError(err.details.fields.numbers);
      else if (!shown) showFormError(err.message);
    } else {
      showFormError(err.message);
    }
  }
}

function pickRandom() {
  if (!state.settings?.salesOpen) return;
  if (state.selected.size >= state.settings.maxPerOrder) {
    toast(`Puoi scegliere al massimo ${state.settings.maxPerOrder} numeri per prenotazione.`, 'warning');
    return;
  }
  const n = randomFreeNumber();
  if (n === null) return toast('Non ci sono più numeri liberi!', 'warning');
  const tile = grid.querySelector(`[data-n="${n}"]`);
  toggleNumber(n, tile);
  tile.scrollIntoView({ block: 'center', behavior: 'smooth' });
  tile.classList.add('is-flash');
  setTimeout(() => tile.classList.remove('is-flash'), 2400);
  toast(`La zampa ha scelto il numero ${n}!`, 'info', { duration: 3000 });
}

// ------------------------------------------------------------------ prenotazioni già fatte da questo dispositivo

function renderMyOrders() {
  const orders = loadMyOrders();
  const box = $('#my-orders');
  box.hidden = orders.length === 0;
  box.replaceChildren(
    ...orders.map((o) =>
      h(
        'a',
        { class: 'my-order', href: pageUrl('ordine', { c: o.code, t: o.token }) },
        h(
          'span',
          {},
          `La tua prenotazione ${o.code}`,
          h(
            'small',
            {},
            `${o.numbers.length === 1 ? 'Numero' : 'Numeri'} ${o.numbers.join(', ')} · dati per il bonifico`,
          ),
        ),
        icon('arrow-right'),
      ),
    ),
  );
}

// ------------------------------------------------------------------ eventi

function bindEvents() {
  grid.addEventListener('click', (event) => {
    const tile = event.target.closest('.num');
    if (!tile || tile.disabled || !tile.dataset.n) return;
    toggleNumber(Number(tile.dataset.n), tile);
  });
  $('#open-checkout').addEventListener('click', openCheckout);
  $('#random-pick').addEventListener('click', pickRandom);
  $('#only-free').addEventListener('change', (e) => grid.classList.toggle('is-filtered', e.target.checked));
  $('#retry').addEventListener('click', () => refresh(true));
  form.addEventListener('submit', submitCheckout);
  for (const el of $$('[data-close]', dialog)) el.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => refresh());
  form.addEventListener('input', (event) => {
    const field = event.target.closest('.field');
    if (field?.classList.contains('has-error')) {
      field.classList.remove('has-error');
      $('.field-error', field)?.remove();
    }
  });
}
