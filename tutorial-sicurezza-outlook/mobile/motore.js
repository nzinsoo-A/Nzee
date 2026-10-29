// Motore del video per telefono. Come nella versione da computer, ogni elemento animato
// è una funzione del tempo: renderAt(t) ridisegna il fotogramma da zero.
// Qui al posto del mouse ci sono i tocchi del dito, la tastiera di iOS e Safari.

(() => {
  const W = 1080, H = 1612; // area della telecamera, sopra la fascia dei sottotitoli
  const $ = s => (typeof s === "string" ? document.querySelector(s) : s);
  const clamp01 = x => Math.max(0, Math.min(1, x));
  const andamento = {
    inOut: k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
    out: k => 1 - Math.pow(1 - k, 3),
    in: k => k * k * k,
    lin: k => k,
  };
  const prog = (t, t0, t1, f = andamento.inOut) => (t1 <= t0 ? (t >= t1 ? 1 : 0) : f(clamp01((t - t0) / (t1 - t0))));
  const lerp = (a, b, k) => a + (b - a) * k;
  const caso = i => { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };

  const tracce = [];
  const ogni = fn => tracce.push(fn);
  const E = { andamento, prog, lerp, ogni, $ };
  let TL;

  // ---------- Riferimenti alla voce ----------
  const norm = s => s.toLowerCase().replace(/[«»"“”.,:;!?()]/g, "");
  E.seg = id => {
    const s = TL.segmenti.find(x => x.id === id);
    if (!s) throw new Error("segmento mancante: " + id);
    return s;
  };
  E.parola = (id, testo, { n = 1, fine = false } = {}) => {
    let k = 0;
    for (const p of E.seg(id).parole) if (norm(p.w) === norm(testo) && ++k === n) return fine ? p.t1 : p.t0;
    throw new Error(`parola «${testo}» non trovata in ${id}`);
  };

  // ---------- Visibilità, classi, testi ----------
  const opacita = (t, intervalli, entra, esce) =>
    Math.max(0, ...intervalli.map(([a, b]) => prog(t, a, a + entra, andamento.out) * (1 - (b === Infinity || b == null ? 0 : prog(t, b, b + esce, andamento.in)))));
  E.mostra = (el, t0, t1 = Infinity, { entra = 0.2, esce = 0.2, dy = 0, scala = 0, base = "" } = {}) => {
    el = $(el);
    const intervalli = Array.isArray(t0) ? t0 : [[t0, t1]];
    ogni(t => {
      const v = opacita(t, intervalli, entra, esce);
      el.style.opacity = v;
      el.style.visibility = v > 0.001 ? "visible" : "hidden";
      if (dy || scala || base) el.style.transform = `${base} translateY(${(1 - v) * dy}px) scale(${1 - scala * (1 - v)})`;
    });
  };
  const classi = new Map();
  E.classe = (el, nome, t0, t1 = Infinity) => {
    el = $(el);
    let m = classi.get(el);
    if (!m) {
      m = {};
      classi.set(el, m);
      ogni(t => { for (const [n, iv] of Object.entries(m)) el.classList.toggle(n, iv.some(([a, b]) => t >= a && t < (typeof b === "function" ? b() : b))); });
    }
    (m[nome] ||= []).push([t0, t1]);
  };
  E.testo = (el, fn) => { el = $(el); ogni(t => { const s = fn(t); if (el.innerHTML !== s) el.innerHTML = s; }); };

  // ---------- Tastiera di iOS ----------
  const ALT_TASTIERA = 336;
  const sessioni = []; // {t0, t1, tipo, sugg}
  const pressioni = []; // {t, carattere, pwd}
  const layout = {};
  const tasto = (id, x, y, w, h, html, cls = "") => ({ id, x, y, w, h, html, cls });
  const righeLettere = () => {
    const k = [];
    "qwertyuiop".split("").forEach((c, i) => k.push(tasto("k-" + c, 3 + i * 39, 4, 33, 42, c)));
    "asdfghjkl".split("").forEach((c, i) => k.push(tasto("k-" + c, 22.5 + i * 39, 58, 33, 42, c)));
    k.push(tasto("k-shift", 3, 112, 44, 42, '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M12 3.5 3.5 12.6h4.6V20h7.8v-7.4h4.6z" fill="none" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>', "spec"));
    "zxcvbnm".split("").forEach((c, i) => k.push(tasto("k-" + c, 59.5 + i * 39, 112, 33, 42, c)));
    k.push(tasto("k-canc", 343, 112, 44, 42, `<i class="ic">${ICONE.backspace_24_regular}</i>`, "spec"));
    return k;
  };
  layout.testo = [...righeLettere(), tasto("k-123", 3, 166, 87, 42, "123", "spec"), tasto("k-spazio", 96, 166, 198, 42, "spazio"), tasto("k-invio", 300, 166, 87, 42, "invio", "spec")];
  layout.email = [...righeLettere(), tasto("k-123", 3, 166, 87, 42, "123", "spec"), tasto("k-spazio", 96, 166, 102, 42, "spazio"),
    tasto("k-@", 204, 166, 42, 42, "@"), tasto("k-.", 252, 166, 42, 42, "."), tasto("k-invio", 300, 166, 87, 42, "vai", "blu")];
  layout.url = [...righeLettere(), tasto("k-123", 3, 166, 87, 42, "123", "spec"), tasto("k-.", 96, 166, 42, 42, "."), tasto("k-/", 144, 166, 42, 42, "/"),
    tasto("k-.com", 192, 166, 102, 42, ".com"), tasto("k-invio", 300, 166, 87, 42, "vai", "blu")];
  const lettere = ["", "ABC", "DEF", "GHI", "JKL", "MNO", "PQRS", "TUV", "WXYZ"];
  layout.numeri = [];
  for (let i = 0; i < 9; i++) layout.numeri.push(tasto("k-" + (i + 1), 3 + (i % 3) * 130, 4 + Math.floor(i / 3) * 52, 124, 46,
    `<span class="num">${i + 1}<span class="lettere">${lettere[i]}</span></span>`, "num"));
  layout.numeri.push(tasto("k-0", 133, 160, 124, 46, `<span class="num">0</span>`, "num"));
  layout.numeri.push(tasto("k-canc", 263, 160, 124, 46, `<i class="ic">${ICONE.backspace_24_regular}</i>`, "spec num"));
  layout.password = layout.testo;

  const costruisciTastiera = () => {
    const cont = $("#t-tasti");
    for (const [tipo, tasti] of Object.entries(layout)) {
      if (tipo === "password") continue;
      const g = document.createElement("div");
      g.className = "gruppo-tasti";
      g.dataset.tipo = tipo;
      g.style.cssText = "position:absolute;inset:0;display:none";
      g.innerHTML = tasti.map(k => `<span class="tasto ${k.cls}" data-k="${k.id}" style="left:${k.x}px;top:${k.y}px;width:${k.w}px;height:${k.h}px">${k.html}</span>`).join("");
      cont.appendChild(g);
    }
  };
  const tastoPer = (c, tipo) => {
    if (tipo === "numeri") return /\d/.test(c) ? "k-" + c : null;
    const l = c.toLowerCase();
    if (/[a-z]/.test(l)) return "k-" + l;
    if (c === " ") return "k-spazio";
    if (c === "@" && tipo === "email") return "k-@";
    if (c === "." && (tipo === "email" || tipo === "url")) return "k-.";
    if (c === "/" && tipo === "url") return "k-/";
    return "k-123";
  };
  E.tastiera = {
    apri: (t0, t1, tipo, { sugg = "" } = {}) => sessioni.push({ t0, t1, tipo, sugg }),
    // pressione di un tasto speciale (invio/vai)
    premi: (t, id) => pressioni.push({ t, id }),
  };
  const sessioneA = t => sessioni.find(s => t >= s.t0 && t <= s.t1 + 0.3);
  const altezzaTastiera = t => {
    let v = 0;
    for (const s of sessioni) v = Math.max(v, prog(t, s.t0, s.t0 + 0.28, andamento.out) * (1 - prog(t, s.t1, s.t1 + 0.25, andamento.in)));
    return v;
  };
  const renderTastiera = t => {
    const v = altezzaTastiera(t);
    const tast = $("#tastiera");
    tast.style.transform = `translateY(${(1 - v) * 100}%)`;
    tast.style.visibility = v > 0 ? "visible" : "hidden";
    const s = sessioneA(t) || sessioni.filter(x => x.t0 <= t).at(-1);
    const tipo = s ? (s.tipo === "password" ? "testo" : s.tipo) : "testo";
    for (const g of document.querySelectorAll(".gruppo-tasti")) g.style.display = g.dataset.tipo === tipo ? "block" : "none";
    const sugg = s ? s.sugg : "";
    const el = $("#t-suggerimenti");
    if (el.innerHTML !== sugg) el.innerHTML = sugg;
    // tasti premuti
    const premuti = new Set();
    let bolla = null;
    for (const p of pressioni) {
      if (t < p.t - 0.02 || t > p.t + 0.11) continue;
      const ses = sessioni.find(x => p.t >= x.t0 && p.t <= x.t1 + 0.3);
      const tipoP = ses ? (ses.tipo === "password" ? "testo" : ses.tipo) : "testo";
      const id = p.id || tastoPer(p.carattere, tipoP);
      if (!id) continue;
      premuti.add(id);
      if (!p.pwd && !p.id && tipoP !== "numeri" && /^k-[a-z@./]$/.test(id)) bolla = { id, c: p.carattere.toLowerCase() };
    }
    for (const k of document.querySelectorAll(".gruppo-tasti .tasto")) k.classList.toggle("premuto", premuti.has(k.dataset.k));
    const b = $("#t-bolla");
    if (bolla) {
      const k = document.querySelector(`.gruppo-tasti[data-tipo="${tipo}"] [data-k="${bolla.id}"]`);
      if (k) {
        b.style.left = `${parseFloat(k.style.left) + parseFloat(k.style.width) / 2 - 25}px`;
        b.style.top = `${parseFloat(k.style.top) - 62}px`;
        b.textContent = bolla.c;
        b.style.visibility = "visible";
      }
    } else b.style.visibility = "hidden";
    // con la tastiera aperta la barra di Safari sparisce
    $("#safari").style.opacity = 1 - v;
  };

  // ---------- Digitazione ----------
  const tempiTasti = (testo, t0, cps) => {
    const tempi = [];
    let t = t0;
    for (let i = 0; i < testo.length; i++) {
      t += (1 / cps) * (0.65 + 0.7 * caso(i + testo.length * 7));
      tempi.push(t);
    }
    return tempi;
  };
  E.digita = (id, testo, t0, { cps = 9, pwd = false, fuoco = null, cifre = false } = {}) => {
    const box = $(id);
    const val = box.querySelector(".valore"), caret = box.querySelector(".caret"), seg = box.querySelector(".segnaposto");
    const tempi = tempiTasti(testo, t0, cps);
    tempi.forEach((tt, i) => pressioni.push({ t: tt, carattere: testo[i], pwd }));
    const t1 = tempi[tempi.length - 1];
    const fz = fuoco || [t0, Infinity];
    ogni(t => {
      const f0 = fz[0], f1 = typeof fz[1] === "function" ? fz[1]() : fz[1];
      let n = 0;
      while (n < tempi.length && tempi[n] <= t) n++;
      const s = testo.slice(0, n);
      // come su iPhone: nei campi password l'ultimo carattere resta visibile per un attimo
      val.textContent = pwd ? "•".repeat(Math.max(0, n - 1)) + (n && t - tempi[n - 1] < 0.45 ? s.at(-1) : n ? "•" : "") : s;
      const attivo = t >= f0 && t < f1;
      if (caret) caret.style.opacity = attivo && (t <= t1 + 0.35 || Math.floor((t - f0) / 0.53) % 2 === 0) ? 1 : 0;
      if (seg) seg.style.visibility = s.length ? "hidden" : "visible";
    });
    return t1;
  };
  E.digitaCifre = (prefisso, codice, t0, { cps = 5, fino = Infinity } = {}) => {
    const tempi = tempiTasti(codice, t0, cps);
    tempi.forEach((tt, i) => pressioni.push({ t: tt, carattere: codice[i] }));
    const caselle = [...codice].map((_, i) => $(`#${prefisso}-${i}`));
    ogni(t => {
      let n = 0;
      while (n < tempi.length && tempi[n] <= t) n++;
      caselle.forEach((c, i) => {
        c.textContent = i < n ? codice[i] : "";
        c.classList.toggle("attivo", t >= t0 - 0.6 && t < fino && i === Math.min(n, caselle.length - 1));
      });
    });
    return tempi[tempi.length - 1];
  };

  // ---------- Safari ----------
  const eventiSafari = [];
  const modificheUrl = [];
  E.safari = {
    apri: (t, pagina, dominio) => eventiSafari.push({ t, pagina, dominio, tipo: "apri" }),
    vai: (t, pagina, dominio) => eventiSafari.push({ t, pagina, dominio, tipo: "vai" }),
    nuovaScheda: (t, pagina, dominio) => eventiSafari.push({ t, pagina, dominio, tipo: "scheda" }),
    // barra dell'indirizzo sopra la tastiera: scrive il testo e restituisce l'istante dell'ultimo tasto
    // restituisce la modifica: .fine è l'ultimo tasto, .tFine (da impostare) è quando la barra si richiude
    scriviIndirizzo: (tFuoco, testo, t0, { cps = 8 } = {}) => {
      const tempi = tempiTasti(testo, t0, cps);
      tempi.forEach((tt, i) => pressioni.push({ t: tt, carattere: testo[i] }));
      const modifica = { tFuoco, testo, tempi, fine: tempi[tempi.length - 1], tFine: Infinity };
      modificheUrl.push(modifica);
      return modifica;
    },
  };
  const statoSafari = t => {
    const st = { mostrata: null, prima: null, tCambio: -9, tCarico: -9, dominio: "", scheda: false };
    for (const e of [...eventiSafari].sort((a, b) => a.t - b.t)) {
      if (e.t > t) break;
      if (e.pagina !== st.mostrata) {
        st.prima = st.mostrata;
        st.mostrata = e.pagina;
        st.tCambio = e.t;
        st.scheda = e.tipo === "scheda";
      }
      st.dominio = e.dominio;
      if (e.tipo !== "apri") st.tCarico = e.t;
    }
    return st;
  };
  const renderSafari = t => {
    const st = statoSafari(t);
    const k = prog(t, st.tCambio, st.tCambio + (st.scheda ? 0.4 : 0.22), andamento.out);
    for (const p of document.querySelectorAll("#vista > .pagina")) {
      let v = 0, z = 0, tr = "";
      if (p.id === st.mostrata) {
        v = k; z = 2;
        if (st.scheda && k < 1) tr = `scale(${0.86 + 0.14 * k})`; // nuova scheda: la pagina «cresce» come in Safari
      } else if (p.id === st.prima && k < 1) { v = 1; z = 1; }
      p.style.opacity = v;
      p.style.visibility = v > 0 ? "visible" : "hidden";
      p.style.zIndex = z;
      p.style.transform = tr;
    }
    const dom = $("#s-dominio");
    const testoDom = st.dominio || '<span style="color:#8e8e93;font-weight:400">Cerca o inserisci nome sito</span>';
    if (dom.innerHTML !== testoDom) dom.innerHTML = testoDom;
    const c = $("#s-carica");
    const dc = t - st.tCarico;
    c.style.width = dc >= 0 && dc < 0.7 ? `${lerp(10, 100, prog(t, st.tCarico, st.tCarico + 0.55, andamento.out))}%` : "0";
    c.style.opacity = dc >= 0 && dc < 0.7 ? 1 - prog(t, st.tCarico + 0.5, st.tCarico + 0.7) : 0;
    // modifica dell'indirizzo
    const mod = $("#s-modifica");
    const m = modificheUrl.find(x => t >= x.tFuoco && t < x.tFine);
    mod.style.visibility = m ? "visible" : "hidden";
    if (m) {
      mod.style.bottom = `${altezzaTastiera(t) * ALT_TASTIERA}px`;
      let n = 0;
      while (n < m.tempi.length && m.tempi[n] <= t) n++;
      const caret = n < m.tempi.length || Math.floor(t / 0.53) % 2 === 0 ? `<span style="display:inline-block;width:2px;height:20px;background:#0a84ff;vertical-align:-4px;border-radius:1px"></span>` : "";
      const html = n === 0 && st.dominio ? `<span class="sel-url">${st.dominio}</span>` : `${m.testo.slice(0, n)}${caret}`;
      const el = $("#s-testo-url");
      if (el.innerHTML !== html) el.innerHTML = html;
    }
  };

  // ---------- Scorrimento delle pagine ----------
  const scorrimenti = [];
  E.scorri = (pagina, t0, t1, dy) => scorrimenti.push({ pagina, t0, t1, dy });
  const renderScorrimenti = t => {
    const tot = {};
    for (const s of scorrimenti) tot[s.pagina] = (tot[s.pagina] || 0) + s.dy * prog(t, s.t0, s.t1, andamento.inOut);
    for (const p of document.querySelectorAll("#vista > .pagina > .contenuto")) p.style.transform = `translateY(${-(tot[p.parentElement.id] || 0)}px)`;
  };

  // ---------- Telecamera ----------
  let cam = { s: 1, tx: 0, ty: 0 };
  const mossaCamera = [];
  E.camera = { zoom: (t0, t1, s, p = { x: W / 2, y: H / 2 }) => mossaCamera.push({ t0, t1, s, p }) };
  const trasformazione = (s, x, y) => ({
    s,
    tx: Math.min(0, Math.max(W - s * W, W / 2 - s * x)),
    ty: Math.min(0, Math.max(H - s * H, H / 2 - s * y)),
  });
  let misurando = false;
  const renderCamera = t => {
    let stato = { s: 1, tx: 0, ty: 0 };
    if (!misurando) {
      for (const m of mossaCamera) {
        if (t < m.t0) break;
        const fine = trasformazione(m.s, m.punto.x, m.punto.y);
        const k = prog(t, m.t0, m.t1);
        stato = { s: lerp(stato.s, fine.s, k), tx: lerp(stato.tx, fine.tx, k), ty: lerp(stato.ty, fine.ty, k) };
      }
    }
    cam = stato;
    $("#camera").style.transform = `translate(${stato.tx}px, ${stato.ty}px) scale(${stato.s})`;
  };
  E.punto = (sel, { ax = 0.5, ay = 0.5, dx = 0, dy = 0 } = {}) => () => {
    const r = $(sel).getBoundingClientRect();
    return { x: (r.left + r.width * ax - cam.tx) / cam.s + dx, y: (r.top + r.height * ay - cam.ty) / cam.s + dy };
  };
  const risolvi = p => (typeof p === "function" ? p() : typeof p === "string" ? E.punto(p)() : p);

  // ---------- Tocchi del dito ----------
  const tocchi = []; // {t, p, punto}
  const trascinamenti = []; // {t0, t1, da, a}
  E.tocca = (sel, t, { opz = {}, premuto = true } = {}) => {
    tocchi.push({ t, p: typeof sel === "string" ? E.punto(sel, opz) : sel });
    if (premuto && typeof sel === "string") E.classe(sel, "premuto", t - 0.03, t + 0.2);
    return t;
  };
  E.trascina = (t0, t1, da, a) => trascinamenti.push({ t0, t1, da, a });
  const renderDito = t => {
    if (misurando) return;
    const dito = $("#dito");
    let vis = 0, x = 0, y = 0, sc = 1;
    for (const c of tocchi) {
      if (t < c.t - 0.34 || t > c.t + 0.32) continue;
      const a = prog(t, c.t - 0.34, c.t - 0.14, andamento.out);
      const b = 1 - prog(t, c.t + 0.12, c.t + 0.32, andamento.in);
      vis = Math.min(a, b);
      // il dito arriva da poco più in basso, come una mano che si avvicina allo schermo
      x = c.punto.x + (1 - a) * 26;
      y = c.punto.y + (1 - a) * 46;
      sc = 1.25 - 0.25 * a - (t >= c.t - 0.04 && t < c.t + 0.1 ? 0.14 : 0);
    }
    for (const g of trascinamenti) {
      if (t < g.t0 - 0.2 || t > g.t1 + 0.25) continue;
      const k = prog(t, g.t0, g.t1, andamento.inOut);
      vis = prog(t, g.t0 - 0.2, g.t0, andamento.out) * (1 - prog(t, g.t1, g.t1 + 0.25, andamento.in));
      x = lerp(g.puntoDa.x, g.puntoA.x, k);
      y = lerp(g.puntoDa.y, g.puntoA.y, k);
      sc = 0.92;
    }
    dito.style.opacity = vis;
    dito.style.left = `${x}px`;
    dito.style.top = `${y}px`;
    dito.style.transform = `scale(${sc})`;
    // scia del trascinamento
    const scia = $("#scia");
    const g = trascinamenti.find(g => t >= g.t0 && t <= g.t1 + 0.25);
    if (g) {
      const k = prog(t, g.t0, g.t1, andamento.inOut);
      const k0 = Math.max(0, k - 0.35);
      const p0 = { x: lerp(g.puntoDa.x, g.puntoA.x, k0), y: lerp(g.puntoDa.y, g.puntoA.y, k0) };
      scia.querySelector("path").setAttribute("d", `M${p0.x} ${p0.y} L${x} ${y}`);
      scia.style.opacity = 0.8 * (1 - prog(t, g.t1, g.t1 + 0.25));
    } else scia.style.opacity = 0;
    // onde gialle dei tocchi
    const onde = [...document.querySelectorAll(".onda")];
    let i = 0;
    for (const c of tocchi) {
      const d = t - c.t;
      if (d < 0 || d > 0.55) continue;
      const o = onde[i++];
      if (!o) break;
      const k = andamento.out(d / 0.55);
      o.style.left = `${c.punto.x}px`;
      o.style.top = `${c.punto.y}px`;
      o.style.transform = `scale(${lerp(0.3, 1, k)})`;
      o.style.opacity = (1 - k) * 0.95;
    }
    for (; i < onde.length; i++) onde[i].style.opacity = 0;
  };

  // ---------- Notifiche di iOS ----------
  const notifiche = [];
  E.notifica = (t0, t1, codice) => notifiche.push({ t0, t1, codice });
  const renderNotifica = t => {
    const n = notifiche.find(x => t >= x.t0 - 0.1 && t <= x.t1 + 0.5);
    const el = $("#notifica");
    if (!n) { el.style.visibility = "hidden"; return; }
    const v = prog(t, n.t0, n.t0 + 0.4, andamento.out) * (1 - prog(t, n.t1, n.t1 + 0.4, andamento.in));
    el.style.visibility = v > 0 ? "visible" : "hidden";
    el.style.transform = `translateY(${lerp(-140, 52, v)}px)`;
    const c = $("#notifica-codice");
    if (c.textContent !== n.codice) c.textContent = n.codice;
  };

  // ---------- Sottotitoli e capitoli ----------
  // le etichette tra «» in giallo; le parole col trattino (e-mail) non vanno mai a capo a metà
  const evidenziaUi = s => s.replace(/«([^»]+)»/g, '<span class="ui">«$1»</span>').replace(/(\S*\w-\w\S*)/g, '<span style="white-space:nowrap">$1</span>');
  const renderSottotitoli = t => {
    const cue = TL.segmenti.flatMap(s => s.cue);
    let html = "", v = 0;
    for (let i = 0; i < cue.length; i++) {
      const a = cue[i].t0 - 0.06;
      const b = Math.min(cue[i].t1 + 0.4, i + 1 < cue.length ? cue[i + 1].t0 - 0.08 : Infinity);
      if (t >= a && t < b + 0.12) {
        html = evidenziaUi(cue[i].testo);
        v = prog(t, a, a + 0.12, andamento.lin) * (1 - prog(t, b, b + 0.12, andamento.lin));
      }
    }
    const el = $("#sottotitolo");
    const blocco = `<div>${html}</div>`;
    if (el.innerHTML !== blocco) el.innerHTML = blocco;
    el.style.opacity = v;
  };
  const capitoli = [];
  E.capitolo = (t, numero, titolo) => capitoli.push({ t, numero, titolo });
  const renderCapitolo = t => {
    let att = null;
    for (const c of capitoli) if (t >= c.t) att = c;
    const el = $("#capitolo");
    if (!att || !att.titolo) {
      el.style.opacity = att ? 1 - prog(t, att.t, att.t + 0.3) : 0;
      return;
    }
    const html = `<span class="pillola"><span class="num">${att.numero}</span>${att.titolo}</span>`;
    if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; }
    const k = prog(t, att.t, att.t + 0.35, andamento.out);
    el.style.opacity = k;
    el.style.transform = `translateY(${(1 - k) * 12}px)`;
  };

  // ---------- Avvio ----------
  window.avvia = async timeline => {
    TL = timeline;
    E.TL = TL;
    $("#vista").innerHTML = Object.values(window.PAGINE).join("");
    for (const i of document.querySelectorAll("[data-ic]")) i.innerHTML = ICONE[i.dataset.ic] || "";
    costruisciTastiera();
    for (let i = 0; i < 3; i++) $("#strato-tocco").insertAdjacentHTML("beforeend", '<div class="onda"></div>');
    await document.fonts.ready;
    const extra = window.SCENA(E) || {};
    ogni(renderScorrimenti);
    ogni(renderSafari);
    ogni(renderTastiera);
    ogni(renderNotifica);
    ogni(renderCamera);
    ogni(renderDito);
    ogni(renderSottotitoli);
    ogni(renderCapitolo);
    // ogni bersaglio si misura com'è la pagina nell'istante in cui lo si raggiunge
    misurando = true;
    for (const c of tocchi) { window.renderAt(c.t); c.punto = risolvi(c.p); }
    for (const g of trascinamenti) { window.renderAt(g.t0); g.puntoDa = risolvi(g.da); g.puntoA = risolvi(g.a); }
    mossaCamera.sort((a, b) => a.t0 - b.t0);
    for (const m of mossaCamera) { window.renderAt(m.t1); m.punto = risolvi(m.p); }
    misurando = false;
    window.renderAt(0);
    return {
      durata: TL.durata,
      clic: tocchi.map(c => c.t).sort((a, b) => a - b),
      tasti: pressioni.map(p => p.t).sort((a, b) => a - b),
      notifiche: notifiche.map(n => n.t0),
      ...extra,
    };
  };
  window.renderAt = t => { for (const f of tracce) f(t); };
})();
