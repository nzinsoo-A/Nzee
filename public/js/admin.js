// Area riservata: accesso, ordini, numeri e impostazioni.
import {
  $,
  $$,
  api,
  dateTime,
  euro,
  h,
  icon,
  plural,
  setLoading,
  setupHeader,
  startPolling,
  timeAgo,
  toast,
} from './common.js';

const AUTO_REFRESH_MS = 30000;
const LATE_AFTER_MS = 3 * 24 * 60 * 60 * 1000;
const STATUS = {
  pending: { label: 'In attesa', icon: 'clock' },
  confirmed: { label: 'Confermato', icon: 'check' },
  cancelled: { label: 'Annullato', icon: 'x' },
};
const EMAIL_KINDS = {
  reservation: 'Riepilogo',
  confirmed: 'Conferma',
  cancelled: 'Annullamento',
  admin_new: 'Avviso a te',
};

const state = {
  data: null,
  tab: 'orders',
  filter: 'pending',
  query: '',
  settingsDirty: false,
  actionOrder: null,
  timer: null,
};

setupHeader();
bindEvents();
start();

async function start() {
  try {
    const session = await api('/api/admin/session');
    if (session.authenticated) await enterDashboard();
    else showLogin(session.configured);
  } catch (err) {
    showLogin(true);
    showLoginError(err.message);
  }
}

// ------------------------------------------------------------------ accesso

function showLogin(configured) {
  stopAutoRefresh();
  $('#dash-view').hidden = true;
  $('#header-actions').hidden = true;
  $('#login-view').hidden = false;
  $('#login-not-configured').hidden = configured;
  $('#login-form').hidden = !configured;
  if (configured) $('#password').focus();
}

function showLoginError(message) {
  const box = $('#login-error');
  $('p', box).textContent = message;
  box.hidden = !message;
}

async function login(event) {
  event.preventDefault();
  showLoginError('');
  const password = $('#password').value;
  if (!password) return showLoginError('Inserisci la password.');
  const button = $('#login-submit');
  setLoading(button, true, 'Accesso…');
  try {
    await api('/api/admin/login', { method: 'POST', body: { password } });
    $('#password').value = '';
    await enterDashboard();
  } catch (err) {
    showLoginError(err.message);
  } finally {
    setLoading(button, false);
  }
}

async function logout() {
  if (!confirmLeaveSettings()) return;
  try {
    await api('/api/admin/logout', { method: 'POST', body: {} });
  } catch {
    // in ogni caso torniamo alla schermata di accesso
  }
  state.data = null;
  state.settingsDirty = false;
  showLogin(true);
}

async function enterDashboard() {
  $('#login-view').hidden = true;
  $('#dash-view').hidden = false;
  $('#header-actions').hidden = false;
  await reload();
  startAutoRefresh();
}

function startAutoRefresh() {
  stopAutoRefresh();
  state.timer = startPolling(() => reload({ quiet: true }), AUTO_REFRESH_MS, {
    idleStopMs: 30 * 60 * 1000,
    isPaused: () => $$('dialog[open]').length > 0,
  });
}

function stopAutoRefresh() {
  state.timer?.();
  state.timer = null;
}

// ------------------------------------------------------------------ dati

async function reload({ quiet = false } = {}) {
  try {
    state.data = await api('/api/admin/overview');
    renderAll();
    return true;
  } catch (err) {
    if (err.status === 401) {
      toast('Sessione scaduta: accedi di nuovo.', 'warning');
      showLogin(true);
    } else if (!quiet) {
      toast(err.message, 'error');
    }
    return false;
  }
}

function renderAll() {
  $('#dash-title').textContent = state.data.settings.title;
  renderAlerts();
  renderStats();
  renderOrders();
  renderNumbers();
  renderMailStatus();
  if (!state.settingsDirty) fillSettings();
}

// ------------------------------------------------------------------ avvisi e statistiche

