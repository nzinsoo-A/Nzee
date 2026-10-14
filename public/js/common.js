// Funzioni condivise tra le pagine del sito.

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const SVG_NS = 'http://www.w3.org/2000/svg';
const ICONS_URL = '/img/icons.svg';

// ------------------------------------------------------------------ API

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  if (window.DEMO_API) return window.DEMO_API(path, { method, body });
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, 'network', 'Connessione non riuscita: controlla la rete e riprova.');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = data?.error || {};
    throw new ApiError(
      res.status,
      err.code || 'error',
      err.message || 'Si è verificato un errore. Riprova.',
      err.details,
    );
  }
  return data;
}

// Link tra le pagine (nella demo statica servono i nomi completi dei file).
export function pageUrl(name, params = {}) {
  const query = new URLSearchParams(params).toString();
  const path = window.DEMO_API ? (name === 'home' ? 'index.html' : `${name}.html`) : name === 'home' ? '/' : `/${name}`;
  return query ? `${path}?${query}` : path;
}

// ------------------------------------------------------------------ formattazione

const euroFormatter = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
const dateTimeFormatter = new Intl.DateTimeFormat('it-IT', {
  timeZone: 'Europe/Rome',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export const euro = (cents) => euroFormatter.format((cents || 0) / 100);
export const dateTime = (ms) => (ms ? dateTimeFormatter.format(new Date(ms)) : '');

function parseDrawDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(value || '');
  if (!m) return null;
  return { y: +m[1], mo: +m[2], d: +m[3], h: m[4], mi: m[5] };
}

// "2026-12-20T18:00" -> "domenica 20 dicembre 2026, ore 18:00"
export function drawDateLabel(value, { weekday = true, time = true } = {}) {
  const p = parseDrawDate(value);
  if (!p) return '';
  const label = new Intl.DateTimeFormat('it-IT', {
    timeZone: 'UTC',
    ...(weekday ? { weekday: 'long' } : {}),
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(Date.UTC(p.y, p.mo - 1, p.d)));
  return time && p.h ? `${label}, ore ${p.h}:${p.mi}` : label;
}

// Giorni che mancano alla data indicata (calendario italiano).
export function daysUntil(value) {
  const p = parseDrawDate(value);
  if (!p) return null;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
  const [ty, tm, td] = today.split('-').map(Number);
  return Math.round((Date.UTC(p.y, p.mo - 1, p.d) - Date.UTC(ty, tm - 1, td)) / 86400000);
}

export function timeAgo(ms) {
  const minutes = Math.round((Date.now() - ms) / 60000);
  if (minutes < 1) return 'adesso';
  if (minutes < 60) return `${minutes} min fa`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? "un'ora fa" : `${hours} ore fa`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'ieri' : `${days} giorni fa`;
}

export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// ------------------------------------------------------------------ prezzi e offerta pacchetto

// Prezzo di N biglietti con l'eventuale offerta (stessa regola del server).
export function priceFor(count, s) {
  if (!s.bundleEnabled) return count * s.ticketPriceCents;
  const bundles = Math.floor(count / s.bundleSize);
  return bundles * s.bundlePriceCents + (count - bundles * s.bundleSize) * s.ticketPriceCents;
}

// "3 biglietti a 25,00 €"
export const offerLabel = (s) => `${s.bundleSize} biglietti a ${euro(s.bundlePriceCents)}`;

// Risparmio di un ordine rispetto al prezzo pieno (0 se non c'è offerta).
export const orderSavings = (o) => Math.max(0, o.unitPriceCents * o.numbers.length - o.totalCents) || 0;

// ------------------------------------------------------------------ gruppi di numeri

export function inRanges(n, ranges) {
  return ranges.some((r) => n >= r.from && n <= r.to);
}

// Gruppi da mostrare nella griglia: i gruppi consecutivi (es. 801–900 e 901–950) diventano uno solo.
export function numberGroups(ranges) {
  const groups = [];
  for (const r of [...ranges].sort((a, b) => a.from - b.from)) {
    const last = groups[groups.length - 1];
    if (last && r.from === last.to + 1) last.to = r.to;
    else groups.push({ from: r.from, to: r.to });
  }
  return groups;
}

export const groupLabel = (g) => (g.from === g.to ? String(g.from) : `${g.from} – ${g.to}`);

// Costruisce le caselle della griglia: se i gruppi sono più di uno, ognuno ha la sua intestazione.
export function numberTiles(ranges, makeTile) {
  const groups = numberGroups(ranges);
  const items = [];
  for (const g of groups) {
    if (groups.length > 1) {
      items.push(
        h(
          'div',
          { class: 'grid-group' },
          icon('paw'),
          g.from === g.to ? `Numero ${g.from}` : `Numeri ${groupLabel(g)}`,
        ),
      );
    }
    for (let n = g.from; n <= g.to; n++) items.push(makeTile(n));
  }
  return items;
}

// ------------------------------------------------------------------ DOM

/**
 * Crea un elemento: h('button', { class: 'btn', onclick: fn }, 'Testo', altroNodo)
 * I testi vengono sempre inseriti come testo (mai come HTML).
 */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'text') el.textContent = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
    else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, value);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false || child === '') continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export function icon(name, className = 'icon') {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `${ICONS_URL}#${name}`);
  svg.append(use);
  return svg;
}

export function setText(selector, text, root = document) {
  for (const el of $$(selector, root)) el.textContent = text;
}

// ------------------------------------------------------------------ notifiche

