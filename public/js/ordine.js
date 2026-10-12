// Pagina della prenotazione: dati per il bonifico e stato dell'ordine.
import {
  $,
  api,
  applyBranding,
  copyButton,
  dateTime,
  drawDateLabel,
  euro,
  forgetOrder,
  h,
  icon,
  pageUrl,
  pawBurst,
  rememberOrder,
  setupHeader,
  startPolling,
  toast,
} from './common.js';

const params = new URLSearchParams(window.location.search);
const code = (params.get('c') || '').trim();
const token = (params.get('t') || '').trim();
const root = $('#order-root');
let current = null;
let stopPolling = null;

setupHeader();
load(true);

async function load(first = false) {
  if (!code || !token) return renderNotFound();
  try {
    const order = await api(`/api/orders/${encodeURIComponent(code)}?t=${encodeURIComponent(token)}`);
    const changed = current && current.status !== order.status;
    current = order;
    render(order);
    if (first && params.has('nuovo')) {
      params.delete('nuovo');
      history.replaceState(null, '', `${window.location.pathname}?${params}`);
      setTimeout(() => pawBurst(), 250);
    }
    if (changed && order.status === 'confirmed') {
      toast('Pagamento confermato! I numeri sono tuoi 🎉', 'success');
      pawBurst();
    }
    if (order.status === 'cancelled') forgetOrder(order.code);
    else rememberOrder({ code: order.code, token, numbers: order.numbers });
    // Mentre si aspetta la conferma, la pagina si aggiorna da sola.
    if (first && order.status === 'pending')
      stopPolling = startPolling(() => load(), 45000, { idleStopMs: 30 * 60 * 1000 });
    if (order.status !== 'pending') stopPolling?.();
  } catch (err) {
    if (first || !current) {
      if (err.status === 404) renderNotFound();
      else renderError(err);
    }
  }
}

// ------------------------------------------------------------------ rendering

function render(order) {
  const s = order.event;
  applyBranding(s);
  const firstName = order.name.split(/\s+/)[0];
  const many = order.numbers.length > 1;

  const hero = {
    pending: {
      pill: ['status-pending', 'clock', 'In attesa di pagamento'],
      title: `Grazie, ${firstName}!`,
      titleIcon: 'paw',
      sub: `${many ? 'I tuoi numeri sono riservati' : 'Il tuo numero è riservato'}. Completa il bonifico qui sotto per ${many ? 'confermarli' : 'confermarlo'}.`,
    },
    confirmed: {
      pill: ['status-confirmed', 'check', 'Pagamento confermato'],
      title: `Evviva, ${firstName}!`,
      titleIcon: 'paw-heart',
      sub: `Abbiamo ricevuto il tuo pagamento: ${many ? 'i numeri sono ufficialmente tuoi' : 'il numero è ufficialmente tuo'}. Grazie di cuore!`,
    },
    cancelled: {
      pill: ['status-cancelled', 'x', 'Prenotazione annullata'],
      title: 'Prenotazione annullata',
      sub: `Questa prenotazione è stata annullata e ${many ? 'i numeri sono tornati disponibili' : 'il numero è tornato disponibile'}.`,
    },
  }[order.status];

  document.title = `${hero.pill[2]} · ${s.title}`;

  const cards = [];
  if (order.status === 'pending') cards.push(paymentCard(order), nextStepsCard(order));
  if (order.status === 'confirmed') cards.push(confirmedCard(order));
  if (order.status === 'cancelled') cards.push(cancelledCard(order));
  cards.push(summaryCard(order));

  root.replaceChildren(
    h(
      'section',
      { class: 'order-hero' },
      h(
        'div',
        { class: 'container' },
        h('span', { class: `status-pill ${hero.pill[0]}` }, icon(hero.pill[1]), hero.pill[2]),
        h('h1', { class: 'order-title' }, hero.title, hero.titleIcon && icon(hero.titleIcon, 'icon title-paw')),
        h('p', { class: 'order-sub' }, hero.sub),
        h(
          'div',
          { class: 'big-chips', 'aria-label': many ? 'I tuoi numeri' : 'Il tuo numero' },
          order.numbers.map((n) =>
            h('span', { class: `big-chip${order.status === 'cancelled' ? ' is-muted' : ''}` }, icon('paw'), String(n)),
          ),
        ),
      ),
    ),
    h(
      'div',
      { class: 'narrow order-main' },
      cards,
      h(
        'div',
        { class: 'actions-row' },
        h('a', { class: 'btn btn-secondary', href: pageUrl('home') }, icon('arrow-left'), 'Torna alla lotteria'),
        order.status !== 'cancelled' &&
          h(
            'button',
            { type: 'button', class: 'btn btn-ghost', onclick: () => window.print() },
            icon('printer'),
            'Stampa',
          ),
      ),
    ),
  );
}