function renderAlerts() {
  const { settings, mail } = state.data;
  const alerts = [];
  if (!settings.iban || !settings.beneficiary) {
    alerts.push(
      alert(
        'is-error',
        'Mancano i dati per il bonifico (intestatario e IBAN): chi prenota non sa ancora come pagare.',
        'Inseriscili ora',
        () => openTab('settings', '#s-beneficiary'),
      ),
    );
  }
  if (!mail.ready) {
    alerts.push(
      alert(
        '',
        `${mail.problem} Chi prenota vede comunque i dati del bonifico sul sito, ma non riceverà email.`,
        'Come si configura',
        () => openTab('settings', '#mail-status'),
      ),
    );
  }
  if (!settings.salesOpen) {
    alerts.push(
      alert('is-info', 'Le vendite sono chiuse: il sito non accetta nuove prenotazioni.', 'Riapri', () =>
        openTab('settings'),
      ),
    );
  }
  $('#alerts').replaceChildren(...alerts);
}

function alert(kind, text, actionLabel, action) {
  return h(
    'div',
    { class: `notice ${kind}` },
    icon(kind === 'is-info' ? 'info' : 'alert'),
    h(
      'p',
      {},
      text,
      ' ',
      h('button', { type: 'button', class: 'btn btn-sm btn-secondary', onclick: action }, actionLabel),
    ),
  );
}

function renderStats() {
  const s = state.data.stats;
  const stat = (label, iconName, value, sub, highlight = false) =>
    h(
      'div',
      { class: `stat${highlight ? ' is-highlight' : ''}` },
      h('div', { class: 'stat-label' }, icon(iconName), label),
      h('div', { class: 'stat-value' }, value),
      h('div', { class: 'stat-sub' }, sub),
    );
  $('#stats').replaceChildren(
    stat('Venduti', 'paw', `${s.sold} / ${s.total}`, 'numeri pagati e confermati', true),
    stat('In attesa', 'clock', String(s.reserved), `${plural(s.ordersPending, 'ordine', 'ordini')} da verificare`),
    stat('Liberi', 'grid', String(s.available), `su ${s.total} numeri`),
    stat('Incassato', 'euro', euro(s.raisedCents), 'pagamenti confermati'),
    stat('Da incassare', 'bank', euro(s.pendingCents), 'bonifici attesi'),
  );
  $('#badge-pending').textContent = String(s.ordersPending);
}

// ------------------------------------------------------------------ ordini

function filteredOrders() {
  const query = state.query.trim().toLowerCase();
  return state.data.orders.filter((o) => {
    if (state.filter !== 'all' && o.status !== state.filter) return false;
    if (!query) return true;
    if (o.numbers.some((n) => String(n) === query)) return true;
    return [o.code, o.name, o.email, o.phone, o.note, o.numbers.join(' ')].join(' ').toLowerCase().includes(query);
  });
}

function renderOrders() {
  for (const pill of $$('[data-filter]'))
    pill.setAttribute('aria-pressed', String(pill.dataset.filter === state.filter));
  const orders = filteredOrders();
  const list = $('#order-list');
  if (!orders.length) {
    const emptyText = state.query
      ? 'Nessun ordine corrisponde alla ricerca.'
      : {
          pending: 'Nessun ordine in attesa di pagamento.',
          confirmed: 'Nessun ordine confermato per ora.',
          cancelled: 'Nessun ordine annullato.',
          all: 'Ancora nessuna prenotazione: condividi il link del sito!',
        }[state.filter];
    list.replaceChildren(h('div', { class: 'empty' }, icon('paw'), h('p', {}, emptyText)));
    return;
  }
  list.replaceChildren(...orders.map((o) => orderCard(o)));
}

function stateBadge(status) {
  return h('span', { class: `state-badge is-${status}` }, icon(STATUS[status].icon), STATUS[status].label);
}

