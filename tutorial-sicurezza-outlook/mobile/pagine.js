// Pagine ricostruite nella versione per telefono (iPhone, Safari). Tutti i dati personali sono di esempio.

window.DATI = {
  nome: "Mario Rossi",
  iniziali: "MR",
  account: "mario.rossi.esempio@outlook.it",
  vecchia: "vecchia.mail@outlook.com",
  vecchiaMascherata: "ve*****@outlook.com",
  nuova: "nuova.mail@example.com",
  password: "Esempio2024",
  nuovaPassword: "Lampone!Viola27",
  codice1: "482917",
  codice2: "730254",
  dataPrima: "14/03/2024",
  dataDopo: "29/10/2026",
};

(() => {
  const D = window.DATI;
  const ic = (nome, extra = "") => `<i class="ic ${extra}" data-ic="${nome}"></i>`;
  const logo = (lato = 11, testo = "Microsoft") =>
    `<span class="ms-logo"><span class="q" style="grid-template-columns:${lato}px ${lato}px;grid-auto-rows:${lato}px"><i></i><i></i><i></i><i></i></span>${testo}</span>`;
  const campo = (id, segnaposto = "") =>
    `<span class="campo" id="${id}"><span class="segnaposto">${segnaposto}</span><span class="valore"></span><span class="caret"></span></span>`;
  const P = {};

  // ---------- Pagina iniziale di Safari ----------
  const pref = [["#e8453c", "N"], ["#2f9e44", "M"], ["#1c7ed6", "W"], ["#f59f00", "G"], ["#7048e8", "R"], ["#0ca678", "T"], ["#d6336c", "F"], ["#495057", "B"]];
  const nomiPref = ["Notizie", "Meteo", "Wiki", "Giochi", "Ricette", "Treni", "Foto", "Banca"];
  P["pg-home"] = `<section class="pagina" id="pg-home"><div class="contenuto">
    <h2>Preferiti</h2>
    <div class="preferiti">${pref.map(([c, l], i) => `<span class="pref"><i style="background:${c}">${l}</i>${nomiPref[i]}</span>`).join("")}</div>
    <div class="riquadro"><b>Rapporto sulla privacy</b>Negli ultimi sette giorni Safari ha impedito a 12 tracker di profilarti.</div>
  </div></section>`;

  // ---------- Accesso (login.live.com, tema chiaro) ----------
  const piede = (guida = "Guida") => `<div class="piede"><div class="voci"><span>${guida}</span><span>Condizioni per l'utilizzo</span><span>Privacy e cookie</span></div>
    <div class="nota">Usare l'esplorazione privata se questo non è il proprio dispositivo.<a>Altre informazioni</a></div></div>`;
  const accesso = (id, interno, { indietro = true, guida } = {}) => `<section class="pagina lg" id="${id}"><div class="contenuto">
    <div class="testa">${indietro ? ic("arrow_left_20_regular", "indietro") : ""}${logo()}</div>${interno}</div>${piede(guida)}</section>`;

  P["pg-accedi"] = accesso("pg-accedi", `
    <h1 style="margin-top:26px">Accedi</h1>
    <p class="sotto">per continuare in Outlook</p>
    <div class="campo-box" id="acc-box"><span class="etichetta">Posta elettronica o numero di telefono</span>${campo("acc-campo")}</div>
    <a class="link-sx">Non hai un account? Creane uno!</a>
    <div class="pulsante" id="acc-avanti">Avanti</div>`, { indietro: false });

  P["pg-password"] = accesso("pg-password", `
    <div class="pillola">${D.account}</div>
    <h1>Immetti la password</h1>
    <div class="campo-box" id="pwd-box"><span class="etichetta">Password</span>${campo("pwd-campo")}</div>
    <a class="link-sx">Password dimenticata?</a>
    <div class="pulsante" id="pwd-accedi">Accedi</div>`);

  P["pg-quasi"] = accesso("pg-quasi", `
    <div class="pillola">${D.account}</div>
    <h1>Ci siamo quasi</h1>
    <p class="sotto">Solo un altro passaggio per verificare l'identità.</p>
    <div class="opzione" id="quasi-opzione">${ic("mail_20_regular")}<span>Invia un codice ${D.vecchiaMascherata}</span></div>
    <a class="link">È già disponibile un codice?</a>
    <a class="link">Non si riconosce o non si dispone di nessuna di queste prove?</a>`, { indietro: false });

  P["pg-verifica"] = accesso("pg-verifica", `
    <div class="pillola">${D.account}</div>
    <h1>Verifica l'indirizzo di posta elettronica</h1>
    <p class="sotto">Verrà inviato un codice di verifica a <b>${D.vecchiaMascherata}</b>. Per confermare l'indirizzo di posta elettronica corretto, immetterlo qui.</p>
    <div class="campo-box" id="ver-box"><span class="etichetta">Posta elettronica</span>${campo("ver-campo")}</div>
    <div class="pulsante" id="ver-invia">Invia il codice</div>
    <a class="link">Hai già ricevuto un codice?</a>`);

  P["pg-codice"] = accesso("pg-codice", `
    <div class="pillola">${D.account}</div>
    <h1>Immetti il codice</h1>
    <p class="sotto">Se ${D.vecchia} corrisponde all'indirizzo e-mail del tuo account, ti invieremo un codice.</p>
    <div class="codici">${Array.from({ length: 6 }, (_, i) => `<span class="cifra" id="cod-${i}"></span>`).join("")}</div>
    <a class="link" style="margin-top:34px">Usa la password</a>`, { guida: "Guida e feedback" });

  // ---------- Outlook sul web ----------
  const messaggi = [
    ["#0f6cbd", "A", "Account Microsoft", "Il tuo codice monouso", "Usa questo codice per completare l'accesso…", "09:41", true],
    ["#c239b3", "G", "Giulia Bianchi", "Foto della gita", "Ciao Mario, ti mando le foto di domenica…", "08:15", true],
    ["#107c10", "L", "Luca Verdi", "Riunione di giovedì", "Confermo l'appuntamento alle 10, porto io…", "ieri"],
    ["#ca5010", "B", "Biblioteca civica", "Promemoria di restituzione", "Il prestito scade tra tre giorni…", "lun"],
    ["#5c2e91", "P", "Palestra Centro", "Nuovi orari dei corsi", "Da novembre cambiano gli orari del corso…", "dom"],
    ["#038387", "A", "Anna Neri", "Ricetta della torta", "Come promesso, ecco la ricetta della nonna…", "sab"],
  ];
  P["pg-outlook"] = `<section class="pagina" id="pg-outlook">
    <div class="ol-testa">
      <div class="ol-riga1"><span class="menu">${ic("navigation_24_regular")}</span><span class="titolo">Posta in arrivo</span>
        <span class="az">${ic("alert_24_regular")}${ic("search_24_regular")}<span class="ol-avatar" id="ol-avatar">${D.iniziali}</span></span></div>
      <div class="ol-riga2"><span class="pill sel">Evidenziata</span><span class="pill">Altro</span><span class="pill dx">Filtro</span></div>
    </div>
    <div class="ol-banner">Altra: 3 nuove conversazioni<div class="sotto">Newsletter; Offerte</div>${ic("dismiss_circle_20_regular")}</div>
    <div class="ol-lista"><div class="ol-sezione">Oggi</div>
      ${messaggi.map(([c, l, m, o, a, h, n]) => `<div class="ol-msg${n ? " nuovo" : ""}"><span class="av" style="background:${c}">${l}</span>
        <span class="corpo"><div class="mitt">${m}</div><div class="ogg">${o}</div><div class="ant">${a}</div></span><span class="ora">${h}</span></div>`).join("")}
    </div>
    <span class="ol-fab">${ic("edit_24_regular")}</span>
    <div class="ol-schede"><span class="sel">${ic("mail_20_filled")}Messaggio di posta elettronica</span><span>${ic("calendar_ltr_20_regular")}Calendario</span><span>${ic("people_20_regular")}Persone</span></div>
    <div class="ol-pannello" id="ol-pannello">
      <div class="su">${logo(9.5)}<span class="esci">Esci</span></div>
      <div class="utente"><span class="grande">${D.iniziali}</span><span><div class="nome">${D.nome}</div><div class="mail">${D.account}</div>
        <a class="link" id="ol-link-account">Il mio account Microsoft</a></span></div>
      <div class="altro"><span class="cerchio">${ic("person_add_20_regular")}</span>Accedi con un altro account aziendale</div>
    </div>
  </section>`;

  // ---------- account.microsoft.com ----------
  const testaAccount = `<div class="ac-testa">${ic("grid_dots_20_regular", "waffle")}<span class="titolo">Account</span>${ic("question_20_regular", "aiuto")}<span class="av">${D.iniziali}</span></div>`;
  const vociMenu = [["home_20_regular", "Account"], ["person_20_regular", "Info personali"], ["receipt_20_regular", "Abbonamenti"], ["desktop_20_regular", "Dispositivi"],
    ["shield_20_regular", "Sicurezza"], ["lock_closed_20_regular", "Privacy"], ["cart_20_regular", "Cronologia ordini"], ["payment_20_regular", "Opzioni di pagamento"], ["location_20_regular", "Rubrica"]];
  const cassetto = (pref, attiva) => `<div class="ac-drawer" id="${pref}-drawer"><div class="su">${ic("navigation_20_regular")}</div>
    <div class="utente"><span class="av">${D.iniziali}</span><span><div class="nome">${D.nome}</div><div class="vant">Visualizza i miei vantaggi</div></span></div>
    ${vociMenu.map(([i, t]) => `<div class="voce${t === attiva ? " sel" : ""}" id="${pref}-voce-${t.split(" ")[0].toLowerCase()}">${ic(i)}<span>${t}</span></div>`).join("")}</div>`;
  const barraMenu = pref => `<div class="ac-menu"><span class="hamb" id="${pref}-hamb">${ic("navigation_20_regular")}</span></div>`;
  const feedback = `<div class="ac-feedback">${ic("person_feedback_20_regular")}Feedback</div>`;
  const chiave = `<svg width="210" height="120" viewBox="0 0 210 120"><circle cx="112" cy="60" r="56" fill="#eef1f5"/>
    <rect x="86" y="26" width="92" height="58" rx="6" fill="#cfe4fa" transform="rotate(-8 132 55)"/><circle cx="112" cy="52" r="12" fill="#fff"/><circle cx="112" cy="48" r="5.5" fill="#8a5a44"/>
    <path d="M101 63 q11 -11 22 0 z" fill="#c43e1c"/><rect x="131" y="43" width="33" height="5" rx="2" fill="#3b8ad9"/><rect x="131" y="54" width="26" height="5" rx="2" fill="#8fb8e6"/>
    <circle cx="60" cy="64" r="18" fill="#ffb900"/><circle cx="60" cy="64" r="7" fill="#eef1f5"/><rect x="74" y="60" width="48" height="8" rx="3" fill="#ffb900"/>
    <rect x="106" y="67" width="6" height="11" fill="#ffb900"/><rect x="92" y="67" width="6" height="8" fill="#ffb900"/></svg>`;

  P["pg-account"] = `<section class="pagina ac" id="pg-account"><div class="contenuto">${testaAccount}${barraMenu("acc")}
    <div class="ac-corpo"><h1 class="ac-h1">Account</h1>
      <div class="ac-rapidi"><div class="ac-rapido"><span class="cerchio">${ic("grid_20_regular")}</span><span class="t1">Ottieni Microsoft 365</span></div>
        <div class="ac-rapido"><span class="cerchio">${ic("key_20_regular")}</span><span class="t1">Cambia password</span></div></div>
      <div class="ac-card aperta"><div class="ac-card-testa">${ic("laptop_20_regular")}<span><div class="t1">Abbonamenti</div><div class="t2">Visualizza e gestisci i tuoi abbonamenti</div></span>${ic("chevron_up_20_regular", "freccia")}</div>
        <div class="ac-card-corpo"><div class="riga"><span class="logo365"><i></i><i></i><i></i><i></i></span><span><h3>Microsoft 365</h3>
          App per la produttività Premium, spazio di archiviazione nel cloud di OneDrive e altro ancora<br><span class="ac-btn">Ottieni Microsoft 365</span></span></div></div></div>
      <div class="ac-card"><div class="ac-card-testa">${ic("cloud_archive_20_regular")}<span><div class="t1">Archiviazione Microsoft</div><div class="t2">Questo include file, foto, allegati e altro ancora</div></span>${ic("chevron_up_20_regular", "freccia")}</div></div>
    </div></div>${feedback}${cassetto("acc", "Account")}</section>`;

  P["pg-sicurezza"] = `<section class="pagina ac" id="pg-sicurezza"><div class="contenuto">${testaAccount}${barraMenu("sic")}
    <div class="ac-corpo"><h1 class="ac-h1">Sicurezza</h1>
      <div class="ac-rapidi"><div class="ac-rapido" id="sic-rap-pwd"><span class="cerchio">${ic("key_20_regular")}</span><span><div class="t1">Cambia password</div><div class="t2">Ultimo aggiornamento: <span id="sic-data">${D.dataPrima}</span></div></span></div>
        <div class="ac-rapido"><span class="cerchio">${ic("square_multiple_20_regular")}</span><span><div class="t1">Prova Microsoft 365</div><div class="t2">Abbonamenti</div></span></div></div>
      <h2 class="ac-h1" style="font-size:18px;margin-top:22px">Microsoft ti aiuta a rimanere protetto online</h2>
      <p style="font-size:14.5px;line-height:1.5;margin-top:8px">La modalità di accesso, i dispositivi a cui hai effettuato l'accesso e i file salvati nel cloud sono tutti elementi importanti per la sicurezza online del tuo account.</p>
      <div class="ac-card aperta"><div class="ac-card-testa">${ic("person_key_20_regular")}<span><div class="t1">Sicurezza account</div><div class="t2">Impostazioni di accesso e recupero.</div></span>${ic("chevron_up_20_regular", "freccia")}</div>
        <div class="ac-card-corpo"><div class="illustrazione">${chiave}</div>Assicurati di essere sempre in grado di accedere al tuo account (e solo tu) con opzioni di sicurezza più avanzate, come la verifica in due passaggi e un indirizzo di posta elettronica di backup o un numero di telefono.
          <br><span class="ac-btn" id="sic-gestisci">Gestisci la modalità di accesso</span><a class="ac-link">Visualizza la mia attività di accesso</a></div></div>
      <div class="ac-card"><div class="ac-card-testa">${ic("cloud_archive_20_regular")}<span><div class="t1">Sicurezza e backup file</div><div class="t2">Esegui il backup dei file in OneDrive.</div></span>${ic("chevron_right_20_regular", "freccia")}</div></div>
      <div class="ac-card"><div class="ac-card-testa">${ic("phone_laptop_20_regular")}<span><div class="t1">Protezione dispositivo</div><div class="t2">Trova i tuoi dispositivi e rivedi i consigli.</div></span>${ic("chevron_right_20_regular", "freccia")}</div></div>
    </div></div>${feedback}</section>`;

  // ---------- account.live.com: metodi di accesso e cambio password ----------
  const testaLive = pref => `<div class="lv-testa">${ic("grid_dots_20_regular", "waffle")}<span class="titolo">Account Microsoft</span><span class="hamb" id="${pref}-hamb">${ic("navigation_20_regular")}</span><span class="av">${D.iniziali}</span></div>
    <div class="lv-tendina" id="${pref}-tendina">${["Le tue info", "Privacy", "Sicurezza", "Pagamento e fatturazione", "Sottoscrizioni", "Dispositivi"].map(v =>
      `<span${v === "Sicurezza" ? ` class="sel" id="${pref}-tendina-sicurezza"` : ""}>${v}</span>`).join("")}</div>`;
  const stato = `<span class="stato">${ic("checkmark_circle_20_filled")}Aggiornato</span>`;
  const rigaEmail = (id, indirizzo, data) => `<div class="lv-riga" id="${id}">
      <div class="lv-riga-testa">${ic("chevron_down_20_regular", "freccia")}${ic("mail_20_regular", "tipo")}<span class="testi">Invia un codice tramite e-mail<span class="ind">${indirizzo}</span></span>${stato}</div>
      <div class="lv-dettagli"><div class="dentro">
        <div class="kv"><span class="k">E-mail</span><span>${indirizzo}</span></div><div class="kv"><span class="k">Data di aggiunta</span><span>${data}</span></div>
        <div class="kv"><span class="k">Ricevi avvisi</span><span><i class="interruttore"></i>Attivato</span></div><div class="kv"><span class="k">Usato per</span><span>Verifica dell'account</span></div>
        <div class="azioni"><span class="lv-b">Visualizza attività</span><span class="lv-b" id="${id}-rimuovi">Rimuovi</span></div>
      </div></div></div>`;
  P["pg-metodi"] = `<section class="pagina lv" id="pg-metodi"><div class="contenuto">${testaLive("mt")}
    <div class="lv-corpo">
      <h2 class="lv-h2">Modi per dimostrare la tua identità</h2>
      <p class="lv-p">Consente di gestire le opzioni di verifica e accesso per l'account Microsoft. <a>Altre informazioni sull'accesso e sulla verifica.</a></p>
      <div class="lv-riga" id="mt-password"><div class="lv-riga-testa">${ic("chevron_down_20_regular", "freccia")}${ic("password_20_regular", "tipo")}<span class="testi">Immettere la password</span>${stato}</div></div>
      ${rigaEmail("mt-vecchia", D.vecchia, D.dataPrima)}
      ${rigaEmail("mt-nuova", D.nuova, D.dataDopo)}
      <a class="lv-aggiungi" id="mt-aggiungi">${ic("add_circle_20_regular")}<span>Aggiungere un altro modo per accedere all'account.</span></a>
    </div></div>
    <div class="lv-velo" id="mt-velo"></div>
    <div class="lv-dialogo" id="dlg-scelta">${ic("dismiss_20_regular", "chiudi")}<h2>Aggiungi una nuova modalità di accesso o verifica</h2>
      <div class="tessera" id="dlg-scelta-passkey">${ic("person_key_20_regular", "grande")}<span><b>Viso, impronta digitale, PIN o chiave di sicurezza</b>Usare il dispositivo per accedere con una passkey.</span>${ic("question_circle_20_regular", "aiuto")}</div>
      <div class="tessera">${ic("person_lock_20_filled", "grande")}<span><b>Usa un'app</b>Approva rapidamente le notifiche di accesso nel tuo telefono.</span></div>
      <div class="tessera" id="dlg-scelta-mail">${ic("mail_20_regular", "grande")}<span><b>Invia un codice tramite e-mail</b>Consente di ricevere un'e-mail e accedere con un codice.</span></div></div>
    <div class="lv-dialogo" id="dlg-mail">${ic("dismiss_20_regular", "chiudi")}<h2>Aggiungi un indirizzo e-mail</h2>
      <p>Immetti l'indirizzo e-mail a cui vuoi ricevere i codici di sicurezza.</p>
      <div class="lv-inp" id="dlg-mail-box">${campo("dlg-mail-campo", "nome@esempio.com")}</div>
      <div class="bottoni"><span class="lv-b">Annulla</span><span class="lv-b primario" id="dlg-mail-avanti">Avanti</span></div></div>
    <div class="lv-dialogo" id="dlg-codice">${ic("dismiss_20_regular", "chiudi")}<h2>Verifica l'indirizzo e-mail</h2>
      <p>Abbiamo inviato un codice a ${D.nuova}. Immettilo qui sotto per verificare l'indirizzo.</p>
      <div class="lv-inp" id="dlg-codice-box">${campo("dlg-codice-campo", "Codice")}</div>
      <div class="bottoni"><span class="lv-b">Annulla</span><span class="lv-b primario" id="dlg-codice-avanti">Verifica</span></div></div>
    <div class="lv-dialogo" id="dlg-rimuovi">${ic("dismiss_20_regular", "chiudi")}<h2>Rimuovere l'indirizzo e-mail?</h2>
      <p>Rimuovere l'indirizzo e-mail ${D.vecchia}? Se rimuovi questo indirizzo e-mail, non potrai usarlo per la verifica.</p>
      <div class="bottoni"><span class="lv-b">Annulla</span><span class="lv-b primario" id="dlg-rimuovi-ok">Rimuovi</span></div></div>
  </section>`;

  P["pg-cambia"] = `<section class="pagina lv" id="pg-cambia"><div class="contenuto">${testaLive("cp")}
    <div class="lv-corpo">
      <h1 class="cp-h1">Modifica la password</h1>
      <p class="cp-p">Una password complessa consente di impedire accessi non autorizzati al tuo account e-mail.</p>
      <div class="cp-et">Nuova password</div><div class="cp-campo" id="cp-nuova-box">${campo("cp-nuova", "Nuova password")}</div>
      <div class="cp-aiuto">Almeno 8 caratteri. La distinzione tra maiuscole e minuscole è rilevante</div>
      <div class="cp-et">Conferma la password</div><div class="cp-campo" id="cp-ripeti-box">${campo("cp-ripeti", "Conferma la password")}</div>
      <div class="cp-check"><span class="box"></span>La password deve essere cambiata ogni 72 giorni</div>
      <div class="cp-bottoni"><span class="b primario" id="cp-salva">Salva</span><span class="b">Annulla</span></div>
    </div></div></section>`;

  window.PAGINE = P;
})();
