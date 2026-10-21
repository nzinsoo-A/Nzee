// Motore del video. Ogni elemento animato è una funzione del tempo t (in secondi):
// renderAt(t) ridisegna il fotogramma da zero, quindi i fotogrammi si possono
// catturare in qualsiasi ordine (anche in parallelo) con lo stesso risultato.

(() => {
  const W = 1920, H = 944; // area dello schermo sopra la fascia dei sottotitoli
  const $ = s => (typeof s === "string" ? document.querySelector(s) : s);

  const clamp01 = x => Math.max(0, Math.min(1, x));
  const andamento = {
    inOut: k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
    out: k => 1 - Math.pow(1 - k, 3),
    in: k => k * k * k,
    lin: k => k,
    rimbalzo: k => { const c = 1.70158; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); },
  };
  const prog = (t, t0, t1, f = andamento.inOut) => (t1 <= t0 ? (t >= t1 ? 1 : 0) : f(clamp01((t - t0) / (t1 - t0))));
  const lerp = (a, b, k) => a + (b - a) * k;
  // numeri pseudocasuali ripetibili, per una digitazione «umana» ma sempre uguale
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
  // inizio (o fine) dell'n-esima occorrenza di una parola in un segmento
  E.parola = (id, testo, { n = 1, fine = false } = {}) => {
    let k = 0;
    for (const p of E.seg(id).parole) if (norm(p.w) === norm(testo) && ++k === n) return fine ? p.t1 : p.t0;
    throw new Error(`parola «${testo}» non trovata in ${id}`);
  };

  // ---------- Visibilità e classi ----------
  const opacita = (t, intervalli, entra, esce) =>
    Math.max(0, ...intervalli.map(([a, b]) => prog(t, a, a + entra, andamento.out) * (1 - (b === Infinity ? 0 : prog(t, b, b + esce, andamento.in)))));
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
      ogni(t => { for (const [n, iv] of Object.entries(m)) el.classList.toggle(n, iv.some(([a, b]) => t >= a && t < b)); });
    }
    (m[nome] ||= []).push([t0, t1]);
  };
  E.testo = (el, fn) => { el = $(el); ogni(t => { const s = fn(t); if (el.innerHTML !== s) el.innerHTML = s; }); };

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
  // Scrive testo in un campo (.campo con .valore/.caret/.segnaposto). Restituisce l'istante dell'ultimo tasto.
  E.digita = (id, testo, t0, { cps = 14, pwd = false, fuoco = null, puntini = "•" } = {}) => {
    const box = $(id);
    const val = box.querySelector(".valore"), caret = box.querySelector(".caret"), seg = box.querySelector(".segnaposto");
    const tempi = tempiTasti(testo, t0, cps);
    const t1 = tempi[tempi.length - 1];
    const fz = fuoco || [t0, Infinity]; // letto a ogni fotogramma: la scena può fissarne la fine più avanti
    ogni(t => {
      const [f0, f1] = fz;
      let n = 0;
      while (n < tempi.length && tempi[n] <= t) n++;
      const s = testo.slice(0, n);
      val.textContent = pwd ? puntini.repeat(s.length) : s;
      const attivo = t >= f0 && t < f1;
      const scrive = t >= t0 && t <= t1 + 0.35;
      if (caret) caret.style.opacity = attivo && (scrive || Math.floor((t - f0) / 0.53) % 2 === 0) ? 1 : 0;
      if (seg) seg.style.visibility = s.length ? "hidden" : "visible";
    });
    return t1;
  };
  // Codice a cifre separate (una casella per cifra)
  E.digitaCifre = (prefisso, codice, t0, { cps = 6, fino = Infinity } = {}) => {
    const tempi = tempiTasti(codice, t0, cps);
    const caselle = [...codice].map((_, i) => $(`#${prefisso}-${i}`));
    ogni(t => {
      let n = 0;
      while (n < tempi.length && tempi[n] <= t) n++;
      caselle.forEach((c, i) => {
        c.textContent = i < n ? codice[i] : "";
        c.classList.toggle("attivo", t >= t0 - 0.4 && t < fino && i === Math.min(n, caselle.length - 1));
      });
    });
    return tempi[tempi.length - 1];
  };

  // ---------- Browser: schede, indirizzo, caricamento ----------
  const eventiBrowser = [];
  const barra = { fuoco: [], digita: [] };
  E.browser = {
    apri: (t, id, pagina, url, titolo, icona) => eventiBrowser.push({ t, tipo: "apri", id, pagina, url, titolo, icona }),
    vai: (t, id, pagina, url, titolo, icona) => eventiBrowser.push({ t, tipo: "vai", id, pagina, url, titolo, icona }),
    attiva: (t, id) => eventiBrowser.push({ t, tipo: "attiva", id }),
    // clic nella barra degli indirizzi, digitazione e Invio
    scriviIndirizzo: (tFuoco, testo, t0, { cps = 11 } = {}) => {
      const tempi = tempiTasti(testo, t0, cps);
      barra.digita.push({ tFuoco, testo, t0, tempi, fine: tempi[tempi.length - 1] + 0.35 });
      return tempi[tempi.length - 1];
    },
  };
  const statoBrowser = t => {
    const st = { schede: [], attiva: null, mostrata: null, prima: null, tCambio: -9, tCarico: -9 };
    for (const e of [...eventiBrowser].sort((a, b) => a.t - b.t)) {
      if (e.t > t) break;
      let s = st.schede.find(x => x.id === e.id);
      if (e.tipo === "apri") {
        s = { id: e.id };
        st.schede.push(s);
      }
      if (e.tipo !== "attiva") Object.assign(s, { pagina: e.pagina, url: e.url, titolo: e.titolo, icona: e.icona ?? s.icona });
      if (e.tipo !== "attiva") st.tCarico = e.t;
      st.attiva = e.id;
      const nuova = s.pagina;
      if (nuova !== st.mostrata) {
        st.prima = st.mostrata;
        st.mostrata = nuova;
        st.tCambio = e.t;
      }
    }
    return st;
  };
  const iconeSchede = {
    nuova: `<span class="fav" style="background:#3a3a3a"></span>`,
    outlook: `<span class="fav" style="background:#0f6cbd;color:#fff;font-size:10px;font-weight:700">O</span>`,
    ms: `<span class="fav"><span class="ms-logo"><span class="q" style="grid-template-columns:6px 6px;grid-auto-rows:6px"><i></i><i></i><i></i><i></i></span></span></span>`,
  };
  const urlHtml = url => {
    if (!url) return `<span style="color:#9a9a9a">Cerca o immetti l'indirizzo Web</span>`;
    const m = url.match(/^(https:\/\/)([^/]+)(.*)$/);
    return m ? `<span>${m[1]}</span><span class="dom">${m[2]}</span><span>${m[3]}</span>` : url;
  };
  const renderBrowser = t => {
    const st = statoBrowser(t);
    // pagine: quella mostrata entra in dissolvenza sopra la precedente
    const k = prog(t, st.tCambio, st.tCambio + 0.22, andamento.out);
    for (const p of document.querySelectorAll("#vista > .pagina")) {
      let v = 0, z = 0;
      if (p.id === st.mostrata) { v = k; z = 2; }
      else if (p.id === st.prima && k < 1) { v = 1; z = 1; }
      p.style.opacity = v;
      p.style.visibility = v > 0 ? "visible" : "hidden";
      p.style.zIndex = z;
    }
    // schede
    const html = st.schede.map(s => `<div class="b-scheda${s.id === st.attiva ? " attiva" : ""}" id="scheda-${s.id}">${iconeSchede[s.icona] || iconeSchede.nuova}<span class="tit">${s.titolo}</span><i class="ic chiudi">${ICONE.dismiss_12_regular}</i></div>`).join("") +
      `<div class="b-nuova"><i class="ic">${ICONE.add_16_regular}</i></div>`;
    const sch = $("#b-schede");
    if (sch.innerHTML !== html) sch.innerHTML = html;
    // barra degli indirizzi (con eventuale digitazione in corso)
    const attiva = st.schede.find(s => s.id === st.attiva);
    let url = urlHtml(attiva ? attiva.url : ""), fuoco = false;
    for (const d of barra.digita) {
      if (t >= d.tFuoco && t < d.fine) {
        fuoco = true;
        let n = 0;
        while (n < d.tempi.length && d.tempi[n] <= t) n++;
        const caret = n < d.tempi.length || Math.floor(t / 0.53) % 2 === 0 ? `<span style="display:inline-block;width:1px;height:15px;background:#fff;vertical-align:-3px"></span>` : "";
        url = n === 0 && attiva && attiva.url ? `<span class="sel">${attiva.url}</span>` : `<span class="dom">${d.testo.slice(0, n)}</span>${caret}`;
      }
    }
    const u = $("#b-url-testo");
    const lucchetto = attiva && attiva.url && !fuoco;
    const htmlUrl = (lucchetto ? `<i class="ic">${ICONE.lock_closed_12_regular}</i>` : "") + `<span>${url}</span>`;
    if (u.innerHTML !== htmlUrl) u.innerHTML = htmlUrl;
    $("#b-url").classList.toggle("attivo", fuoco);
    // barra di caricamento
    const c = $("#b-carica");
    const dc = t - st.tCarico;
    c.style.width = dc >= 0 && dc < 0.6 ? `${lerp(8, 100, prog(t, st.tCarico, st.tCarico + 0.45, andamento.out))}%` : "0";
    c.style.opacity = dc >= 0 && dc < 0.6 ? 1 - prog(t, st.tCarico + 0.42, st.tCarico + 0.6) : 0;
  };

  // ---------- Posizioni (nello spazio della telecamera, cioè dello schermo non ingrandito) ----------
  let cam = { s: 1, tx: 0, ty: 0 };
  E.punto = (sel, { ax = 0.5, ay = 0.5, dx = 0, dy = 0 } = {}) => () => {
    const r = $(sel).getBoundingClientRect();
    const x = r.left + r.width * ax, y = r.top + r.height * ay;
    return { x: (x - cam.tx) / cam.s + dx, y: (y - cam.ty) / cam.s + dy };
  };
  const risolvi = p => (typeof p === "function" ? p() : typeof p === "string" ? E.punto(p)() : p);

  // ---------- Telecamera (zoom) ----------
  const mossaCamera = [];
  E.camera = {
    // porta lo zoom a s centrato sul punto p tra t0 e t1 (p: selettore, funzione o {x, y})
    zoom: (t0, t1, s, p = { x: W / 2, y: H / 2 }) => mossaCamera.push({ t0, t1, s, p }),
  };
  const trasformazione = (s, x, y) => {
    const tx = Math.min(0, Math.max(W - s * W, W / 2 - s * x));
    const ty = Math.min(0, Math.max(H - s * H, H / 2 - s * y));
    return { s, tx, ty };
  };
  // Durante la misura dei bersagli la telecamera resta ferma e il cursore non si disegna
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

  // ---------- Cursore ----------
  const mosseCursore = [];
  const clic = [];
  let posIniziale = { x: W / 2, y: H / 2 };
  E.cursore = {
    inizio: p => { posIniziale = p; },
    // sposta il cursore verso p tra t0 e t1; con mano: true all'arrivo diventa la manina dei link
    vai: (t0, t1, p, { mano = false, curva = 0.12 } = {}) => {
      mosseCursore.push({ t0, t1, p, mano, curva: mosseCursore.length % 2 ? curva : -curva });
      return t1;
    },
    clic: t => { clic.push(t); return t; },
  };
  E.clic = E.cursore.clic;
  const posCursore = t => {
    let pos = posIniziale, mano = false;
    for (const m of mosseCursore) {
      if (t < m.t0) break;
      const fine = m.fine;
      if (t >= m.t1) { pos = fine; mano = m.mano; continue; }
      const k = prog(t, m.t0, m.t1);
      const dx = fine.x - pos.x, dy = fine.y - pos.y;
      const cx = pos.x + dx / 2 - dy * m.curva, cy = pos.y + dy / 2 + dx * m.curva;
      pos = {
        x: (1 - k) * (1 - k) * pos.x + 2 * (1 - k) * k * cx + k * k * fine.x,
        y: (1 - k) * (1 - k) * pos.y + 2 * (1 - k) * k * cy + k * k * fine.y,
      };
      mano = m.mano && k > 0.97;
      break;
    }
    return { ...pos, mano };
  };
  const renderCursore = t => {
    if (misurando) return;
    const p = posCursore(t);
    let premuto = 0;
    for (const c of clic) premuto = Math.max(premuto, t >= c - 0.04 && t < c + 0.14 ? 1 : 0);
    const el = $("#cursore");
    el.style.transform = `translate(${p.x}px, ${p.y}px) scale(${premuto ? 0.86 : 1})`;
    el.querySelector(".freccia").style.display = p.mano ? "none" : "block";
    el.querySelector(".mano").style.display = p.mano ? "block" : "none";
    el.style.opacity = t < 0.05 ? 0 : 1;
    // onde dei clic
    const onde = [...document.querySelectorAll(".onda")];
    let i = 0;
    for (const c of clic) {
      const d = t - c;
      if (d < 0 || d > 0.55) continue;
      const o = onde[i++];
      if (!o) break;
      const q = posCursore(c);
      const k = andamento.out(d / 0.55);
      o.style.left = `${q.x}px`;
      o.style.top = `${q.y}px`;
      o.style.transform = `scale(${lerp(0.25, 1, k)})`;
      o.style.opacity = (1 - k) * 0.95;
    }
    for (; i < onde.length; i++) onde[i].style.opacity = 0;
  };

  // ---------- Sottotitoli e capitoli ----------
  const evidenziaUi = s => s.replace(/«([^»]+)»/g, '<span class="ui">«$1»</span>');
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
    if (el.innerHTML !== html) el.innerHTML = html;
    el.style.opacity = v;
  };
  const capitoli = [];
  E.capitolo = (t, numero, titolo) => capitoli.push({ t, numero, titolo });
  const renderCapitolo = t => {
    let attuale = null;
    for (const c of capitoli) if (t >= c.t) attuale = c;
    const el = $("#capitolo");
    if (!attuale || !attuale.titolo) {
      const fine = attuale ? prog(t, attuale.t, attuale.t + 0.3) : 1;
      el.style.opacity = attuale ? 1 - fine : 0;
      return;
    }
    const html = `<span class="num">${attuale.numero}</span><span class="tit">${attuale.titolo}</span>`;
    if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; }
    const k = prog(t, attuale.t, attuale.t + 0.35, andamento.out);
    el.style.opacity = k;
    el.style.transform = `translateY(calc(-50% + ${(1 - k) * 10}px))`;
  };

  // ---------- Avvio ----------
  window.avvia = async timeline => {
    TL = timeline;
    E.TL = TL;
    $("#vista").innerHTML = Object.values(window.PAGINE).join("");
    for (const i of document.querySelectorAll("[data-ic]")) i.innerHTML = ICONE[i.dataset.ic] || "";
    for (let i = 0; i < 3; i++) $("#strato-cursore").insertAdjacentHTML("beforeend", '<div class="onda"></div>');
    await document.fonts.ready;
    const extra = window.SCENA(E) || {};
    ogni(renderBrowser);
    ogni(renderCamera);
    ogni(renderCursore);
    ogni(renderSottotitoli);
    ogni(renderCapitolo);
    // ogni bersaglio (di cursore e telecamera) si misura com'è la pagina nell'istante in cui lo si raggiunge
    misurando = true;
    mosseCursore.sort((a, b) => a.t0 - b.t0);
    mossaCamera.sort((a, b) => a.t0 - b.t0);
    for (const m of [...mosseCursore, ...mossaCamera]) {
      window.renderAt(m.t1);
      const p = risolvi(m.p);
      if (mosseCursore.includes(m)) m.fine = p;
      else m.punto = p;
    }
    misurando = false;
    window.renderAt(0);
    return { durata: TL.durata, clic: [...clic].sort((a, b) => a - b), ...extra };
  };
  window.renderAt = t => { for (const f of tracce) f(t); };
})();
