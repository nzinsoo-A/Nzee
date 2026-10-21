// Regia del video: cosa succede sullo schermo e quando.
// Gli istanti sono agganciati alle parole della voce (E.parola), così clic e voce restano sincronizzati
// anche se si cambia il testo o le pause in piano.json.

window.SCENA = E => {
  const D = window.DATI;
  const P = E.parola;
  const { browser, cursore, camera } = E;
  const seg = id => E.seg(id);
  const URL = {
    login: "https://login.live.com/login.srf",
    pwd: "https://login.live.com/ppsecure/post.srf",
    outlook: "https://outlook.live.com/mail/0/",
    account: "https://account.microsoft.com/?ref=MeControl&refd=account.microsoft.com",
    sicurezza: "https://account.microsoft.com/security",
    verifica: "https://login.live.com/proofs/Verify",
    metodi: "https://account.live.com/proofs/manage/additional",
    cambia: "https://account.live.com/password/Change",
  };

  // Porta il cursore sull'elemento (arrivo) e clicca (tc); evidenzia lo stato «hover» e «premuto».
  const clicca = (sel, tc, { da, arrivo, opz = {}, mano = false } = {}) => {
    const tArr = arrivo ?? tc - 0.15;
    cursore.vai(da ?? tArr - 0.7, tArr, E.punto(sel, opz), { mano });
    E.clic(tc);
    E.classe(sel, "hover", tArr, tc + 0.3);
    E.classe(sel, "premuto", tc - 0.03, tc + 0.18);
    return tc;
  };
  // Le notifiche (il codice che arriva per e-mail) si raccolgono e si animano tutte insieme alla fine
  const notifiche = [];
  const notifica = (t0, t1, codice) => notifiche.push([t0, t1, codice]);

  // ---------- Apertura: cartello del titolo ----------
  const fineTitolo = seg("intro").fine + 0.55;
  E.mostra("#titolo", 0, fineTitolo, { entra: 0.01, esce: 0.55 });
  E.mostra("#titolo .scudo", 0.15, Infinity, { entra: 0.55, scala: 0.35 });
  E.mostra("#titolo h1", 0.35, Infinity, { entra: 0.6, dy: 26 });
  E.mostra("#titolo .sotto", 0.75, Infinity, { entra: 0.6, dy: 16 });
  E.mostra("#titolo .nota", 1.3, Infinity, { entra: 0.6 });
  browser.apri(0, "A", "pg-nuova", "", "Nuova scheda", "nuova");
  cursore.inizio({ x: 1180, y: 640 });

  // ---------- 1. Accesso ----------
  E.capitolo(fineTitolo - 0.1, "1/7", "Accesso");
  const tcUrl = Math.max(fineTitolo + 0.45, P("accesso", "Vai") + 0.1);
  cursore.vai(fineTitolo - 0.1, tcUrl - 0.12, E.punto("#b-url", { ax: 0.22 }));
  E.clic(tcUrl);
  const fineUrl = browser.scriviIndirizzo(tcUrl, "outlook.com", Math.max(tcUrl + 0.2, P("accesso", "outlook.com")), { cps: 12 });
  const tInvio = fineUrl + 0.3;
  browser.vai(tInvio, "A", "pg-accedi", URL.login, "Accedi al tuo account Microsoft", "ms");

  const tcEmail = clicca("#acc-campo-box", tInvio + 0.7, { da: tInvio + 0.05, opz: { ax: 0.3 } });
  E.classe("#acc-campo-box", "attivo", tcEmail);
  const fineEmail = E.digita("#acc-campo", D.account, tcEmail + 0.2, { cps: 18, fuoco: [tcEmail, Infinity] });
  const tcAvanti1 = clicca("#acc-avanti", fineEmail + 0.45, { da: fineEmail + 0.05 });
  browser.vai(tcAvanti1 + 0.3, "A", "pg-password", URL.pwd, "Accedi al tuo account Microsoft", "ms");

  const tcPwd = clicca("#pwd-campo-box", tcAvanti1 + 0.9, { da: tcAvanti1 + 0.35, opz: { ax: 0.3 } });
  E.classe("#pwd-campo-box", "attivo", tcPwd);
  const finePwd = E.digita("#pwd-campo", "Esempio2024", tcPwd + 0.2, { cps: 13, pwd: true, fuoco: [tcPwd, Infinity] });
  const tcAvanti2 = clicca("#pwd-avanti", finePwd + 0.45, { da: finePwd + 0.05 });
  browser.vai(tcAvanti2 + 0.35, "A", "pg-outlook", URL.outlook, "Posta - Mario Rossi - Outlook", "outlook");

  // ---------- 2. Impostazioni dell'account ----------
  E.capitolo(seg("account").inizio - 0.3, "2/7", "Account");
  const tcAvatar = clicca("#ol-avatar", P("account", "iniziali", { fine: true }) + 0.05, {
    da: Math.max(tcAvanti2 + 0.6, seg("account").inizio - 0.4),
    arrivo: P("account", "iniziali") + 0.15,
  });
  E.classe("#ol-avatar", "aperto", tcAvatar);
  E.mostra("#ol-flyout", tcAvatar + 0.05, Infinity, { entra: 0.2, dy: -8 });
  camera.zoom(tcAvatar + 0.25, tcAvatar + 1.05, 1.5, "#ol-flyout");
  const tcLink = clicca("#fl-account", P("account", "Microsoft»", { fine: true }) - 0.15, {
    da: P("account", "scegli") - 0.15,
    arrivo: P("account", "«Il") + 0.2,
    mano: true,
  });
  browser.apri(tcLink + 0.35, "B", "pg-account", URL.account, "Account Microsoft | Home", "ms");
  camera.zoom(tcLink + 0.2, tcLink + 0.8, 1);

  // ---------- 3. Sicurezza ----------
  E.capitolo(seg("sicurezza").inizio - 0.3, "3/7", "Sicurezza");
  const tcSic = clicca("#acc-nav-sicurezza", P("sicurezza", "«Sicurezza»,", { fine: true }) - 0.2, {
    da: P("sicurezza", "menu"),
    arrivo: P("sicurezza", "«Sicurezza»,") + 0.1,
    opz: { ax: 0.3 },
    mano: true,
  });
  browser.vai(tcSic + 0.3, "B", "pg-sicurezza", URL.sicurezza, "Account Microsoft | Sicurezza", "ms");
  camera.zoom(P("sicurezza", "poi"), P("sicurezza", "«Gestisci") + 0.4, 1.35, "#sic-gestisci");
  const tcGestisci = clicca("#sic-gestisci", P("sicurezza", "accesso».", { fine: true }) - 0.15, {
    da: P("sicurezza", "poi") + 0.1,
    arrivo: P("sicurezza", "«Gestisci") + 0.35,
    opz: { ax: 0.45 },
  });
  browser.vai(tcGestisci + 0.35, "B", "pg-quasi", URL.verifica, "Verifica la tua identità", "ms");
  camera.zoom(tcGestisci + 0.15, tcGestisci + 0.75, 1);

  // ---------- 4. Verifica dell'identità ----------
  E.capitolo(seg("verifica").inizio - 0.3, "4/7", "Verifica identità");
  camera.zoom(seg("verifica").inizio + 0.3, seg("verifica").inizio + 1.1, 1.22, "#pg-quasi .ms-scheda");
  const tcOpzione = clicca("#quasi-opzione", P("verifica", "recupero", { fine: true }) - 0.05, {
    da: P("verifica", "tu:"),
    arrivo: P("verifica", "scegli") + 0.35,
    opz: { ax: 0.4 },
  });
  browser.vai(tcOpzione + 0.3, "B", "pg-verifica", URL.verifica, "Verifica la tua identità", "ms");
  const tcVer = clicca("#ver-campo-box", Math.max(tcOpzione + 0.85, P("verifica", "scrivila")), { da: tcOpzione + 0.35, opz: { ax: 0.3 } });
  E.classe("#ver-campo-box", "attivo", tcVer);
  const fineVer = E.digita("#ver-campo", D.vecchia, tcVer + 0.2, { cps: 17, fuoco: [tcVer, Infinity] });
  const tcInvia = clicca("#ver-invia", fineVer + 0.4, { da: fineVer + 0.05 });
  browser.vai(tcInvia + 0.3, "B", "pg-codice", URL.verifica, "Verifica la tua identità", "ms");

  const tNotifica1 = Math.max(tcInvia + 0.8, P("codice", "inserisci") - 0.2);
  notifica(tNotifica1, tNotifica1 + 2.6, D.codice1);
  const tcCifre = clicca("#cod-0", tNotifica1 + 0.45, { da: tcInvia + 0.4 });
  const fineCodice = E.digitaCifre("cod", D.codice1, Math.max(tcCifre + 0.25, P("codice", "codice")), { cps: 7 });
  browser.vai(fineCodice + 0.5, "B", "pg-metodi", URL.metodi, "Opzioni di sicurezza avanzate", "ms");
  camera.zoom(fineCodice + 0.3, fineCodice + 0.9, 1);

  // ---------- 5. Nuova e-mail di recupero ----------
  E.capitolo(seg("aggiungi").inizio - 0.3, "5/7", "Nuova e-mail");
  // la pagina dei metodi ha testi piccoli: la si avvicina per tutta la parte di aggiunta e rimozione
  camera.zoom(seg("aggiungi").inizio - 0.4, seg("aggiungi").inizio + 0.5, 1.3, { x: 960, y: 470 });
  const tcAggiungi = clicca("#mt-aggiungi", P("aggiungi", "verificare»", { fine: true }) - 0.1, {
    da: P("aggiungi", "Ora") - 0.1,
    arrivo: P("aggiungi", "«Aggiungi") + 0.3,
    opz: { ax: 0.4 },
    mano: true,
  });
  const tcScelta = clicca("#dlg-scelta-mail", P("aggiungi", "l'e-mail.", { fine: true }) - 0.1, {
    da: tcAggiungi + 0.3,
    arrivo: P("aggiungi", "scegli") + 0.25,
    opz: { ax: 0.35 },
  });
  const tcMail = clicca("#dlg-mail-box", Math.max(tcScelta + 0.7, P("nuova", "Scrivi")), { da: tcScelta + 0.25, opz: { ax: 0.3 } });
  E.classe("#dlg-mail-box", "attivo", tcMail);
  const fineMail = E.digita("#dlg-mail-campo", D.nuova, tcMail + 0.2, { cps: 17, fuoco: [tcMail, Infinity] });
  const tcAvanti3 = clicca("#dlg-mail-avanti", fineMail + 0.4, { da: fineMail + 0.05 });
  const tNotifica2 = tcAvanti3 + 0.55;
  notifica(tNotifica2, tNotifica2 + 2.4, D.codice2);
  const tcCodice2 = clicca("#dlg-codice-box", tcAvanti3 + 0.75, { da: tcAvanti3 + 0.25, opz: { ax: 0.3 } });
  E.classe("#dlg-codice-box", "attivo", tcCodice2);
  const fineCodice2 = E.digita("#dlg-codice-campo", D.codice2, Math.max(tcCodice2 + 0.25, tNotifica2 + 0.45), { cps: 7, fuoco: [tcCodice2, Infinity] });
  const tcAvanti4 = clicca("#dlg-codice-avanti", fineCodice2 + 0.4, { da: fineCodice2 + 0.05 });
  const dialogo = { entra: 0.18, esce: 0.15, scala: 0.04, base: "translate(-50%, -50%)" };
  E.mostra("#dlg-scelta", tcAggiungi + 0.12, tcScelta + 0.1, dialogo);
  E.mostra("#dlg-mail", tcScelta + 0.15, tcAvanti3 + 0.1, dialogo);
  E.mostra("#dlg-codice", tcAvanti3 + 0.15, tcAvanti4 + 0.1, dialogo);
  const tNuova = tcAvanti4 + 0.25;
  E.classe("#mt-nuova", "nascosto", 0, tNuova);
  E.mostra("#mt-nuova", tNuova, Infinity, { entra: 0.4, scala: 0.06 });
  E.classe("#mt-nuova", "nuova", tNuova, tNuova + 2.4);

  // ---------- 6. Rimozione della vecchia e-mail ----------
  E.capitolo(seg("rimuovi").inizio - 0.3, "6/7", "Vecchia e-mail");
  const tcVecchia = clicca("#mt-vecchia", P("rimuovi", "e-mail,", { fine: true }) - 0.1, {
    da: P("rimuovi", "Adesso"),
    arrivo: P("rimuovi", "vecchia") + 0.2,
    opz: { ax: 0.45, ay: 0.4 },
  });
  const dettagli = document.querySelector("#mt-vecchia .dettagli");
  E.ogni(t => { dettagli.style.height = `${E.lerp(0, 34, E.prog(t, tcVecchia + 0.05, tcVecchia + 0.3))}px`; });
  E.ogni(t => { document.querySelector("#mt-vecchia .freccia").style.transform = `rotate(${E.prog(t, tcVecchia + 0.05, tcVecchia + 0.3) * 180}deg)`; });
  const tcRimuovi = clicca("#mt-rimuovi", P("rimuovi", "«Rimuovi»", { fine: true }) - 0.05, {
    da: tcVecchia + 0.35,
    arrivo: P("rimuovi", "«Rimuovi»") + 0.1,
    mano: true,
  });
  const tcConferma = clicca("#dlg-rimuovi-ok", P("rimuovi", "conferma.", { fine: true }) - 0.35, {
    da: tcRimuovi + 0.35,
    arrivo: P("rimuovi", "conferma.") + 0.15,
  });
  E.mostra("#mt-velo", [[tcAggiungi + 0.12, tcAvanti4 + 0.1], [tcRimuovi + 0.12, tcConferma + 0.1]], null, { entra: 0.18, esce: 0.2 });
  E.mostra("#dlg-rimuovi", tcRimuovi + 0.12, tcConferma + 0.1, dialogo);
  E.mostra("#mt-vecchia", 0, tcConferma + 0.2, { entra: 0.01, esce: 0.3, scala: 0.05 });
  E.classe("#mt-vecchia", "nascosto", tcConferma + 0.5);
  E.classe("#mt-nuova", "nuova", P("rimuovi", "quella"), P("rimuovi", "quella") + 1.6);
  cursore.vai(tcConferma + 0.6, P("rimuovi", "quella") - 0.1, E.punto("#mt-nuova", { ax: 0.75, ay: 0.85 }));

  // ---------- 7. Cambio della password ----------
  E.capitolo(seg("password").inizio - 0.3, "7/7", "Password");
  const tcIndietro = clicca("#pg-metodi .mt-indietro", P("password", "«Sicurezza»", { fine: true }) - 0.1, {
    da: P("password", "Infine,"),
    arrivo: P("password", "«Sicurezza»") + 0.15,
    mano: true,
  });
  browser.vai(tcIndietro + 0.3, "B", "pg-sicurezza", URL.sicurezza, "Account Microsoft | Sicurezza", "ms");
  camera.zoom(tcIndietro + 0.1, tcIndietro + 0.7, 1);
  const tcCambia = clicca("#sic-rap-pwd", P("password", "password».", { fine: true }) - 0.15, {
    da: tcIndietro + 0.4,
    arrivo: P("password", "«Cambia") + 0.2,
    opz: { ax: 0.3 },
    mano: true,
  });
  browser.vai(tcCambia + 0.35, "B", "pg-cambia", URL.cambia, "Cambia password", "ms");
  camera.zoom(tcCambia + 0.5, tcCambia + 1.3, 1.25, "#pg-cambia .cp-main");

  const fuocoAttuale = [0, Infinity], fuocoNuova = [0, Infinity];
  const tcAttuale = clicca("#cp-attuale-box", Math.max(tcCambia + 0.9, P("salva", "Digita")), { da: tcCambia + 0.4, opz: { ax: 0.3 } });
  fuocoAttuale[0] = tcAttuale;
  const fineAttuale = E.digita("#cp-attuale", "Esempio2024", tcAttuale + 0.15, { cps: 14, pwd: true, fuoco: fuocoAttuale });
  const tcNuova = clicca("#cp-nuova-box", Math.max(fineAttuale + 0.35, P("salva", "una")), { da: fineAttuale + 0.05, opz: { ax: 0.3 } });
  fuocoAttuale[1] = fuocoNuova[0] = tcNuova;
  const fineNuova = E.digita("#cp-nuova", "Lampone!Viola27", tcNuova + 0.15, { cps: 17, pwd: true, fuoco: fuocoNuova });
  const tcRipeti = clicca("#cp-ripeti-box", fineNuova + 0.35, { da: fineNuova + 0.05, opz: { ax: 0.3 } });
  fuocoNuova[1] = tcRipeti;
  const fineRipeti = E.digita("#cp-ripeti", "Lampone!Viola27", tcRipeti + 0.15, { cps: 17, pwd: true, fuoco: [tcRipeti, Infinity] });
  E.classe("#cp-attuale-box", "attivo", tcAttuale, tcNuova);
  E.classe("#cp-nuova-box", "attivo", tcNuova, tcRipeti);
  E.classe("#cp-ripeti-box", "attivo", tcRipeti);
  const tcSalva = clicca("#cp-salva", Math.max(fineRipeti + 0.35, P("salva", "«Salva».") + 0.1), { da: fineRipeti + 0.05 });
  const tSalvata = tcSalva + 0.35;
  browser.vai(tSalvata, "B", "pg-sicurezza", URL.sicurezza, "Account Microsoft | Sicurezza", "ms");
  E.testo("#sic-data", t => (t >= tSalvata ? D.dataDopo : D.dataPrima));
  E.classe("#sic-rap-pwd", "aggiornato", tSalvata + 0.6, tSalvata + 2.8);
  camera.zoom(tcSalva + 0.15, tcSalva + 0.75, 1);
  camera.zoom(tSalvata + 0.5, tSalvata + 1.2, 1.45, "#sic-rap-pwd");
  cursore.vai(tSalvata + 0.2, tSalvata + 0.9, E.punto("#sic-rap-pwd", { ax: 0.2, ay: 1.6 }));

  // ---------- Chiusura ----------
  const inizioFine = seg("fine").inizio - 0.45;
  E.capitolo(inizioFine, null, null);
  camera.zoom(inizioFine, inizioFine + 0.6, 1);
  E.mostra("#chiusura", inizioFine, Infinity, { entra: 0.6 });
  const tFatto = P("fine", "Fatto!");
  E.mostra("#fine-titolo", tFatto - 0.15, Infinity, { entra: 0.45, scala: 0.25 });
  ["#fine-1", "#fine-2", "#fine-3"].forEach((s, i) => E.mostra(s, tFatto + 0.5 + i * 0.4, Infinity, { entra: 0.45, dy: 22, scala: 0.08 }));
  E.mostra("#fine-consiglio", P("fine", "ricorda:") - 0.1, Infinity, { entra: 0.5, dy: 18 });

  E.mostra("#notifica", notifiche.map(([a, b]) => [a, b]), null, { entra: 0.3, esce: 0.3, dy: 24 });
  E.testo("#notifica-codice", t => (notifiche.find(([a, b]) => t >= a - 0.5 && t < b + 0.6) || [0, 0, ""])[2]);

  // dissolvenza dal nero all'inizio e verso il nero alla fine
  const nero = document.querySelector("#nero");
  const durata = E.TL.durata;
  E.ogni(t => { nero.style.opacity = Math.max(1 - E.prog(t, 0, 0.5, E.andamento.lin), E.prog(t, durata - 1.0, durata - 0.05, E.andamento.lin)); });

  // per il mixaggio: quando suonare il «ding» delle notifiche
  return { notifiche: notifiche.map(([t0]) => t0) };
};