function paymentCard(order) {
  const p = order.payment;
  if (!p.configured) {
    return h(
      'section',
      { class: 'card' },
      h('h2', { class: 'card-title' }, icon('bank'), 'Pagamento'),
      h(
        'div',
        { class: 'notice is-info' },
        icon('info'),
        h(
          'p',
          {},
          `I dati per il bonifico di ${euro(p.amountCents)} non sono ancora disponibili: ti scriveremo a ${order.email} appena possibile.`,
        ),
      ),
    );
  }
  const row = (label, value, { copy = value, mono = false, amount = false } = {}) =>
    h(
      'div',
      { class: 'pay-row' },
      h('dt', {}, label),
      h('dd', { class: [mono && 'mono', amount && 'amount'].filter(Boolean).join(' ') || undefined }, value),
      copy ? copyButton(copy, label) : h('span'),
    );
  return h(
    'section',
    { class: 'card', 'aria-labelledby': 'pay-title' },
    h('h2', { class: 'card-title', id: 'pay-title' }, icon('bank'), 'Dati per il bonifico'),
    h(
      'dl',
      { class: 'pay-list' },
      row('Importo', euro(p.amountCents), { copy: (p.amountCents / 100).toFixed(2).replace('.', ','), amount: true }),
      row('Intestatario', p.beneficiary),
      row('IBAN', p.ibanFormatted, { copy: p.iban, mono: true }),
      p.bankName && row('Banca', p.bankName, { copy: '' }),
      p.bic && row('BIC / SWIFT', p.bic, { mono: true }),
      row('Causale', p.causale),
    ),
    p.notes && h('p', { class: 'notice is-info pre-line' }, icon('info'), h('span', {}, p.notes)),
    h(
      'p',
      { class: 'form-note' },
      icon('info'),
      h('span', {}, 'Scrivi la causale esattamente come indicato: ci aiuta a riconoscere subito il tuo pagamento.'),
    ),
  );
}

function nextStepsCard(order) {
  return h(
    'section',
    { class: 'card' },
    h('h2', { class: 'card-title' }, icon('paw'), 'Cosa succede ora'),
    h(
      'ol',
      { class: 'timeline' },
      step(
        'is-done',
        'check',
        'Prenotazione ricevuta',
        `Il ${dateTime(order.createdAt)}. Ti abbiamo inviato un riepilogo a ${order.email}.`,
      ),
      step(
        'is-current',
        'bank',
        'Fai il bonifico',
        `Importo ${euro(order.totalCents)}, con la causale indicata qui sopra.`,
      ),
      step(
        '',
        'mail',
        'Ricevi la conferma',
        `Appena vediamo l’accredito confermiamo ${order.numbers.length === 1 ? 'il tuo numero' : 'i tuoi numeri'} via email (di solito entro 1–3 giorni lavorativi).`,
      ),
    ),
  );
}

function confirmedCard(order) {
  const s = order.event;
  const draw = drawDateLabel(s.drawDate);
  return h(
    'section',
    { class: 'card' },
    h('h2', { class: 'card-title' }, icon('heart'), 'Sei in gara!'),
    h(
      'ol',
      { class: 'timeline' },
      step('is-done', 'check', 'Prenotazione ricevuta', dateTime(order.createdAt)),
      step('is-done', 'check', 'Pagamento confermato', dateTime(order.confirmedAt)),
      step(
        'is-current',
        'calendar',
        'Estrazione',
        draw ? `${draw}${s.drawPlace ? ` · ${s.drawPlace}` : ''}` : 'Ti faremo sapere data e luogo dell’estrazione.',
      ),
    ),
  );
}

function cancelledCard(order) {
  const contact = order.event.contactEmail;
  return h(
    'section',
    { class: 'card' },
    h('h2', { class: 'card-title' }, icon('info'), 'Cosa è successo'),
    order.cancelReason &&
      h('p', { class: 'notice is-info' }, icon('info'), h('span', {}, `Motivo: ${order.cancelReason}`)),
    h(
      'p',
      {},
      'Se hai già effettuato il bonifico o pensi si tratti di un errore, contattaci',
      contact ? [': ', h('a', { href: `mailto:${contact}` }, contact)] : ' rispondendo all’email che hai ricevuto',
      '.',
    ),
    h('a', { class: 'btn', href: `${pageUrl('home')}#numeri` }, icon('paw'), 'Scegli altri numeri'),
  );
}

function summaryCard(order) {
  return h(
    'section',
    { class: 'card' },
    h('h2', { class: 'card-title' }, icon('ticket'), 'Riepilogo'),
    h(
      'dl',
      { class: 'meta-list' },
      meta('Codice ordine', order.code),
      meta('Intestata a', order.name),
      meta('Email', order.email),
      meta(order.numbers.length === 1 ? 'Numero' : 'Numeri', order.numbers.join(', ')),
      meta('Totale', euro(order.totalCents)),
      meta('Prenotata il', dateTime(order.createdAt)),
    ),
  );
}

function step(className, iconName, title, text) {
  return h(
    'li',
    { class: className || undefined },
    h('span', { class: 'dot' }, icon(iconName)),
    h('div', {}, h('strong', {}, title), h('p', {}, text)),
  );
}

function meta(label, value) {
  return h('div', {}, h('dt', {}, label), h('dd', {}, value));
}

function renderNotFound() {
  root.replaceChildren(
    h(
      'div',
      { class: 'state-page container' },
      icon('paw', 'big-paw'),
      h('h1', { class: 'section-title' }, 'Prenotazione non trovata'),
      h(
        'p',
        { class: 'muted' },
        'Il link potrebbe essere incompleto. Usa il link che trovi nell’email di riepilogo, oppure contattaci.',
      ),
      h('a', { class: 'btn', href: pageUrl('home') }, icon('arrow-left'), 'Vai alla lotteria'),
    ),
  );
}

function renderError(err) {
  root.replaceChildren(
    h(
      'div',
      { class: 'state-page container' },
      icon('paw', 'big-paw'),
      h('h1', { class: 'section-title' }, 'Ops!'),
      h('p', { class: 'muted' }, err.message),
      h('button', { type: 'button', class: 'btn', onclick: () => load(true) }, icon('refresh'), 'Riprova'),
    ),
  );
}
