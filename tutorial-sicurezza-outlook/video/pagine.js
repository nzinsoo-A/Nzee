// Contenuto delle pagine ricostruite. Tutti i dati personali sono di esempio.

window.DATI = {
  nome: "Mario Rossi",
  iniziali: "MR",
  account: "mario.rossi.esempio@outlook.it",
  vecchia: "vecchia.mail@outlook.com",
  vecchiaMascherata: "ve*****@outlook.com",
  nuova: "nuova.mail@example.com",
  nuovaMascherata: "nu*****@example.com",
  codice1: "482917",
  codice2: "730254",
  dataPrima: "14/03/2024",
  dataDopo: "21/10/2026",
};

(() => {
  const D = window.DATI;
  const ic = (nome, extra = "") => `<i class="ic ${extra}" data-ic="${nome}"></i>`;
  const logo = (testo = "Microsoft") => `<span class="ms-logo"><span class="q"><i></i><i></i><i></i><i></i></span>${testo}</span>`;
  const campo = (id, segnaposto = "") =>
    `<span class="campo" id="${id}"><span class="segnaposto">${segnaposto}</span><span class="valore"></span><span class="caret"></span></span>`;

  // Sfondo a onde delle pagine di accesso, ispirato a quello di login.live.com in tema scuro
  const stelle = Array.from({ length: 70 }, (_, i) => {
    const x = (i * 197.3) % 1371, y = (i * 83.7 + (i % 7) * 41) % 604, r = 0.5 + (i % 3) * 0.35;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="#fff" opacity="${0.12 + (i % 5) * 0.05}"/>`;
  }).join("");
  const sfondo = `<div class="ms-sfondo"><svg viewBox="0 0 1371 604" preserveAspectRatio="none">
    <defs>
      <linearGradient id="gA" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a3044"/><stop offset="1" stop-color="#1c2030"/></linearGradient>
      <linearGradient id="gB" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#303750"/><stop offset="1" stop-color="#1e2232"/></linearGradient>
      <linearGradient id="gC" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#262b3d"/><stop offset="1" stop-color="#191c27"/></linearGradient>
    </defs>
    <rect width="1371" height="604" fill="#181b26"/>
    <path d="M-40 140 C 260 40, 520 10, 760 -40 L 1420 -40 L 1420 60 C 1040 110, 760 220, 520 420 C 380 540, 300 600, 260 660 L -40 660 Z" fill="url(#gA)" opacity=".9"/>
    <path d="M840 -40 C 760 120, 700 260, 760 420 C 800 520, 900 600, 1000 660 L 1420 660 L 1420 260 C 1240 300, 1060 220, 980 80 C 950 30, 930 -10, 920 -40 Z" fill="url(#gB)" opacity=".75"/>
    <path d="M-40 420 C 120 360, 260 380, 360 470 C 420 530, 440 600, 450 660 L -40 660 Z" fill="url(#gC)" opacity=".95"/>
    <path d="M760 -40 C 700 160, 690 300, 770 440" stroke="#4a5274" stroke-width="1.4" fill="none" opacity=".55"/>
    <path d="M1420 230 C 1220 280, 1050 200, 975 60" stroke="#46507a" stroke-width="1.2" fill="none" opacity=".5"/>
    <path d="M-40 150 C 250 50, 520 15, 760 -35" stroke="#3d4566" stroke-width="1.2" fill="none" opacity=".5"/>
    ${stelle}
  </svg></div>`;
  const piede = `<div class="ms-piede"><div class="voci"><span>Guida</span><span>Condizioni per l'utilizzo</span><span>Privacy e cookie</span></div>
    <div class="nota">Usare l'esplorazione privata se questo non è il proprio dispositivo. <a>Altre informazioni</a></div></div>`;
  const schedaScura = (id, interno, indietro = true) => `<section class="pagina ms-scuro" id="${id}">${sfondo}
    <div class="ms-centro"><div class="ms-scheda">
      <div class="ms-testa">${indietro ? ic("arrow_left_20_regular", "ms-indietro") : ""}${logo()}</div>
      ${interno}
    </div></div>${piede}</section>`;

  const testaAccount = `<header class="ac-testa"><span class="ac-waffle">${ic("grid_dots_20_regular")}</span><span class="ac-titolo">Account Microsoft</span>
    <span class="ac-destra">${ic("question_20_regular")}<span class="ac-avatar">${D.iniziali}</span></span></header>`;
  const vociMenu = [
    ["home_20_regular", "Account"], ["person_20_regular", "Info personali"], ["receipt_20_regular", "Abbonamenti"],
    ["desktop_20_regular", "Dispositivi"], ["shield_20_regular", "Sicurezza"], ["lock_closed_20_regular", "Privacy"],
    ["cart_20_regular", "Cronologia ordini"], ["payment_20_regular", "Opzioni di pagamento"], ["location_20_regular", "Rubrica"],
  ];
  const latoAccount = (attiva, prefisso) => `<aside class="ac-lato">
    <div class="ac-utente"><span class="av">${D.iniziali}</span><span><div class="nome">${D.nome}</div><div class="vant">Visualizza i miei vantaggi</div></span></div>
    <nav class="ac-nav">${vociMenu.map(([i, t]) =>
      `<div class="voce${t === attiva ? " sel" : ""}" id="${prefisso}-nav-${t.split(" ")[0].toLowerCase()}">${ic(i)}<span>${t}</span></div>`).join("")}</nav></aside>`;
  const feedback = `<div class="ac-feedback">${ic("person_feedback_20_regular")}Feedback</div>`;

  // Illustrazioni semplificate (al posto delle immagini Microsoft)
  const illustrazione365 = `<svg width="300" height="132" viewBox="0 0 300 132"><rect width="300" height="132" rx="6" fill="#dfeefe"/>
    <rect x="70" y="22" width="54" height="54" rx="12" fill="#5b5fc7" transform="rotate(-12 97 49)"/>
    <rect x="140" y="44" width="64" height="64" rx="12" fill="#185abd" transform="rotate(10 172 76)"/>
    <rect x="214" y="12" width="46" height="46" rx="11" fill="#c43e1c" transform="rotate(14 237 35)"/>
    <rect x="96" y="88" width="36" height="36" rx="9" fill="#7719aa" transform="rotate(-8 114 106)"/>
    <path d="M232 76 l26 6 l-8 30 z" fill="#2c8ef2"/></svg>`;
  const illustrazioneDispositivi = `<svg width="170" height="130" viewBox="0 0 170 130"><circle cx="85" cy="68" r="62" fill="#eef1f5"/>
    <rect x="26" y="28" width="96" height="64" rx="5" fill="#fff" stroke="#c8ccd2" stroke-width="3"/><circle cx="72" cy="60" r="14" fill="#3b8ad9"/>
    <rect x="62" y="96" width="24" height="8" fill="#c8ccd2"/><rect x="116" y="52" width="32" height="54" rx="5" fill="#fff" stroke="#3b8ad9" stroke-width="3"/>
    <rect x="124" y="72" width="16" height="12" rx="3" fill="#ffb900"/></svg>`;
  const illustrazioneSicurezza = `<svg width="180" height="130" viewBox="0 0 180 130"><circle cx="100" cy="66" r="62" fill="#eef1f5"/>
    <rect x="70" y="30" width="96" height="62" rx="6" fill="#cfe4fa" transform="rotate(-8 118 61)"/>
    <circle cx="98" cy="58" r="13" fill="#fff"/><circle cx="98" cy="54" r="6" fill="#8a5a44"/><path d="M86 70 q12 -12 24 0 z" fill="#c43e1c"/>
    <rect x="118" y="48" width="36" height="5" rx="2" fill="#3b8ad9"/><rect x="118" y="60" width="28" height="5" rx="2" fill="#8fb8e6"/>
    <circle cx="44" cy="70" r="20" fill="#ffb900"/><circle cx="44" cy="70" r="8" fill="#eef1f5"/><rect x="60" y="66" width="52" height="9" rx="3" fill="#ffb900"/>
    <rect x="96" y="74" width="7" height="12" fill="#ffb900"/><rect x="80" y="74" width="7" height="9" fill="#ffb900"/>
    <rect x="70" y="96" width="70" height="8" rx="3" fill="#d6dbe1"/></svg>`;

  const rapidi = (primo, secondo) => `<div class="ac-rapidi">${primo}${secondo}</div>`;
  const rapido = (id, icona, t1, t2) => `<div class="rap" id="${id}"><span class="cerchio">${ic(icona)}</span><span><div class="t1">${t1}</div><div class="t2">${t2}</div></span></div>`;

  const P = {};

  P["pg-nuova"] = `<section class="pagina" id="pg-nuova"><div class="nt-cerca">${ic("search_20_regular")}Cerca nel Web</div></section>`;

  P["pg-accedi"] = schedaScura("pg-accedi", `
      <h1 style="margin-top:22px">Accedi</h1>
      <p class="ms-sotto">per continuare in Outlook</p>
      <div class="ms-campo" id="acc-campo-box"><span class="etichetta">Posta elettronica o numero di telefono</span>${campo("acc-campo")}</div>
      <a class="ms-link ms-sinistra" style="font-size:14px;margin-top:16px">Non hai un account? Creane uno!</a>
      <div class="ms-pulsante" id="acc-avanti">Avanti</div>`, false);

  P["pg-password"] = schedaScura("pg-password", `
      <div class="ms-pillola">${D.account}</div>
      <h1>Immetti la password</h1>
      <div class="ms-campo" id="pwd-campo-box"><span class="etichetta">Password</span>${campo("pwd-campo")}</div>
      <a class="ms-link ms-sinistra" style="font-size:14px;margin-top:16px">Password dimenticata?</a>
      <div class="ms-pulsante" id="pwd-avanti">Avanti</div>`);

  P["pg-quasi"] = schedaScura("pg-quasi", `
      <div class="ms-pillola">${D.account}</div>
      <h1>Ci siamo quasi</h1>
      <p class="ms-sotto">Solo un altro passaggio per verificare l'identità.</p>
      <div class="ms-opzione" id="quasi-opzione">${ic("mail_20_regular")}<span>Invia un codice ${D.vecchiaMascherata}</span></div>
      <a class="ms-link">È già disponibile un codice?</a>
      <a class="ms-link">Non si riconosce o non si dispone di nessuna di queste prove?</a>`, false);

  P["pg-verifica"] = schedaScura("pg-verifica", `
      <div class="ms-pillola">${D.account}</div>
      <h1>Verifica l'indirizzo di posta elettronica</h1>
      <p class="ms-sotto">Verrà inviato un codice di verifica a <b>${D.vecchiaMascherata}</b>. Per confermare l'indirizzo di posta elettronica corretto, immetterlo qui.</p>
      <div class="ms-campo" id="ver-campo-box"><span class="etichetta">Posta elettronica</span>${campo("ver-campo")}</div>
      <div class="ms-pulsante" id="ver-invia">Invia il codice</div>
      <a class="ms-link">Hai già ricevuto un codice?</a>`);

  P["pg-codice"] = schedaScura("pg-codice", `
      <div class="ms-pillola">${D.account}</div>
      <h1>Immetti il codice</h1>
      <p class="ms-sotto">Immetti il codice inviato a <b>${D.vecchiaMascherata}</b>.</p>
      <div class="ms-codici" id="cod-cifre">${Array.from({ length: 6 }, (_, i) => `<span class="cifra" id="cod-${i}"></span>`).join("")}</div>
      <a class="ms-link">Non hai ricevuto il codice? Invialo di nuovo</a>`);

  P["pg-outlook"] = `<section class="pagina" id="pg-outlook">
    <header class="ol-testa"><span class="ol-waffle">${ic("grid_dots_20_regular")}</span><span class="ol-nome">Outlook</span>
      <span class="ol-cerca">${ic("search_20_regular")}Cerca</span>
      <span class="ol-destra"><span class="ol-acquista">${ic("diamond_20_regular")}Acquista Microsoft 365</span>
        <span class="ol-tasto">${ic("alert_20_regular")}</span><span class="ol-tasto">${ic("more_horizontal_20_regular")}</span>
        <span class="ol-avatar-box" id="ol-avatar"><span class="ol-avatar">${D.iniziali}</span></span></span></header>
    <div class="ol-corpo">
      <nav class="ol-app">
        <span class="app sel">${ic("mail_20_filled")}</span><span class="app">${ic("calendar_ltr_20_regular")}</span><span class="app">${ic("people_20_regular")}</span>
        <span class="app">${ic("checkmark_20_regular")}</span><span class="app"><span class="tile" style="background:#185abd">W</span></span>
        <span class="app"><span class="tile" style="background:#107c41">X</span></span><span class="app"><span class="tile" style="background:#c43e1c">P</span></span>
        <span class="app">${ic("apps_20_regular")}</span></nav>
      <div class="ol-main">
        <div class="ol-schede">${ic("navigation_20_regular")}<span>File</span><span class="sel">Home</span><span>Visualizza</span><span>Guida</span></div>
        <div class="ol-comandi">
          <span class="ol-nuovo">${ic("compose_20_regular")}Nuovo messaggio<span class="sep"></span>${ic("chevron_down_12_regular")}</span>
          <span class="cmd">${ic("delete_20_regular")}Elimina${ic("chevron_down_12_regular", "ch")}</span>
          <span class="cmd" style="--c:#107c10">${ic("archive_20_regular")}Archivia</span>
          <span class="cmd">${ic("shield_error_20_regular")}Segnala${ic("chevron_down_12_regular", "ch")}</span>
          <span class="cmd">${ic("folder_arrow_right_20_regular")}Sposta in${ic("chevron_down_12_regular", "ch")}</span>
          <span class="cmd">${ic("arrow_reply_all_20_regular")}Rispondi a tutti${ic("chevron_down_12_regular", "ch")}</span>
          <span class="cmd">${ic("mail_read_20_regular")}Già letto/Da leggere</span>
          <span class="cmd">${ic("flag_20_regular")}${ic("chevron_down_12_regular", "ch")}</span>
          <span class="cmd">${ic("more_horizontal_20_regular")}</span>
        </div>
        <div class="ol-colonne">
          <div class="ol-cartelle">
            <div class="sez">${ic("chevron_down_16_regular")}Preferiti</div>
            <div class="cart">${ic("mail_inbox_20_regular")}Posta in arrivo<span class="n">2</span></div>
            <div class="cart">${ic("send_20_regular")}Posta inviata</div>
            <div class="cart">${ic("drafts_20_regular")}Bozze</div>
            <div class="sez">${ic("chevron_down_16_regular")}<span>${D.account}</span></div>
            <div class="cart sel">${ic("mail_inbox_20_regular")}Posta in arrivo<span class="n">2</span></div>
            <div class="cart">${ic("mail_prohibited_20_regular")}Posta indesiderata</div>
            <div class="cart">${ic("drafts_20_regular")}Bozze</div>
            <div class="cart">${ic("send_20_regular")}Posta inviata</div>
            <div class="cart">${ic("delete_20_regular")}Posta eliminata</div>
            <div class="cart">${ic("archive_20_regular")}Archivio</div>
          </div>
          <div class="ol-lista">
            <div class="ol-lista-testa"><span class="sel">Evidenziata</span><span>Altra</span>
              <span class="icone">${ic("multiselect_ltr_20_regular")}${ic("filter_20_regular")}${ic("arrow_sort_20_regular")}</span></div>
            <div class="ol-msg nuovo sel"><div class="mitt">Account Microsoft</div><div class="ogg">Il tuo codice monouso</div><div class="ant">Usa questo codice per completare l'accesso al tuo account…</div><span class="ora">09:41</span></div>
            <div class="ol-msg nuovo"><div class="mitt">Giulia Bianchi</div><div class="ogg">Foto della gita</div><div class="ant">Ciao Mario, ti mando le foto di domenica, sono venute…</div><span class="ora">08:15</span></div>
            <div class="ol-msg"><div class="mitt">Luca Verdi</div><div class="ogg">Riunione di giovedì</div><div class="ant">Confermo l'appuntamento alle 10, porto io i documenti…</div><span class="ora">ieri</span></div>
            <div class="ol-msg"><div class="mitt">Biblioteca civica</div><div class="ogg">Promemoria di restituzione</div><div class="ant">Il prestito scade tra tre giorni. Puoi rinnovarlo online…</div><span class="ora">lun</span></div>
            <div class="ol-msg"><div class="mitt">Palestra Centro</div><div class="ogg">Nuovi orari dei corsi</div><div class="ant">Da novembre cambiano gli orari del corso serale…</div><span class="ora">dom</span></div>
            <div class="ol-msg"><div class="mitt">Anna Neri</div><div class="ogg">Ricetta della torta</div><div class="ant">Come promesso, ecco la ricetta della nonna…</div><span class="ora">sab</span></div>
          </div>
          <div class="ol-lettura"><div class="ol-oggetto">Il tuo codice monouso</div>
            <div class="ol-corpo-msg">Ciao,<br>usa questo codice per completare l'accesso al tuo account Microsoft.<div class="grande">519 204</div>Se non hai richiesto il codice, puoi ignorare questo messaggio.<br><br>Grazie,<br>Il team dell'account Microsoft</div></div>
        </div>
      </div>
    </div>
    <div class="ol-flyout" id="ol-flyout">
      <div class="fl-top">${logo()}<span class="fl-esci">Disconnetti</span></div>
      <div class="fl-utente"><span class="fl-avatar">${D.iniziali}</span><span><div class="fl-nome">${D.nome}</div><div class="fl-mail">${D.account}</div>
        <a class="fl-link" id="fl-account">Il mio account Microsoft</a></span></div>
      <div class="fl-altro"><span class="cerchio">${ic("add_16_regular")}</span>Accedi con un altro account</div>
    </div></section>`;

  P["pg-account"] = `<section class="pagina ac" id="pg-account">${testaAccount}<div class="ac-corpo">${latoAccount("Account", "acc")}
    <main class="ac-main"><h1 class="ac-h1">Account</h1>
      ${rapidi(rapido("acc-rap-365", "grid_20_regular", "Ottieni Microsoft 365", "Sottoscrizioni"), rapido("acc-rap-pwd", "key_20_regular", "Cambia password", "Sicurezza"))}
      <div class="ac-card aperta" style="margin-top:34px"><div class="ac-card-testa">${ic("laptop_20_regular")}<span><div class="t1">Microsoft 365</div>
        <div class="t2">Versioni desktop delle app di Microsoft 365, esperienze basate su intelligenza artificiale, archiviazione cloud e altro ancora</div></span>${ic("chevron_up_20_regular", "freccia")}</div>
        <div class="ac-card-corpo"><div class="testo"><h3>Ottieni i risultati straordinari</h3><p>Esegui subito l'aggiornamento per ottenere spazio di archiviazione cloud aggiuntivo, sicurezza avanzata e funzionalità basate sull'intelligenza artificiale, progettate per semplificarti la giornata, tutto in un unico piano.</p>
        <span class="ac-btn">Ottieni Microsoft 365</span></div>${illustrazione365}</div></div>
      <div class="ac-card aperta"><div class="ac-card-testa">${ic("desktop_20_regular")}<span><div class="t1">Dispositivi</div><div class="t2">Trovare, ripristinare e gestire i dispositivi</div></span>${ic("chevron_up_20_regular", "freccia")}</div>
        <div class="ac-card-corpo"><div class="testo"><h3>I dispositivi non vengono visualizzati</h3><p>Registra il tuo Surface, XBOX o di un accessorio correlato per visualizzare lo stato della garanzia e creare un ordine di servizio.</p>
        <span class="ac-btn">Aggiungi dispositivo</span></div>${illustrazioneDispositivi}</div></div>
    </main></div>${feedback}</section>`;

  P["pg-sicurezza"] = `<section class="pagina ac" id="pg-sicurezza">${testaAccount}<div class="ac-corpo">${latoAccount("Sicurezza", "sic")}
    <main class="ac-main"><h1 class="ac-h1">Sicurezza</h1>
      ${rapidi(rapido("sic-rap-pwd", "key_20_regular", "Cambia password", `Ultimo aggiornamento:<br><span id="sic-data">${D.dataPrima}</span>`), rapido("sic-rap-365", "square_multiple_20_regular", "Prova Microsoft 365", "Abbonamenti"))}
      <h2 class="ac-h2">Microsoft ti aiuta a rimanere protetto online</h2>
      <p class="ac-p">La modalità di accesso, i dispositivi a cui hai effettuato l'accesso e i file salvati nel cloud sono tutti elementi importanti per la sicurezza online del tuo account.</p>
      <div class="ac-card aperta"><div class="ac-card-testa">${ic("person_key_20_regular")}<span><div class="t1">Sicurezza account</div><div class="t2">Impostazioni di accesso e recupero.</div></span>${ic("chevron_up_20_regular", "freccia")}</div>
        <div class="ac-card-corpo" style="padding-top:26px;padding-bottom:28px"><div class="testo"><p>Assicurati di essere sempre in grado di accedere al tuo account (e solo tu) con opzioni di sicurezza più avanzate, come la verifica in due passaggi e un indirizzo di posta elettronica di backup o un numero di telefono.</p>
        <span class="ac-btn" id="sic-gestisci">Gestisci la modalità di accesso</span><a class="ac-link">Visualizza la mia attività di accesso</a></div>${illustrazioneSicurezza}</div></div>
      <div class="ac-card"><div class="ac-card-testa">${ic("cloud_archive_20_regular")}<span><div class="t1">Sicurezza e backup file</div><div class="t2">Esegui il backup dei file in OneDrive e nel Vault personale per mantenerli sicuri e accessibili.</div></span>${ic("chevron_right_20_regular", "freccia")}</div></div>
      <div class="ac-card"><div class="ac-card-testa">${ic("phone_laptop_20_regular")}<span><div class="t1">Protezione dispositivo</div><div class="t2">Visualizza un elenco di tutti i tuoi dispositivi, trova la relativa posizione e rivedi i consigli sulla sicurezza.</div></span>${ic("chevron_right_20_regular", "freccia")}</div></div>
    </main></div>${feedback}</section>`;

  P["pg-metodi"] = `<section class="pagina ac" id="pg-metodi">${testaAccount}<div class="ac-corpo">
    <main class="mt-main"><a class="mt-indietro">${ic("arrow_left_20_regular")}Sicurezza</a>
      <h1 class="mt-h1">Opzioni di sicurezza avanzate</h1>
      <h2 class="mt-h2">Modi per dimostrare la propria identità</h2>
      <p class="mt-p">Aggiungi o rimuovi i modi che usi per accedere al tuo account o per verificare la tua identità.</p>
      <div class="mt-griglia" id="mt-griglia">
        <div class="mt-voce" id="mt-password"><div class="riga">${ic("password_20_regular")}<span><div class="t1">Password</div><div class="t2">Ultimo aggiornamento: <span class="mt-data">${D.dataPrima}</span></div></span></div></div>
        <div class="mt-voce" id="mt-vecchia"><div class="riga">${ic("mail_20_regular")}<span><div class="t1">Invia un codice tramite e-mail</div><div class="t2">${D.vecchiaMascherata}</div></span>${ic("chevron_down_16_regular", "freccia")}</div>
          <div class="dettagli"><div class="dentro"><a class="rimuovi" id="mt-rimuovi">Rimuovi</a></div></div></div>
        <div class="mt-voce" id="mt-nuova"><div class="riga">${ic("mail_20_regular")}<span><div class="t1">Invia un codice tramite e-mail</div><div class="t2">${D.nuovaMascherata}</div></span>${ic("chevron_down_16_regular", "freccia")}</div></div>
        <div class="mt-aggiungi" id="mt-aggiungi">${ic("add_20_regular")}<span>Aggiungi un nuovo modo per accedere o verificare</span></div>
      </div>
      <h2 class="mt-h2">Sicurezza aggiuntiva</h2>
      <div class="mt-extra"><div class="box"><div class="t1">Verifica in due passaggi</div><div class="t2">Disattivata</div><a>Attiva</a></div>
        <div class="box"><div class="t1">Account senza password</div><div class="t2">Disattivato</div><a>Attiva</a></div></div>
    </main></div>
    <div class="dialogo-velo" id="mt-velo"></div>
    <div class="dialogo" id="dlg-scelta">${ic("dismiss_20_regular", "chiudi")}<h2>Aggiungi un nuovo modo per accedere o verificare</h2>
      <div class="scelte"><div class="scelta">${ic("phone_20_regular")}Usa un'app</div>
        <div class="scelta">${ic("fingerprint_20_regular")}Usa il viso, l'impronta digitale, il PIN o una chiave di sicurezza</div>
        <div class="scelta" id="dlg-scelta-mail">${ic("mail_20_regular")}Invia un codice tramite e-mail</div></div></div>
    <div class="dialogo" id="dlg-mail">${ic("dismiss_20_regular", "chiudi")}<h2>Aggiungi un indirizzo e-mail</h2>
      <p>Ti invieremo un codice di sicurezza a questo indirizzo per verificare che sia tuo.</p>
      <div class="inp" id="dlg-mail-box">${campo("dlg-mail-campo", "nome@esempio.com")}</div>
      <div class="bottoni"><span class="b">Annulla</span><span class="b primario" id="dlg-mail-avanti">Avanti</span></div></div>
    <div class="dialogo" id="dlg-codice">${ic("dismiss_20_regular", "chiudi")}<h2>Immetti il codice</h2>
      <p>Se ${D.nuovaMascherata} corrisponde all'indirizzo e-mail del tuo account, ti invieremo un codice.</p>
      <div class="inp" id="dlg-codice-box">${campo("dlg-codice-campo", "Codice")}</div>
      <div class="bottoni"><span class="b">Annulla</span><span class="b primario" id="dlg-codice-avanti">Avanti</span></div></div>
    <div class="dialogo" id="dlg-rimuovi">${ic("dismiss_20_regular", "chiudi")}<h2>Rimuovere questo metodo?</h2>
      <p>Non potrai più usare <b>${D.vecchiaMascherata}</b> per accedere al tuo account o per verificare la tua identità.</p>
      <div class="bottoni"><span class="b">Annulla</span><span class="b primario" id="dlg-rimuovi-ok">Rimuovi</span></div></div>
  </section>`;

  P["pg-cambia"] = `<section class="pagina cp" id="pg-cambia"><div class="cp-testa">${logo()}</div>
    <main class="cp-main"><h1 class="cp-h1">Cambia password</h1>
      <p class="cp-p">Una password complessa contribuisce a impedire l'accesso non autorizzato al tuo account di posta elettronica.</p>
      <div class="cp-campo-et">Password corrente</div><div class="cp-campo" id="cp-attuale-box">${campo("cp-attuale")}</div>
      <div class="cp-campo-et">Nuova password</div><div class="cp-campo" id="cp-nuova-box">${campo("cp-nuova")}</div>
      <div class="cp-aiuto">Almeno 8 caratteri, con distinzione tra maiuscole e minuscole.</div>
      <div class="cp-campo-et">Immetti di nuovo la password</div><div class="cp-campo" id="cp-ripeti-box">${campo("cp-ripeti")}</div>
      <div class="cp-check"><span class="box"></span>Chiedimi di modificare la password ogni 72 giorni</div>
      <div class="cp-bottoni"><span class="b primario" id="cp-salva">Salva</span><span class="b">Annulla</span></div>
    </main></section>`;

  window.PAGINE = P;
})();
