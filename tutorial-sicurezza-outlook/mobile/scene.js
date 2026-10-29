// Regia della versione per telefono: tocchi, tastiera, scorrimenti e zoom, agganciati alle parole della voce.

window.SCENA = E => {
  const D = window.DATI;
  const P = E.parola;
  const seg = id => E.seg(id);
  const { safari, tastiera, camera } = E;
  const dialogo = { entra: 0.2, esce: 0.15, scala: 0.04 };

  // tocca un elemento e restituisce l'istante del tocco
  const tocca = (sel, t, opz = {}) => E.tocca(sel, t, { opz });
  // apre la tastiera su un campo, scrive e restituisce l'istante dell'ultimo tasto
  const scrivi = (box, campo, testo, tTocco, { tipo = "testo", cps = 12, sugg = "", fino = Infinity, pwd = false, inizio } = {}) => {
    tocca(box, tTocco, { ax: 0.3 });
    E.classe(box, "attivo", tTocco, fino);
    const t1 = E.digita(campo, testo, inizio ?? tTocco + 0.45, { cps, pwd, fuoco: [tTocco + 0.05, fino] });
    return t1;
  };
  const suggPassword = `<span class="forte">🔑 Password</span>`;
  const suggMail = codice => `<span><span class="piccolo">Da Mail</span><span class="forte">${codice}</span></span>`;

  // ---------- Apertura ----------
  const fineTitolo = seg("intro").fine + 0.5;
  E.mostra("#titolo", 0, fineTitolo, { entra: 0.01, esce: 0.55 });
  E.mostra("#titolo .scudo", 0.15, Infinity, { entra: 0.55, scala: 0.35 });
  E.mostra("#titolo h1", 0.35, Infinity, { entra: 0.6, dy: 30 });
  E.mostra("#titolo .sotto", 0.75, Infinity, { entra: 0.6, dy: 20 });
  E.mostra("#titolo .telefonino", 1.1, Infinity, { entra: 0.6, dy: 16 });
  E.mostra("#titolo .nota", 1.4, Infinity, { entra: 0.6 });
  safari.apri(0, "pg-home", "");

  // ---------- 1. Accesso ----------
  E.capitolo(fineTitolo - 0.1, "1/7", "Accesso");
  const tcUrl = Math.max(fineTitolo + 0.35, P("accesso", "vai") - 0.1);
  tocca("#s-indirizzo", tcUrl);
  const modUrl = safari.scriviIndirizzo(tcUrl, "outlook.com", Math.max(tcUrl + 0.55, P("accesso", "outlook.com")), { cps: 8 });
  const tcVai = modUrl.fine + 0.35;
  modUrl.tFine = tcVai + 0.1;
  tocca('.gruppo-tasti[data-tipo="url"] [data-k="k-invio"]', tcVai);
  tastiera.premi(tcVai, "k-invio");
  tastiera.apri(tcUrl + 0.05, tcVai + 0.05, "url");
  safari.vai(tcVai + 0.15, "pg-accedi", "login.live.com");

  const tcMail = tcVai + 0.95;
  const fineMail = scrivi("#acc-box", "#acc-campo", D.account, tcMail, { tipo: "email", cps: 14 });
  tastiera.apri(tcMail + 0.05, fineMail + 0.25, "email", { sugg: `<span>${D.account}</span>` });
  const tcAvanti = tocca("#acc-avanti", fineMail + 0.55);
  safari.vai(tcAvanti + 0.3, "pg-password", "login.live.com");

  const tcPwd = tcAvanti + 0.9;
  const finePwd = scrivi("#pwd-box", "#pwd-campo", D.password, tcPwd, { cps: 11, pwd: true });
  tastiera.apri(tcPwd + 0.05, finePwd + 0.25, "password", { sugg: suggPassword });
  const tcAccedi = tocca("#pwd-accedi", finePwd + 0.55);
  safari.vai(tcAccedi + 0.35, "pg-outlook", "outlook.live.com");

  // ---------- 2. Account ----------
  E.capitolo(seg("account").inizio - 0.3, "2/7", "Account");
  const tcAvatar = tocca("#ol-avatar", Math.max(tcAccedi + 1.0, P("account", "iniziali", { fine: true }) + 0.05));
  E.classe("#ol-avatar", "aperto", tcAvatar);
  E.mostra("#ol-pannello", tcAvatar + 0.08, Infinity, { entra: 0.22, dy: -10 });
  camera.zoom(tcAvatar + 0.2, tcAvatar + 1.0, 1.32, E.punto("#ol-pannello", { ay: 0.55 }));
  const tcLink = tocca("#ol-link-account", Math.max(tcAvatar + 1.3, P("account", "Microsoft»", { fine: true }) - 0.15));
  safari.nuovaScheda(tcLink + 0.4, "pg-account", "account.microsoft.com");
  camera.zoom(tcLink + 0.25, tcLink + 0.85, 1);

  // ---------- 3. Sicurezza ----------
  E.capitolo(seg("sicurezza").inizio - 0.3, "3/7", "Sicurezza");
  const tcMenu = tocca("#acc-hamb", Math.max(tcLink + 1.0, P("sicurezza", "menu", { fine: true })));
  const cassetto = document.querySelector("#acc-drawer");
  E.ogni(t => { cassetto.style.transform = `translateX(${-102 * (1 - E.prog(t, tcMenu + 0.05, tcMenu + 0.35, E.andamento.out))}%)`; });
  const tcSic = tocca("#acc-voce-sicurezza", Math.max(tcMenu + 0.8, P("sicurezza", "«Sicurezza».", { fine: true }) - 0.15));
  E.classe("#acc-voce-sicurezza", "hover", tcSic - 0.1, tcSic + 0.3);
  safari.vai(tcSic + 0.3, "pg-sicurezza", "account.microsoft.com");
  // «più in basso»: si scorre la pagina con il dito fino al pulsante
  const tScorri = Math.max(tcSic + 0.9, P("sicurezza", "più") - 0.2);
  E.trascina(tScorri, tScorri + 0.7, E.punto("#vista", { ax: 0.55, ay: 0.78 }), E.punto("#vista", { ax: 0.55, ay: 0.4 }));
  E.scorri("pg-sicurezza", tScorri, tScorri + 0.8, 300);
  const tcGestisci = tocca("#sic-gestisci", Math.max(tScorri + 1.1, P("sicurezza", "accesso».", { fine: true }) - 0.2));
  safari.vai(tcGestisci + 0.35, "pg-quasi", "login.live.com");
  E.scorri("pg-sicurezza", tcGestisci + 0.6, tcGestisci + 0.6, -300); // tornandoci, la pagina riparte dall'alto

  // ---------- 4. Verifica dell'identità ----------
  E.capitolo(seg("verifica").inizio - 0.3, "4/7", "Verifica identità");
  const tcOpzione = tocca("#quasi-opzione", Math.max(tcGestisci + 1.0, P("verifica", "recupero", { fine: true }) - 0.05), { ax: 0.4 });
  E.classe("#quasi-opzione", "hover", tcOpzione - 0.05, tcOpzione + 0.3);
  safari.vai(tcOpzione + 0.3, "pg-verifica", "login.live.com");
  const tcVer = Math.max(tcOpzione + 0.9, P("verifica", "scrivila"));
  const fineVer = scrivi("#ver-box", "#ver-campo", D.vecchia, tcVer, { tipo: "email", cps: 14 });
  tastiera.apri(tcVer + 0.05, fineVer + 0.25, "email");
  const tcInvia = tocca("#ver-invia", fineVer + 0.55);
  safari.vai(tcInvia + 0.3, "pg-codice", "login.live.com");

  const tNotifica1 = Math.max(tcInvia + 0.8, P("codice", "inserisci") - 0.3);
  E.notifica(tNotifica1, tNotifica1 + 2.4, D.codice1);
  const tcCod = tocca("#cod-0", tNotifica1 + 0.7);
  camera.zoom(tcCod - 0.4, tcCod + 0.4, 1.28, E.punto("#pg-codice .codici", { ay: 0.2 }));
  const fineCod = E.digitaCifre("cod", D.codice1, tcCod + 0.5, { cps: 5.5 });
  tastiera.apri(tcCod + 0.05, fineCod + 0.3, "numeri", { sugg: suggMail(D.codice1) });
  safari.vai(fineCod + 0.6, "pg-metodi", "account.live.com");
  camera.zoom(fineCod + 0.4, fineCod + 1.0, 1);

  // ---------- 5. Nuova e-mail di recupero ----------
  E.capitolo(seg("aggiungi").inizio - 0.3, "5/7", "Nuova e-mail");
  const tcAggiungi = tocca("#mt-aggiungi", Math.max(fineCod + 1.4, P("aggiungi", "all'account»,", { fine: true }) - 0.1), { ax: 0.3 });
  E.classe("#dlg-scelta-passkey", "sel", 0, Infinity);
  const tcScelta = tocca("#dlg-scelta-mail", Math.max(tcAggiungi + 0.9, P("aggiungi", "e-mail».", { fine: true }) - 0.1), { ax: 0.45 });
  const tcNuova = Math.max(tcScelta + 0.75, P("nuova", "Scrivi"));
  const fineNuova = scrivi("#dlg-mail-box", "#dlg-mail-campo", D.nuova, tcNuova, { tipo: "email", cps: 14 });
  tastiera.apri(tcNuova + 0.05, fineNuova + 0.25, "email");
  const tcAvanti2 = tocca("#dlg-mail-avanti", fineNuova + 0.55);
  const tNotifica2 = tcAvanti2 + 0.6;
  E.notifica(tNotifica2, tNotifica2 + 2.3, D.codice2);
  const tcCod2 = Math.max(tcAvanti2 + 0.9, tNotifica2 + 0.6);
  const fineCod2 = scrivi("#dlg-codice-box", "#dlg-codice-campo", D.codice2, tcCod2, { cps: 5.5 });
  tastiera.apri(tcCod2 + 0.05, fineCod2 + 0.25, "numeri", { sugg: suggMail(D.codice2) });
  const tcVerifica = tocca("#dlg-codice-avanti", fineCod2 + 0.55);
  E.mostra("#dlg-scelta", tcAggiungi + 0.12, tcScelta + 0.1, dialogo);
  E.mostra("#dlg-mail", tcScelta + 0.15, tcAvanti2 + 0.1, dialogo);
  E.mostra("#dlg-codice", tcAvanti2 + 0.15, tcVerifica + 0.1, dialogo);
  camera.zoom(tcAggiungi + 0.1, tcAggiungi + 0.8, 1.22, E.punto("#dlg-scelta", { ay: 0.45 }));
  camera.zoom(tcVerifica + 0.2, tcVerifica + 0.8, 1);
  const tNuova = tcVerifica + 0.3;
  E.classe("#mt-nuova", "nascosto", 0, tNuova);
  E.mostra("#mt-nuova", tNuova, Infinity, { entra: 0.4, scala: 0.03 });
  E.classe("#mt-nuova", "nuova", tNuova, tNuova + 2.2);

  // ---------- 6. Rimozione della vecchia e-mail ----------
  E.capitolo(seg("rimuovi").inizio - 0.3, "6/7", "Vecchia e-mail");
  const tcVecchia = tocca("#mt-vecchia .lv-riga-testa", Math.max(tNuova + 0.9, P("rimuovi", "e-mail,", { fine: true }) - 0.1), { ax: 0.4 });
  const dettagli = document.querySelector("#mt-vecchia .lv-dettagli");
  const altezza = dettagli.firstElementChild.offsetHeight;
  E.ogni(t => { dettagli.style.height = `${E.lerp(0, altezza, E.prog(t, tcVecchia + 0.05, tcVecchia + 0.35))}px`; });
  E.ogni(t => { document.querySelector("#mt-vecchia .freccia").style.transform = `rotate(${E.prog(t, tcVecchia + 0.05, tcVecchia + 0.35) * 180}deg)`; });
  const tcRimuovi = tocca("#mt-vecchia-rimuovi", Math.max(tcVecchia + 0.8, P("rimuovi", "«Rimuovi»", { fine: true }) - 0.05));
  const tcConferma = tocca("#dlg-rimuovi-ok", Math.max(tcRimuovi + 0.8, P("rimuovi", "conferma.", { fine: true }) - 0.25));
  E.mostra("#mt-velo", [[tcAggiungi + 0.12, tcVerifica + 0.1], [tcRimuovi + 0.12, tcConferma + 0.1]], null, { entra: 0.18, esce: 0.2 });
  E.mostra("#dlg-rimuovi", tcRimuovi + 0.12, tcConferma + 0.1, dialogo);
  E.mostra("#mt-vecchia", 0, tcConferma + 0.2, { entra: 0.01, esce: 0.3, scala: 0.03 });
  E.classe("#mt-vecchia", "nascosto", tcConferma + 0.5);
  E.classe("#mt-nuova", "nuova", P("rimuovi", "quella"), P("rimuovi", "quella") + 1.6);

  // ---------- 7. Cambio della password ----------
  E.capitolo(seg("password").inizio - 0.3, "7/7", "Password");
  const tcHamb = tocca("#mt-hamb", Math.max(tcConferma + 1.0, P("password", "menu", { fine: true }) - 0.05));
  E.classe("#mt-hamb", "aperto", tcHamb, tcHamb + 2);
  const tendina = document.querySelector("#mt-tendina");
  E.ogni(t => { tendina.style.height = `${E.lerp(0, 276, E.prog(t, tcHamb + 0.05, tcHamb + 0.35, E.andamento.out))}px`; });
  const tcTornaSic = tocca("#mt-tendina-sicurezza", Math.max(tcHamb + 0.8, P("password", "«Sicurezza»,", { fine: true }) - 0.1));
  E.classe("#mt-tendina-sicurezza", "hover", tcTornaSic - 0.05, tcTornaSic + 0.3);
  safari.vai(tcTornaSic + 0.3, "pg-sicurezza", "account.microsoft.com");
  const tcCambia = tocca("#sic-rap-pwd", Math.max(tcTornaSic + 0.9, P("password", "password».", { fine: true }) - 0.15), { ax: 0.3 });
  safari.vai(tcCambia + 0.35, "pg-cambia", "account.live.com");

  const tcNuovaPwd = Math.max(tcCambia + 1.0, P("salva", "Digita"));
  const fineCampo1 = { t: Infinity }; // il primo campo resta attivo fino al tocco sul secondo
  const fineNuovaPwd = scrivi("#cp-nuova-box", "#cp-nuova", D.nuovaPassword, tcNuovaPwd, { cps: 12, pwd: true, fino: () => fineCampo1.t });
  const tcRipeti = fineNuovaPwd + 0.45;
  fineCampo1.t = tcRipeti;
  const fineRipeti = scrivi("#cp-ripeti-box", "#cp-ripeti", D.nuovaPassword, tcRipeti, { cps: 12, pwd: true });
  tastiera.apri(tcNuovaPwd + 0.05, fineRipeti + 0.55, "password", { sugg: suggPassword });
  const tcFine = tocca("#t-accessorio .fine", fineRipeti + 0.45);
  const tcSalva = tocca("#cp-salva", Math.max(tcFine + 0.7, P("salva", "«Salva».") + 0.05));
  const tSalvata = tcSalva + 0.4;
  safari.vai(tSalvata, "pg-sicurezza", "account.microsoft.com");
  E.testo("#sic-data", t => (t >= tSalvata ? D.dataDopo : D.dataPrima));
  E.classe("#sic-rap-pwd", "aggiornato", tSalvata + 0.5, tSalvata + 3);
  camera.zoom(tSalvata + 0.4, tSalvata + 1.1, 1.5, E.punto("#sic-rap-pwd"));

  // ---------- Chiusura ----------
  const inizioFine = Math.max(tSalvata + 2.6, seg("fine").inizio - 0.45);
  E.capitolo(inizioFine, null, null);
  camera.zoom(inizioFine, inizioFine + 0.6, 1);
  E.mostra("#chiusura", inizioFine, Infinity, { entra: 0.6 });
  const tFatto = P("fine", "Fatto!");
  E.mostra("#fine-titolo", tFatto - 0.15, Infinity, { entra: 0.45, scala: 0.25 });
  ["#fine-1", "#fine-2", "#fine-3"].forEach((s, i) => E.mostra(s, tFatto + 0.5 + i * 0.4, Infinity, { entra: 0.45, dy: 26, scala: 0.08 }));
  E.mostra("#fine-consiglio", P("fine", "ricorda:") - 0.1, Infinity, { entra: 0.5, dy: 20 });

  const nero = document.querySelector("#nero");
  const durata = E.TL.durata;
  E.ogni(t => { nero.style.opacity = Math.max(1 - E.prog(t, 0, 0.5, E.andamento.lin), E.prog(t, durata - 1.0, durata - 0.05, E.andamento.lin)); });
};