function timeLabel(o) {
  if (o.status === 'confirmed') return `Confermato il ${dateTime(o.confirmedAt)}`;
  if (o.status === 'cancelled') return `Annullato il ${dateTime(o.cancelledAt)}`;
  return `Prenotato ${timeAgo(o.createdAt)} · ${dateTime(o.createdAt)}`;
}

function emailTags(o) {
  const latest = new Map();
  for (const e of o.emails) latest.set(e.kind, e);
  return h(
    'div',
    { class: 'email-log' },
    [...latest.values()].map((e) => {
      const sent = e.status === 'sent';
      const text = `${EMAIL_KINDS[e.kind] || e.kind}: ${sent ? 'inviata' : e.status === 'failed' ? 'non inviata' : 'non configurata'}`;
      return h(
        'span',
        {
          class: `email-tag ${sent ? 'is-sent' : e.status === 'failed' ? 'is-failed' : ''}`,
          title: e.error || `a ${e.recipient}, ${dateTime(e.createdAt)}`,
        },
        icon(sent ? 'check' : 'mail'),
        text,
      );
    }),
  );
}

function orderCard(o) {
  const late = o.status === 'pending' && Date.now() - o.createdAt > LATE_AFTER_MS;
  const actions = [];
  if (o.status === 'pending') {
    actions.push(
      h(
        'button',
        { type: 'button', class: 'btn btn-sm btn-success', onclick: () => askConfirm(o) },
        icon('check'),
        'Conferma pagamento',
      ),
    );
  }
  if (o.status !== 'cancelled') {
    actions.push(
      h(
        'button',
        { type: 'button', class: 'btn btn-sm btn-danger', onclick: () => askCancel(o) },
        icon('x'),
        'Annulla',
      ),
    );
  } else {
    actions.push(
      h(
        'button',
        {
          type: 'button',
          class: 'btn btn-sm btn-danger',
          onclick: (e) => deleteOrder(o, e.currentTarget),
          title: 'Cancella definitivamente l’ordine e i dati della persona',
        },
        icon('x'),
        'Elimina',
      ),
    );
  }
  actions.push(
    h(
      'button',
      {
        type: 'button',
        class: 'btn btn-sm btn-ghost',
        onclick: (e) => resendEmail(o, e.currentTarget),
        title: 'Reinvia al cliente l’email relativa allo stato attuale',
      },
      icon('mail'),
      'Reinvia email',
    ),
  );

  return h(
    'article',
    { class: `order-card is-${o.status}`, dataset: { code: o.code } },
    h(
      'div',
      { class: 'order-top' },
      h('div', { class: 'order-id' }, h('span', { class: 'order-code' }, o.code), stateBadge(o.status)),
      h('span', { class: `order-meta${late ? ' is-late' : ''}` }, late ? '⚠️ ' : '', timeLabel(o)),
    ),
    h(
      'div',
      { class: 'order-body' },
      h(
        'div',
        { class: 'person' },
        h('strong', {}, o.name),
        h('a', { href: `mailto:${o.email}` }, icon('mail'), o.email),
        o.phone && h('a', { href: `tel:${o.phone.replace(/[^+0-9]/g, '')}` }, icon('phone'), o.phone),
      ),
      h(
        'div',
        { class: 'chips' },
        o.numbers.map((n) =>
          h(
            'span',
            { class: `chip ${o.status === 'cancelled' ? 'is-muted' : o.status === 'pending' ? 'is-soft' : ''}` },
            String(n),
          ),
        ),
      ),
      h('div', { class: 'order-amount' }, euro(o.totalCents)),
    ),
    o.note && h('p', { class: 'order-note' }, `Messaggio: ${o.note}`),
    o.status === 'cancelled' &&
      o.cancelReason &&
      h('p', { class: 'order-note' }, `Motivo dell'annullamento: ${o.cancelReason}`),
    h('div', { class: 'order-foot' }, emailTags(o), h('div', { class: 'order-actions' }, actions)),
  );
}

// ------------------------------------------------------------------ azioni sugli ordini

