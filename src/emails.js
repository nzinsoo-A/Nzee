// Testi delle email (HTML + testo semplice).

import { escapeHtml as e, firstName, formatDateTime, formatDrawDate, formatEuro, numbersLabel } from './format.js';
import { paymentInfo } from './store.js';

const COLORS = {
  pink: '#d23572',
  pinkDark: '#b5245f',
  pinkSoft: '#fff1f6',
  pinkLine: '#ffd3e3',
  ink: '#33212b',
  muted: '#7d6672',
};
const BLANK = Symbol('riga vuota');
const FONT = "'Nunito', 'Segoe UI', Helvetica, Arial, sans-serif";

export function orderUrl(origin, order) {
  return `${origin}/ordine?c=${encodeURIComponent(order.code)}&t=${encodeURIComponent(order.token)}`;
}

/**
 * kind: 'reservation' | 'confirmed' | 'cancelled' | 'admin_new' | 'test'
 * Restituisce { subject, html, text }.
 */
export function buildEmail(kind, { order, settings, origin, message = '', reason = '' }) {
  const builders = { reservation, confirmed, cancelled, admin_new: adminNew, test: testEmail };
  const build = builders[kind];
  if (!build) throw new Error(`Tipo di email sconosciuto: ${kind}`);
  return build({ order, settings, origin, message: message.trim(), reason: reason.trim() });
}

function reservation({ order, settings, origin }) {
  const pay = paymentInfo(order, settings);
  const label = numbersLabel(order.numbers);
  const link = orderUrl(origin, order);
  const subject = `🐾 Prenotazione ricevuta – ${label}`;

  const paymentHtml = pay.configured
    ? `<p style="margin:0 0 12px">Per completare l'acquisto effettua un <strong>bonifico bancario</strong> con questi dati:</p>
       ${detailsTable([
         ['Importo', `<strong>${e(formatEuro(pay.amountCents))}</strong>`],
         ['Intestatario', e(pay.beneficiary)],
         [
           'IBAN',
           `<span style="font-family:Consolas,Menlo,monospace;letter-spacing:.5px">${e(pay.ibanFormatted)}</span>`,
         ],
         pay.bankName && ['Banca', e(pay.bankName)],
         pay.bic && ['BIC/SWIFT', e(pay.bic)],
         ['Causale', `<strong>${e(pay.causale)}</strong>`],
       ])}
       ${pay.notes ? paragraph(e(pay.notes)) : ''}`
    : paragraph(
        `Ti invieremo a breve i dati per effettuare il pagamento di <strong>${e(formatEuro(pay.amountCents))}</strong>.`,
      );

  const html = layout({
    settings,
    origin,
    preheader: `Numeri riservati: ${order.numbers.join(', ')}. Ecco i dati per il bonifico.`,
    body: `
      ${paragraph(`Ciao ${e(firstName(order.name))},`)}
      ${paragraph(`grazie di cuore per il tuo sostegno! 💕 Abbiamo riservato per te ${order.numbers.length === 1 ? 'il numero' : 'i numeri'}:`)}
      ${numberChips(order.numbers)}
      ${paymentHtml}
      ${paragraph(
        `Appena verificheremo l'accredito riceverai un'email di conferma e ${order.numbers.length === 1 ? 'il numero sarà ufficialmente tuo' : 'i numeri saranno ufficialmente tuoi'}.`,
      )}
      ${button(link, 'Vedi il tuo ordine')}
      ${smallPrint(`Codice ordine: <strong>${e(order.code)}</strong> · Prenotato il ${e(formatDateTime(order.createdAt))}`)}
    `,
  });

  const text = lines(
    `Ciao ${firstName(order.name)},`,
    BLANK,
    `grazie di cuore per il tuo sostegno! Abbiamo riservato per te: ${order.numbers.join(', ')}.`,
    BLANK,
    pay.configured
      ? [
          "Per completare l'acquisto effettua un bonifico bancario:",
          `- Importo: ${formatEuro(pay.amountCents)}`,
          `- Intestatario: ${pay.beneficiary}`,
          `- IBAN: ${pay.ibanFormatted}`,
          pay.bankName && `- Banca: ${pay.bankName}`,
          pay.bic && `- BIC/SWIFT: ${pay.bic}`,
          `- Causale: ${pay.causale}`,
          pay.notes && `\n${pay.notes}`,
        ]
      : `Ti invieremo a breve i dati per il pagamento di ${formatEuro(pay.amountCents)}.`,
    BLANK,
    "Appena verificheremo l'accredito riceverai un'email di conferma.",
    `Il tuo ordine: ${link}`,
    BLANK,
    `Codice ordine: ${order.code}`,
    footerText(settings),
  );
  return { subject, html, text };
}