export function toast(message, type = 'info', { duration = 4500 } = {}) {
  let box = $('.toasts');
  if (!box) {
    box = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
    document.body.append(box);
  }
  const iconName = { success: 'check', error: 'alert', warning: 'alert' }[type] || 'paw';
  const el = h('div', { class: `toast is-${type}` }, icon(iconName), h('span', {}, message));
  box.append(el);
  setTimeout(() => {
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 300);
  }, duration);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = h('textarea', { class: 'sr-only', readonly: true });
    area.value = text;
    document.body.append(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

export function copyButton(text, label = 'Copia') {
  const btn = h(
    'button',
    { type: 'button', class: 'copy-btn', 'aria-label': `${label}: ${text}` },
    icon('copy'),
    'Copia',
  );
  btn.addEventListener('click', async () => {
    const ok = await copyText(text);
    if (!ok) return toast('Copia non riuscita: seleziona il testo a mano.', 'error');
    btn.classList.add('is-copied');
    btn.replaceChildren(icon('check'), 'Copiato');
    setTimeout(() => {
      btn.classList.remove('is-copied');
      btn.replaceChildren(icon('copy'), 'Copia');
    }, 1800);
  });
  return btn;
}

// Pioggia di zampette (per festeggiare una prenotazione).
export function pawBurst(x = window.innerWidth / 2, y = window.innerHeight / 3, count = 18) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#f0568f', '#d23572', '#ffadc9', '#f77fab'];
  for (let i = 0; i < count; i++) {
    const paw = icon('paw', 'paw-burst');
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const distance = 120 + Math.random() * 160;
    paw.style.left = `${x - 14}px`;
    paw.style.top = `${y - 14}px`;
    paw.style.color = colors[i % colors.length];
    paw.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
    paw.style.setProperty('--dy', `${Math.sin(angle) * distance + 80}px`);
    paw.style.setProperty('--rot', `${Math.round(Math.random() * 360 - 180)}deg`);
    document.body.append(paw);
    setTimeout(() => paw.remove(), 1700);
  }
}

export function setLoading(button, loading, loadingText) {
  if (loading) {
    button.dataset.label = button.innerHTML;
    button.classList.add('is-loading');
    button.disabled = true;
    button.replaceChildren(h('span', { class: 'spinner', 'aria-hidden': 'true' }), loadingText || 'Attendere…');
  } else {
    button.classList.remove('is-loading');
    button.disabled = false;
    if (button.dataset.label !== undefined) button.innerHTML = button.dataset.label;
  }
}

// ------------------------------------------------------------------ aggiornamento periodico

/**
 * Richiama fn ogni intervalMs, ma solo se la pagina è visibile e qualcuno la sta usando:
 * dopo idleStopMs senza interazioni si ferma (riparte appena si torna sulla pagina).
 * Restituisce una funzione per fermarlo del tutto.
 */
export function startPolling(fn, intervalMs, { idleStopMs = 10 * 60 * 1000, isPaused = () => false } = {}) {
  let lastActivity = Date.now();
  let stopped = false;
  const touch = () => {
    lastActivity = Date.now();
  };
  for (const type of ['pointerdown', 'keydown', 'scroll', 'touchstart']) {
    window.addEventListener(type, touch, { passive: true });
  }
  const timer = setInterval(() => {
    if (stopped || document.hidden || isPaused() || Date.now() - lastActivity > idleStopMs) return;
    fn();
  }, intervalMs);
  document.addEventListener('visibilitychange', () => {
    if (stopped || document.hidden) return;
    touch();
    if (!isPaused()) fn();
  });
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

// ------------------------------------------------------------------ intestazione e piè di pagina

export function setupHeader() {
  const header = $('.site-header');
  if (!header) return;
  const update = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
  update();
  window.addEventListener('scroll', update, { passive: true });
}

export function applyBranding(settings) {
  setText('[data-bind="title"]', settings.title);
  const org = settings.organization || settings.title;
  setText('[data-bind="organization"]', org);
  for (const el of $$('[data-bind="contact"]')) {
    if (settings.contactEmail) {
      el.hidden = false;
      const link = el.matches('a') ? el : $('a', el);
      if (link) {
        link.href = `mailto:${settings.contactEmail}`;
        if (!link.dataset.keepText) link.textContent = settings.contactEmail;
      }
    } else {
      el.hidden = true;
    }
  }
  setText('[data-bind="year"]', String(new Date().getFullYear()));
}

// ------------------------------------------------------------------ prenotazioni ricordate su questo dispositivo

const MY_ORDERS_KEY = 'lotteria.mieiOrdini';

export function rememberOrder(order) {
  try {
    const list = loadMyOrders().filter((o) => o.code !== order.code);
    list.unshift({ code: order.code, token: order.token, numbers: order.numbers, at: Date.now() });
    localStorage.setItem(MY_ORDERS_KEY, JSON.stringify(list.slice(0, 5)));
  } catch {
    // archivio del browser non disponibile: pazienza
  }
}

export function forgetOrder(code) {
  try {
    const list = loadMyOrders().filter((o) => o.code !== code);
    localStorage.setItem(MY_ORDERS_KEY, JSON.stringify(list));
  } catch {
    // archivio del browser non disponibile
  }
}

export function loadMyOrders() {
  try {
    const list = JSON.parse(localStorage.getItem(MY_ORDERS_KEY) || '[]');
    return Array.isArray(list) ? list.filter((o) => o && o.code && o.token) : [];
  } catch {
    return [];
  }
}