function askConfirm(o) {
  state.actionOrder = o;
  const dialog = $('#confirm-dialog');
  $('#order-dialog').close();
  $('#confirm-text').textContent =
    `Hai ricevuto il bonifico di ${o.name} per l'ordine ${o.code}? I numeri risulteranno venduti.`;
  $('#confirm-chips').replaceChildren(...o.numbers.map((n) => h('span', { class: 'chip' }, icon('paw'), String(n))));
  $('#confirm-amount').textContent = euro(o.totalCents);
  $('#confirm-notify-label').textContent = `Invia l'email di conferma a ${o.email}`;
  $('#confirm-form').elements.notify.checked = true;
  $('#confirm-message').value = '';
  dialog.showModal();
}

function askCancel(o) {
  state.actionOrder = o;
  const dialog = $('#cancel-dialog');
  $('#order-dialog').close();
  $('#cancel-text').textContent =
    o.status === 'confirmed'
      ? `L'ordine ${o.code} di ${o.name} risulta già pagato. Annullandolo, i numeri torneranno in vendita (ricordati di gestire l'eventuale rimborso).`
      : `Annullare l'ordine ${o.code} di ${o.name}? I numeri torneranno subito disponibili sul sito.`;
  $('#cancel-chips').replaceChildren(...o.numbers.map((n) => h('span', { class: 'chip is-soft' }, String(n))));
  $('#cancel-notify-label').textContent = `Invia un'email a ${o.email} per avvisare dell'annullamento`;
  $('#cancel-form').elements.notify.checked = true;
  $('#cancel-reason').value = '';
  dialog.showModal();
}

async function submitConfirm(event) {
  event.preventDefault();
  const o = state.actionOrder;
  const form = $('#confirm-form');
  const button = $('#confirm-submit');
  setLoading(button, true, 'Conferma in corso…');
  try {
    const result = await api(`/api/admin/orders/${encodeURIComponent(o.code)}/confirm`, {
      method: 'POST',
      body: { notify: form.elements.notify.checked, message: form.elements.message.value.trim() },
    });
    $('#confirm-dialog').close();
    reportEmail(`Ordine ${o.code} confermato`, result.email, form.elements.notify.checked);
    await reload();
  } catch (err) {
    toast(err.message, 'error');
    if (err.status === 409) {
      $('#confirm-dialog').close();
      await reload();
    }
  } finally {
    setLoading(button, false);
  }
}

async function submitCancel(event) {
  event.preventDefault();
  const o = state.actionOrder;
  const form = $('#cancel-form');
  const button = $('#cancel-submit');
  setLoading(button, true, 'Annullamento…');
  try {
    const result = await api(`/api/admin/orders/${encodeURIComponent(o.code)}/cancel`, {
      method: 'POST',
      body: { notify: form.elements.notify.checked, reason: form.elements.reason.value.trim() },
    });
    $('#cancel-dialog').close();
    reportEmail(
      `Ordine ${o.code} annullato: i numeri sono di nuovo in vendita`,
      result.email,
      form.elements.notify.checked,
    );
    await reload();
  } catch (err) {
    toast(err.message, 'error');
    if (err.status === 409) {
      $('#cancel-dialog').close();
      await reload();
    }
  } finally {
    setLoading(button, false);
  }
}

async function deleteOrder(o, button) {
  const ok = window.confirm(
    `Eliminare definitivamente l'ordine ${o.code} di ${o.name}?\nI suoi dati spariranno dalla dashboard e dall'esportazione. L'operazione non si può annullare.`,
  );
  if (!ok) return;
  setLoading(button, true, 'Elimino…');
  try {
    await api(`/api/admin/orders/${encodeURIComponent(o.code)}`, { method: 'DELETE', body: {} });
    $('#order-dialog').close();
    toast(`Ordine ${o.code} eliminato`, 'success');
    await reload();
  } catch (err) {
    toast(err.message, 'error');
    if (button.isConnected) setLoading(button, false);
  }
}

