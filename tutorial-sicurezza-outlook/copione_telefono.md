# Video tutorial: versione per telefono

**Circa 98 secondi** · formato verticale 1080×1920 (9:16) · iPhone con Safari · voce: Supertonic 3 (femminile) · musica: lo-fi originale

È la stessa procedura della versione da computer, eseguita dal browser del telefono. Le pagine sono
in versione mobile, ricalcate sugli screenshot fatti da iPhone. Ci sono la tastiera di iOS con i tasti
che si illuminano, la barra degli indirizzi di Safari, le notifiche di Mail con il codice e i tocchi del
dito al posto del mouse. Il testo della voce si modifica in [`piano_mobile.json`](piano_mobile.json).

Dati di esempio, tutti inventati: account `mario.rossi.esempio@outlook.it`, vecchia e-mail
`vecchia.mail@outlook.com`, nuova e-mail `nuova.mail@example.com`, codici `482917` e `730254`.

| # | Capitolo | Voce | Cosa si vede |
| --- | --- | --- | --- |
| — | Apertura | Vediamo come mettere in sicurezza il tuo account Outlook dal telefono: nuova e-mail di recupero e nuova password. | Cartello con il titolo, poi Safari con la pagina iniziale |
| 1/7 | Accesso | Apri il browser, vai su outlook.com e accedi con la tua e-mail e la tua password. | Tocco sulla barra degli indirizzi, si scrive `outlook.com`, poi «vai» → «Accedi» (e-mail, «Avanti») → «Immetti la password» → «Accedi» → posta in arrivo |
| 2/7 | Account | Tocca le tue iniziali in alto a destra e scegli «Il mio account Microsoft». | Tocco sulle iniziali, si apre il riquadro del profilo (zoom) → «Il mio account Microsoft» si apre in una nuova scheda |
| 3/7 | Sicurezza | Tocca il menu e scegli «Sicurezza». Poi, più in basso, tocca «Gestisci la modalità di accesso». | Menu ≡ → «Sicurezza» → scorrimento con il dito → «Gestisci la modalità di accesso» |
| 4/7 | Verifica identità | Microsoft vuole essere sicura che sia tu: scegli la tua e-mail di recupero e scrivila per intero. | «Ci siamo quasi» → «Invia un codice ve*****@outlook.com» → «Verifica l'indirizzo di posta elettronica» → «Invia il codice» |
| | | Poi inserisci il codice che ti arriva. | Notifica di Mail con il codice → «Immetti il codice» con il tastierino numerico (zoom) |
| 5/7 | Nuova e-mail | Ora tocca «Aggiungere un altro modo per accedere all'account», poi «Invia un codice tramite e-mail». | Finestra «Aggiungi una nuova modalità di accesso o verifica» (zoom) → «Invia un codice tramite e-mail» |
| | | Scrivi il nuovo indirizzo e confermalo con il codice che ricevi. | Nuovo indirizzo → «Avanti» → notifica con il codice → «Verifica» → la nuova e-mail compare nell'elenco (bordo verde) |
| 6/7 | Vecchia e-mail | Adesso apri la vecchia e-mail, tocca «Rimuovi» e conferma. Toglila solo dopo aver verificato quella nuova! | La riga si apre → «Rimuovi» → «Rimuovere l'indirizzo e-mail?» → «Rimuovi» |
| 7/7 | Password | Infine, dal menu torna su «Sicurezza», poi tocca «Cambia password». | Menu ≡ → «Sicurezza» → «Cambia password» |
| | | Digita due volte la nuova password: lunga, mai usata altrove. Poi tocca «Salva». | «Modifica la password»: due campi → «Fine» chiude la tastiera → «Salva» → «Ultimo aggiornamento» con la data di oggi (zoom) |
| — | Chiusura | Fatto! Il tuo account ora è più protetto. E ricorda: Microsoft non ti chiede mai la password via e-mail. | Riepilogo con le spunte verdi |

## Fedeltà delle schermate

Ricalcate sugli screenshot da iPhone: posta in arrivo di Outlook, riquadro del profilo, home di
account.microsoft.com con il menu laterale, «Ci siamo quasi», barra di Safari.

Adattate alla versione mobile a partire dagli screenshot da computer: «Verifica l'indirizzo di posta
elettronica», «Immetti il codice», «Sicurezza», «Modi per dimostrare la tua identità» con le finestre,
«Modifica la password».

Ricostruite senza un riferimento, nello stesso stile: le pagine di accesso (e-mail e password), la
finestra in cui si scrive la nuova e-mail e quella del suo codice.

## La voce

La voce è Supertonic 3, in italiano, più naturale di Kokoro. A volte però storpia qualche parola. Per
questo ogni frase viene generata fino a 6 volte e si tiene la lettura che Whisper trascrive identica al
testo. Alcune parole hanno un accento grafico che aiuta la pronuncia (per esempio
`{scegli|scégli}`). I tempi delle parole, che servono a sincronizzare tocchi e sottotitoli, si ricavano
allineando con il DTW la lettura di Supertonic a quella di Kokoro dello stesso testo
([`audio/allinea.py`](audio/allinea.py)).