function confirmed({ order, settings, origin, message }) {
  const label = numbersLabel(order.numbers);
  const draw = drawInfo(settings);
  const subject = `✅ Pagamento ricevuto – ${label} ${order.numbers.length === 1 ? 'confermato' : 'confermati'}`;
  const html = layout({
    settings,
    origin,
    preheader: `Abbiamo ricevuto il tuo bonifico: i numeri ${order.numbers.join(', ')} sono tuoi!`,
    body: `
      ${paragraph(`Ciao ${e(firstName(order.name))},`)}
      ${paragraph(
        `abbiamo ricevuto il tuo bonifico: ${order.numbers.length === 1 ? 'il tuo numero è' : 'i tuoi numeri sono'} <strong>ufficialmente ${order.numbers.length === 1 ? 'confermato' : 'confermati'}</strong>! 🎉`,
      )}
      ${numberChips(order.numbers)}
      ${message ? quote(e(message)) : ''}
      ${draw ? paragraph(`L'estrazione si terrà <strong>${e(draw)}</strong>.`) : ''}
      ${paragraph('Grazie per aver dato una zampa a chi ne ha bisogno. In bocca al lupo! 🍀🐾')}
      ${button(orderUrl(origin, order), 'Vedi il tuo ordine')}
      ${smallPrint(`Codice ordine: <strong>${e(order.code)}</strong> · Importo: ${e(formatEuro(order.totalCents))}`)}
    `,
  });
  const text = lines(
    `Ciao ${firstName(order.name)},`,
    BLANK,
    `abbiamo ricevuto il tuo bonifico: i numeri ${order.numbers.join(', ')} sono ufficialmente confermati!`,
    message && `\n${message}`,
    draw && `\nL'estrazione si terrà ${draw}.`,
    BLANK,
    'Grazie per aver dato una zampa a chi ne ha bisogno. In bocca al lupo!',
    `Il tuo ordine: ${orderUrl(origin, order)}`,
    BLANK,
    `Codice ordine: ${order.code}`,
    footerText(settings),
  );
  return { subject, html, text };
}

function cancelled({ order, settings, origin, reason }) {
  const label = numbersLabel(order.numbers);
  const contact = settings.contactEmail;
  const subject = `Prenotazione annullata – ${label}`;
  const html = layout({
    settings,
    origin,
    preheader: `La prenotazione ${order.code} è stata annullata.`,
    body: `
      ${paragraph(`Ciao ${e(firstName(order.name))},`)}
      ${paragraph(
        `ti informiamo che la tua prenotazione <strong>${e(order.code)}</strong> è stata annullata e ${order.numbers.length === 1 ? 'il numero è tornato disponibile' : 'i numeri sono tornati disponibili'}:`,
      )}
      ${numberChips(order.numbers, true)}
      ${reason ? quote(`<strong>Motivo:</strong> ${e(reason)}`) : ''}
      ${paragraph(
        `Se hai già effettuato il bonifico o pensi si tratti di un errore, ${contact ? `scrivici a <a href="mailto:${e(contact)}" style="color:${COLORS.pinkDark}">${e(contact)}</a>` : 'rispondi a questa email'}: sistemeremo tutto al più presto.`,
      )}
      ${button(`${origin}/#numeri`, 'Scegli altri numeri')}
    `,
  });
  const text = lines(
    `Ciao ${firstName(order.name)},`,
    BLANK,
    `la tua prenotazione ${order.code} (${order.numbers.join(', ')}) è stata annullata e i numeri sono tornati disponibili.`,
    reason && `Motivo: ${reason}`,
    BLANK,
    `Se hai già effettuato il bonifico o pensi si tratti di un errore, ${contact ? `scrivici a ${contact}` : 'rispondi a questa email'}.`,
    `Scegli altri numeri: ${origin}/#numeri`,
    footerText(settings),
  );
  return { subject, html, text };
}

function adminNew({ order, settings, origin }) {
  const count = order.numbers.length;
  const subject = `🐾 Nuova prenotazione ${order.code} – ${count} ${count === 1 ? 'numero' : 'numeri'} (${formatEuro(order.totalCents)})`;
  const html = layout({
    settings,
    origin,
    preheader: `${order.name} ha prenotato ${order.numbers.join(', ')}`,
    body: `
      ${paragraph('È arrivata una nuova prenotazione in attesa di pagamento:')}
      ${numberChips(order.numbers)}
      ${detailsTable([
        ['Codice', `<strong>${e(order.code)}</strong>`],
        ['Nome', e(order.name)],
        ['Email', `<a href="mailto:${e(order.email)}" style="color:${COLORS.pinkDark}">${e(order.email)}</a>`],
        order.phone && ['Telefono', e(order.phone)],
        ['Importo', `<strong>${e(formatEuro(order.totalCents))}</strong>`],
        ['Causale attesa', e(paymentInfo(order, settings).causale)],
        order.note && ['Messaggio', e(order.note)],
        ['Data', e(formatDateTime(order.createdAt))],
      ])}
      ${paragraph("Quando ricevi il bonifico, conferma l'ordine dalla dashboard.")}
      ${button(`${origin}/admin`, 'Apri la dashboard')}
    `,
  });
  const text = lines(
    'Nuova prenotazione in attesa di pagamento:',
    `Codice: ${order.code}`,
    `Numeri: ${order.numbers.join(', ')}`,
    `Nome: ${order.name}`,
    `Email: ${order.email}`,
    order.phone && `Telefono: ${order.phone}`,
    `Importo: ${formatEuro(order.totalCents)}`,
    order.note && `Messaggio: ${order.note}`,
    BLANK,
    `Dashboard: ${origin}/admin`,
  );
  return { subject, html, text };
}

function testEmail({ settings, origin }) {
  const subject = '🐾 Email di prova';
  const html = layout({
    settings,
    origin,
    preheader: "L'invio delle email funziona!",
    body: `
      ${paragraph('Ciao! 👋')}
      ${paragraph(
        "Se stai leggendo questo messaggio, l'invio delle email del sito funziona correttamente. Chi prenota riceverà i dati per il bonifico e le conferme.",
      )}
      ${button(`${origin}/admin`, 'Torna alla dashboard')}
    `,
  });
  const text = lines(
    "Se stai leggendo questo messaggio, l'invio delle email del sito funziona correttamente.",
    `Dashboard: ${origin}/admin`,
  );
  return { subject, html, text };
}

// ------------------------------------------------------------------ mattoncini

function drawInfo(settings) {
  const date = formatDrawDate(settings.drawDate);
  if (date && settings.drawPlace) return `${date} – ${settings.drawPlace}`;
  return date || settings.drawPlace || '';
}

function paragraph(html) {
  return `<p style="margin:0 0 16px">${html}</p>`;
}

function smallPrint(html) {
  return `<p style="margin:20px 0 0;font-size:13px;color:${COLORS.muted}">${html}</p>`;
}

function quote(html) {
  return `<div style="margin:0 0 16px;padding:12px 16px;background:${COLORS.pinkSoft};border-left:4px solid ${COLORS.pink};border-radius:8px">${html.replace(/\n/g, '<br>')}</div>`;
}

function numberChips(numbers, muted = false) {
  const chip = (n) =>
    `<span style="display:inline-block;margin:0 6px 8px 0;padding:8px 14px;border-radius:999px;font-weight:700;font-size:18px;${
      muted
        ? `background:#f4eef1;color:${COLORS.muted};text-decoration:line-through`
        : `background:${COLORS.pink};color:#ffffff`
    }">${n}</span>`;
  return `<div style="margin:0 0 18px">${numbers.map(chip).join('')}</div>`;
}

function detailsTable(rows) {
  const body = rows
    .filter(Boolean)
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 12px 8px 0;color:${COLORS.muted};font-size:14px;white-space:nowrap;vertical-align:top">${label}</td><td style="padding:8px 0;font-size:15px;word-break:break-word">${value}</td></tr>`,
    )
    .join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 18px;padding:8px 16px;background:${COLORS.pinkSoft};border:1px solid ${COLORS.pinkLine};border-radius:14px;border-collapse:separate">${body}</table>`;
}