async function exportCsv(event) {
  event.preventDefault();
  const button = event.currentTarget;
  setLoading(button, true, 'Preparo il file…');
  try {
    const res = await fetch('/api/admin/export.csv', { credentials: 'same-origin', cache: 'no-store' });
    if (res.status === 401) {
      toast('Sessione scaduta: accedi di nuovo.', 'warning');
      showLogin(true);
      return;
    }
    if (!res.ok) throw new Error('Esportazione non riuscita, riprova.');
    const blob = await res.blob();
    const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') || '')?.[1] || 'lotteria-ordini.csv';
    const link = h('a', { href: URL.createObjectURL(blob), download: name });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 10000);
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    setLoading(button, false);
  }
}

async function resendEmail(o, button) {
  setLoading(button, true, 'Invio…');
  try {
    const result = await api(`/api/admin/orders/${encodeURIComponent(o.code)}/resend`, { method: 'POST', body: {} });
    reportEmail(null, result.email, true);
    await reload({ quiet: true });
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    if (button.isConnected) setLoading(button, false);
  }
}

function reportEmail(prefix, email, requested) {
  const parts = prefix ? [prefix] : [];
  if (!requested) {
    toast(parts.join('') || 'Fatto', 'success');
    return;
  }
  if (email?.status === 'sent') {
    toast([...parts, 'email inviata al cliente ✉️'].join(' · '), 'success');
  } else if (email?.status === 'failed') {
    if (prefix) toast(prefix, 'success');
    toast(`L'email non è partita: ${email.error}`, 'warning', { duration: 9000 });
  } else {
    if (prefix) toast(prefix, 'success');
    toast(`Email non inviata: ${email?.error || 'invio email non configurato'}`, 'warning', { duration: 7000 });
  }
}

// ------------------------------------------------------------------ griglia dei numeri

function ordersByNumber() {
  const map = new Map();
  for (const o of state.data.orders) {
    if (o.status === 'cancelled') continue;
    for (const n of o.numbers) map.set(n, o);
  }
  return map;
}

function renderNumbers() {
  const { settings, taken } = state.data;
  const tiles = [];
  for (let n = settings.numberFrom; n <= settings.numberTo; n++) {
    const status = taken[n];
    tiles.push(
      h(
        'button',
        {
          type: 'button',
          class: `num${status === 'reserved' ? ' is-reserved' : status === 'sold' ? ' is-sold' : ''}`,
          dataset: { n: String(n) },
          'aria-label': `${n}, ${status === 'sold' ? 'venduto' : status === 'reserved' ? 'prenotato' : 'libero'}`,
        },
        h('span', {}, String(n)),
      ),
    );
  }
  $('#admin-grid').replaceChildren(...tiles);
}

function openNumber(n) {
  const order = ordersByNumber().get(n);
  if (!order) return toast(`Il numero ${n} è libero.`, 'info', { duration: 2500 });
  $('#order-dialog-title span').textContent = `Numero ${n}`;
  $('#order-dialog-body').replaceChildren(orderCard(order));
  $('#order-dialog').showModal();
}

// ------------------------------------------------------------------ impostazioni

function fillSettings() {
  const s = state.data.settings;
  const f = $('#settings-form');
  for (const key of [
    'title',
    'organization',
    'tagline',
    'description',
    'prizes',
    'drawDate',
    'drawPlace',
    'maxPerOrder',
    'numberFrom',
    'numberTo',
    'beneficiary',
    'bankName',
    'bic',
    'causalePrefix',
    'paymentNotes',
    'contactEmail',
  ]) {
    f.elements[key].value = s[key] ?? '';
  }
  f.elements.iban.value = (s.iban || '').replace(/(.{4})/g, '$1 ').trim();
  f.elements.ticketPrice.value = (s.ticketPriceCents / 100).toFixed(2);
  f.elements.salesOpen.checked = s.salesOpen;
  f.elements.notifyAdmin.checked = s.notifyAdmin;
  if (!$('#test-email-to').value) $('#test-email-to').value = s.contactEmail || '';
  clearSettingsErrors();
  updateCausalePreview();
  setDirty(false);
}

