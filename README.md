# 🐾 Lotteria Zampette

Sito per vendere i biglietti di una **lotteria di beneficenza**: chi partecipa sceglie uno o più numeri
(dal **801 al 900**, più gli eventuali altri numeri che aggiungete), conferma e vede subito i **dati per il
bonifico**. Gli organizzatori, da un'**area riservata**, confermano i pagamenti ricevuti oppure annullano le
prenotazioni e rimettono i numeri in vendita. A ogni passaggio parte un'email automatica.

Design minimale bianco e rosa, con tante zampette. Funziona bene da telefono e da computer.

---

## Cosa fa

**Per chi compra**

- Griglia dei numeri: liberi, prenotati, venduti. Si possono scegliere più numeri insieme (o farsi scegliere un
  "numero a caso").
- Scheda di conferma con nome, email, telefono (facoltativo) e consenso privacy.
- Pagina con i dati per il bonifico (importo, intestatario, IBAN, causale) e pulsanti "Copia".
- Email di riepilogo con gli stessi dati; poi email di conferma (o di annullamento).
- Se due persone scelgono lo stesso numero nello stesso istante, lo ottiene solo una: l'altra viene avvisata.

**Per gli organizzatori** (pagina `/admin`)

- Riepilogo: numeri venduti, in attesa, liberi, incassato e da incassare.
- **Ordini**, con ricerca: **Conferma pagamento** (i numeri risultano venduti, parte l'email di conferma) oppure
  **Annulla** (i numeri tornano in vendita, parte l'email con l'eventuale motivo).
- **Numeri**: la griglia (toccando un numero si vede chi l'ha preso) e **Aggiungi altre caselle: da … a …** per
  mettere in vendita nuovi numeri, anche non consecutivi (es. da 1001 a 1050). Un gruppo di numeri si può togliere
  finché nessuno dei suoi numeri è stato prenotato.
- **Impostazioni** modificabili senza toccare il codice: titolo, descrizione, premi, data e luogo dell'estrazione,
  prezzo, **offerta pacchetto** (es. 3 biglietti a 25 €, lo sconto si applica da solo), dati bancari, email di
  contatto, apertura/chiusura delle vendite.
- Esportazione in Excel (CSV) di tutti gli ordini, utile per l'estrazione.
- Email di prova, reinvio delle email, eliminazione degli ordini annullati (es. quelli di prova).

---

## Guida rapida per gli organizzatori

Apri l'indirizzo del sito aggiungendo `/admin` in fondo, scrivi la password e poi:

| Cosa vuoi fare                   | Dove                                                                               |
| -------------------------------- | ---------------------------------------------------------------------------------- |
| Cambiare il prezzo del biglietto | **Impostazioni** → Biglietti → _Prezzo di un biglietto_                            |
| Offerta, es. 3 biglietti a 25 €  | **Impostazioni** → Biglietti → accendi _Offerta pacchetto_ → scrivi **3** e **25** |
| Inserire l'IBAN                  | **Impostazioni** → Dati per il bonifico → _Intestatario del conto_ e _IBAN_        |
| Cambiare la data dell'estrazione | **Impostazioni** → La lotteria → _Data e ora dell'estrazione_ (e il luogo)         |
| Inserire i premi                 | **Impostazioni** → La lotteria → _Premi_, uno per riga                             |
| Aggiungere altri numeri          | **Numeri** → _Aggiungi altre caselle_ → Da … A … → **Aggiungi numeri**             |
| Confermare un bonifico arrivato  | **Ordini** → **Conferma pagamento**                                                |
| Rimettere in vendita dei numeri  | **Ordini** → **Annulla**                                                           |

Dopo ogni modifica nelle Impostazioni premi **Salva impostazioni** (in basso a destra): il sito si aggiorna subito.

---

## Mettere il sito online (gratis e sempre disponibile)

Il sito gira su **Cloudflare Workers**: piano gratuito, nessun server da gestire, nessuno "spegnimento" quando
non ci sono visite. Il database è incluso (non va creato a mano). Servono circa 15 minuti.

### 1. Porta il codice sul ramo principale di GitHub

Cloudflare pubblica il ramo principale (`main`) del repository, quindi il codice va prima unito lì:

1. Apri il repository **Nzee** su GitHub.
2. Se in alto compare il riquadro giallo con `claude/charity-lottery-ticket-site-w70ajq` premi
   **Compare & pull request**. Altrimenti: scheda **Pull requests** → **New pull request** → in "compare" scegli
   `claude/charity-lottery-ticket-site-w70ajq`.
3. Premi **Create pull request**, poi **Merge pull request** e **Confirm merge**.

### 2. Collega il repository a Cloudflare

1. Crea un account gratuito su [dash.cloudflare.com](https://dash.cloudflare.com).
2. Vai su **Workers & Pages** → **Create application** → **Import a repository** (Get started).
3. Collega il tuo account GitHub e scegli il repository **Nzee**.
4. Nella configurazione:
   - **Project name**: `lotteria-zampette` (deve essere esattamente questo, come nel file `wrangler.jsonc`);
   - **Deploy command**: `npx wrangler deploy` (è già il valore proposto).
5. Premi **Save and Deploy**. Dopo un paio di minuti il sito è online su un indirizzo del tipo
   `https://lotteria-zampette.<tuo-nome>.workers.dev` (lo trovi nella pagina del Worker, alla voce
   **Domains & Routes** o in alto accanto a **Visit**).

Da qui in poi, ogni modifica che arriva sul ramo `main` viene pubblicata automaticamente.

### 3. Imposta la password dell'area riservata

Nella pagina del Worker: **Settings** → **Variables and Secrets** → **Add**:

| Nome             | Tipo   | Valore                                                |
| ---------------- | ------ | ----------------------------------------------------- |
| `ADMIN_PASSWORD` | Secret | una password lunga (almeno 12 caratteri), solo vostra |

Salva con **Deploy**. Ora puoi entrare in `https://…workers.dev/admin`.

### 4. Prime impostazioni (dall'area riservata)

In **Impostazioni** inserisci almeno **intestatario e IBAN** (l'IBAN viene controllato, così un errore di
battitura non passa), l'**email di contatto**, i premi, la data dell'estrazione e il prezzo. Salva.
Se vuoi più numeri: scheda **Numeri** → **Aggiungi altre caselle** → da … a … → **Aggiungi numeri**.

### 5. (Facoltativo) Email automatiche

Vedi la sezione [Email automatiche](#email-automatiche) qui sotto: con Gmail bastano 5 valori da incollare.

### 6. Prove consigliate

1. Dal telefono apri il sito, scegli due numeri e prenota con **la tua email**.
2. Controlla la pagina con i dati del bonifico e (se le email sono attive) l'email di riepilogo.
3. Entra in `/admin`: l'ordine è **In attesa**. Premi **Conferma pagamento**: arriva l'email di conferma e sul sito
   i numeri diventano "venduti".
4. Prenota un altro numero e prova **Annulla**: il numero torna libero e arriva l'email di annullamento.
5. Prova **Numeri** → **Aggiungi altre caselle** e controlla che le nuove caselle compaiano sul sito.
6. Prova **Esporta Excel (CSV)**.
7. Finite le prove, annulla e poi **elimina** gli ordini di prova, così partite da zero.

### 7. (Facoltativo) Un indirizzo tutto vostro

Se avete un dominio gestito su Cloudflare: pagina del Worker → **Settings** → **Domains & Routes** → **Add** →
**Custom domain** (es. `lotteria.vostraassociazione.it`).

### Aggiornamenti futuri

Quando arrivano modifiche al sito (su un ramo `claude/…` del repository), basta ripetere il passo 1 (pull request
→ Merge): Cloudflare pubblica la nuova versione da solo in un paio di minuti, senza perdere ordini e impostazioni.

---

## Email automatiche

Senza configurazione il sito funziona lo stesso (i dati del bonifico compaiono sulla pagina), ma **non parte
nessuna email**. Per attivarle aggiungi questi valori in **Settings → Variables and Secrets** (tutti come
**Secret**), scegliendo **una** delle opzioni.

### Opzione A – Gmail (la più semplice)

1. Sull'account Google che userete come mittente attiva la **Verifica in due passaggi**.
2. Apri [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords), crea una password per
   l'app chiamata "Lotteria" e copia il codice di 16 lettere.
3. Aggiungi:

| Nome        | Valore                                          |
| ----------- | ----------------------------------------------- |
| `SMTP_HOST` | `smtp.gmail.com`                                |
| `SMTP_PORT` | `465`                                           |
| `SMTP_USER` | `vostroindirizzo@gmail.com`                     |
| `SMTP_PASS` | il codice di 16 lettere (senza spazi)           |
| `MAIL_FROM` | `Lotteria Zampette <vostroindirizzo@gmail.com>` |

Gmail permette circa 500 email al giorno: più che sufficienti.

### Opzione B – Brevo

Account gratuito su [brevo.com](https://www.brevo.com) (300 email al giorno), verifica l'indirizzo mittente,
crea una chiave API e aggiungi `BREVO_API_KEY` e `MAIL_FROM` (es. `Lotteria Zampette <info@vostraassociazione.it>`).

### Opzione C – Resend

Serve un dominio verificato su [resend.com](https://resend.com). Aggiungi `RESEND_API_KEY` e `MAIL_FROM`.

Infine, nell'area riservata → **Impostazioni** → **Invia email di prova**: se arriva (controlla anche lo spam),
è tutto pronto. Accanto a ogni ordine la dashboard mostra se le email sono partite.

**Quali email partono**

- a chi prenota: riepilogo con i dati del bonifico; conferma quando segnate il pagamento; avviso se annullate;
- agli organizzatori (all'email di contatto, se l'opzione è attiva): avviso di ogni nuova prenotazione.

---

## Domande frequenti

**Il sito è davvero sempre disponibile?** Sì: Cloudflare lo serve da centinaia di data center, senza tempi di
avvio. Il piano gratuito include 100.000 richieste al giorno, molto più di quanto serve a una lotteria di questo
tipo.

**Cosa succede se nessuno paga?** La prenotazione resta "in attesa" finché non la annullate voi: i numeri
tornano subito disponibili. Gli ordini in attesa da più di 3 giorni sono evidenziati nella dashboard.

**Posso aggiungere numeri o cambiare il prezzo a vendita iniziata?** Sì. I nuovi numeri si aggiungono dalla scheda
**Numeri** (fino a 1000 numeri in tutto); un gruppo si può togliere solo se nessuno dei suoi numeri è stato
prenotato. Gli ordini già fatti mantengono il prezzo del momento.

**Come chiudo le vendite?** Impostazioni → spegni **Vendite aperte**. Il sito resta visibile ma non accetta nuove
prenotazioni.

**Una nota importante.** In Italia le lotterie di beneficenza sono regolate dal D.P.R. 430/2001 (artt. 13-14):
possono organizzarle enti e associazioni senza scopo di lucro, con comunicazione preventiva a Prefettura e Comune.
Verificate questi adempimenti prima di aprire le vendite. Nella pagina `/privacy` c'è un'informativa di base da
completare con i dati dell'associazione.

---

## Per sviluppatori

```bash
npm install
cp .dev.vars.example .dev.vars   # imposta ADMIN_PASSWORD (e, se vuoi, le email)
npm run dev                      # http://localhost:8787  –  area riservata su /admin
```

- `src/worker.js` – API (Hono) e Durable Object `Raffle` con il database SQLite.
- `src/store.js` – logica dei dati: prenotazioni, conferme, annullamenti, gruppi di numeri, impostazioni, CSV.
- `src/emails.js`, `src/mailer.js` – testi delle email e invio (SMTP, Brevo, Resend).
- `public/` – le pagine: `index.html` (numeri), `ordine.html` (bonifico), `admin.html`, `privacy.html`.

Test:

```bash
npm test           # logica dei dati, email e API (avvia il sito in locale e un finto server email)
npm run test:e2e   # prova completa nel browser con Playwright; screenshot in test-results/
```

Per `test:e2e` serve Chromium per Playwright (`npx playwright install chromium`).
