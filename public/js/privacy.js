// Informativa privacy: completa i dati dell'organizzatore dalle impostazioni.
import { api, applyBranding, setupHeader } from './common.js';

setupHeader();
api('/api/public')
  .then(({ settings }) => {
    applyBranding(settings);
    if (!settings.organization) {
      for (const el of document.querySelectorAll('main [data-bind="organization"]')) {
        el.textContent = `l'organizzatore della lotteria "${settings.title}"`;
      }
    }
  })
  .catch(() => {
    // senza dati restano i testi generici
  });