function readSettings() {
  const f = $('#settings-form').elements;
  const price = Math.round(parseFloat(String(f.ticketPrice.value).replace(',', '.')) * 100);
  return {
    title: f.title.value,
    organization: f.organization.value,
    tagline: f.tagline.value,
    description: f.description.value,
    prizes: f.prizes.value,
    drawDate: f.drawDate.value,
    drawPlace: f.drawPlace.value,
    ticketPriceCents: Number.isFinite(price) ? price : f.ticketPrice.value,
    maxPerOrder: f.maxPerOrder.value,
    numberFrom: f.numberFrom.value,
    numberTo: f.numberTo.value,
    salesOpen: f.salesOpen.checked,
    beneficiary: f.beneficiary.value,
    iban: f.iban.value,
    bankName: f.bankName.value,
    bic: f.bic.value,
    causalePrefix: f.causalePrefix.value,
    paymentNotes: f.paymentNotes.value,
    contactEmail: f.contactEmail.value,
    notifyAdmin: f.notifyAdmin.checked,
  };
}

function updateCausalePreview() {
  const prefix = $('#s-causalePrefix').value.trim() || 'Lotteria';
  $('#causale-preview').textContent = `Esempio di causale: “${prefix} K7M2Q - N. 812 845”`;
}

function setDirty(dirty) {
  state.settingsDirty = dirty;
  $('#settings-status').textContent = dirty ? 'Ci sono modifiche non salvate' : '';
}

function clearSettingsErrors() {
  for (const field of $$('#settings-form .field')) {
    field.classList.remove('has-error');
    $('.field-error', field)?.remove();
  }
}

async function saveSettings(event) {
  event.preventDefault();
  clearSettingsErrors();
  const button = $('#settings-save');
  setLoading(button, true, 'Salvataggio…');
  try {
    const result = await api('/api/admin/settings', { method: 'PUT', body: readSettings() });
    state.data.settings = result.settings;
    setDirty(false);
    toast('Impostazioni salvate', 'success');
    await reload({ quiet: true });
  } catch (err) {
    if (err.code === 'invalid_settings' && err.details?.fields) {
      let first = null;
      for (const [name, message] of Object.entries(err.details.fields)) {
        const field = $(`#settings-form [data-field="${name}"]`);
        if (!field) continue;
        field.classList.add('has-error');
        field.append(h('span', { class: 'field-error', role: 'alert' }, message));
        first ??= field;
      }
      first?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      $('input, textarea', first ?? document)?.focus({ preventScroll: true });
      toast('Controlla i campi evidenziati.', 'error');
    } else if (err.status === 401) {
      toast('Sessione scaduta: accedi di nuovo (le modifiche non sono state salvate).', 'warning');
      showLogin(true);
    } else {
      toast(err.message, 'error');
    }
  } finally {
    setLoading(button, false);
  }
}

function renderMailStatus() {
  const mail = state.data.mail;
  const box = $('#mail-status');
  const providers = { smtp: 'SMTP (es. Gmail)', brevo: 'Brevo', resend: 'Resend' };
  box.className = `mail-status ${mail.ready ? 'is-ok' : 'is-off'}`;
  box.replaceChildren(
    icon(mail.ready ? 'check' : 'alert'),
    h(
      'span',
      {},
      mail.ready
        ? `Invio email attivo tramite ${providers[mail.provider]}, mittente ${mail.from}.`
        : `${mail.problem} Si attiva aggiungendo i "Secrets" su Cloudflare: le istruzioni sono nel file README del progetto.`,
    ),
  );
}