function button(href, label) {
  return `<p style="margin:24px 0 8px"><a href="${e(href)}" style="display:inline-block;padding:13px 26px;border-radius:999px;background:${COLORS.pink};color:#ffffff;font-weight:700;text-decoration:none">${e(label)} →</a></p>`;
}

function layout({ settings, origin, preheader, body }) {
  const title = e(settings.title);
  const footer = [
    settings.organization && e(settings.organization),
    settings.contactEmail &&
      `<a href="mailto:${e(settings.contactEmail)}" style="color:${COLORS.muted}">${e(settings.contactEmail)}</a>`,
  ]
    .filter(Boolean)
    .join(' · ');
  return `<!doctype html>
<html lang="it">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:0;background:${COLORS.pinkSoft}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${e(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.pinkSoft}">
<tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:22px;border:1px solid ${COLORS.pinkLine};overflow:hidden">
<tr><td style="padding:26px 30px;background:${COLORS.pink};color:#ffffff;font-family:${FONT}">
<img src="${e(origin)}/img/email-paw.png" width="34" height="34" alt="" style="display:block;border:0;outline:none">
<div style="font-size:22px;font-weight:800;margin-top:10px">${title}</div>
</td></tr>
<tr><td style="padding:30px;font-family:${FONT};font-size:16px;line-height:1.55;color:${COLORS.ink}">${body}</td></tr>
<tr><td style="padding:18px 30px;background:#fff8fb;border-top:1px solid ${COLORS.pinkLine};font-family:${FONT};font-size:13px;color:${COLORS.muted}">${footer || title}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function footerText(settings) {
  const parts = [settings.organization, settings.contactEmail].filter(Boolean);
  return `\n--\n${settings.title}${parts.length ? `\n${parts.join(' · ')}` : ''}`;
}

// Unisce le righe del testo semplice: i valori vuoti vengono saltati, BLANK lascia una riga vuota.
function lines(...items) {
  return items
    .flat()
    .filter(Boolean)
    .map((item) => (item === BLANK ? '' : item))
    .join('\n');
}