async function sendTestEmail() {
  const to = $('#test-email-to').value.trim();
  if (!to) return toast('Scrivi un indirizzo a cui inviare la prova.', 'warning');
  const button = $('#test-email-btn');
  setLoading(button, true, 'Invio…');
  try {
    const { email } = await api('/api/admin/test-email', { method: 'POST', body: { to } });
    if (email.status === 'sent')
      toast(`Email di prova inviata a ${to}: controlla la posta (anche lo spam).`, 'success', { duration: 7000 });
    else toast(`Email non inviata: ${email.error}`, 'warning', { duration: 9000 });
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    setLoading(button, false);
  }
}

function confirmLeaveSettings() {
  return !state.settingsDirty || window.confirm('Ci sono modifiche alle impostazioni non salvate. Vuoi abbandonarle?');
}

// ------------------------------------------------------------------ schede

function openTab(tab, focusSelector) {
  state.tab = tab;
  for (const button of $$('[role="tab"]')) {
    const selected = button.dataset.tab === tab;
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
  }
  for (const panel of $$('[role="tabpanel"]')) panel.hidden = panel.id !== `panel-${tab}`;
  if (focusSelector) {
    const target = $(focusSelector);
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (target?.matches('input, textarea')) target.focus({ preventScroll: true });
  }
}

// ------------------------------------------------------------------ eventi

function bindEvents() {
  $('#login-form').addEventListener('submit', login);
  $('#export-btn').addEventListener('click', exportCsv);
  $('#logout-btn').addEventListener('click', logout);
  $('#refresh-btn').addEventListener('click', async (e) => {
    const button = e.currentTarget;
    button.disabled = true;
    button.classList.add('is-spinning');
    if (await reload()) toast('Dati aggiornati', 'success', { duration: 1800 });
    button.disabled = false;
    button.classList.remove('is-spinning');
  });

  for (const tab of $$('[role="tab"]')) tab.addEventListener('click', () => openTab(tab.dataset.tab));
  $('.tabs').addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    const tabs = $$('[role="tab"]');
    const index = tabs.findIndex((t) => t.dataset.tab === state.tab);
    const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    openTab(next.dataset.tab);
    next.focus();
  });

  for (const pill of $$('[data-filter]')) {
    pill.addEventListener('click', () => {
      state.filter = pill.dataset.filter;
      renderOrders();
    });
  }
  $('#search').addEventListener('input', (e) => {
    state.query = e.target.value;
    if (state.query && state.filter !== 'all') state.filter = 'all';
    renderOrders();
  });

  $('#admin-grid').addEventListener('click', (event) => {
    const tile = event.target.closest('.num');
    if (tile) openNumber(Number(tile.dataset.n));
  });

  $('#confirm-form').addEventListener('submit', submitConfirm);
  $('#cancel-form').addEventListener('submit', submitCancel);
  for (const pill of $$('[data-reason]')) {
    pill.addEventListener('click', () => {
      $('#cancel-reason').value = pill.dataset.reason;
    });
  }
  for (const dialog of $$('dialog')) {
    for (const el of $$('[data-close]', dialog)) el.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
  }

  const settingsForm = $('#settings-form');
  settingsForm.addEventListener('submit', saveSettings);
  settingsForm.addEventListener('input', (event) => {
    setDirty(true);
    if (event.target.id === 's-causalePrefix') updateCausalePreview();
    const field = event.target.closest('.field');
    if (field?.classList.contains('has-error')) {
      field.classList.remove('has-error');
      $('.field-error', field)?.remove();
    }
  });
  settingsForm.addEventListener('change', () => setDirty(true));
  $('#test-email-to').addEventListener('input', (event) => event.stopPropagation());
  $('#test-email-to').addEventListener('change', (event) => event.stopPropagation());
  $('#settings-reset').addEventListener('click', () => {
    if (state.data) fillSettings();
  });
  $('#test-email-btn').addEventListener('click', sendTestEmail);

  window.addEventListener('beforeunload', (event) => {
    if (state.settingsDirty) event.preventDefault();
  });
}
