// Cattura i fotogrammi del video con Chromium (Playwright).
//
//   node video/render.mjs --anteprima 12.5,30,47.2   → PNG di singoli istanti in build/anteprime/
//   node video/render.mjs --video [--fps 30] [--processi 4] → tutti i fotogrammi + build/video_muto.mp4

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require("playwright");
} catch {
  playwright = require(path.join(process.env.PLAYWRIGHT_GLOBAL || "/opt/node22/lib/node_modules", "playwright"));
}

const RADICE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (nome, predefinito) => {
  const i = process.argv.indexOf(nome);
  return i >= 0 ? process.argv[i + 1] : predefinito;
};
// --sorgente video (16:9, computer) oppure --sorgente mobile (9:16, telefono)
const QUI = path.join(RADICE, arg("--sorgente", "video"));
const BUILD = path.resolve(RADICE, arg("--build", "build"));
const [LARGH, ALT] = arg("--formato", "1920x1080").split("x").map(Number);
const timeline = JSON.parse(fs.readFileSync(path.join(BUILD, "timeline.json"), "utf8"));

async function apriPagina(browser) {
  const pagina = await browser.newPage({ viewport: { width: LARGH, height: ALT }, deviceScaleFactor: 1 });
  const errori = [];
  pagina.on("pageerror", e => errori.push(e.message));
  pagina.on("console", m => { if (m.type() === "error") errori.push(m.text()); });
  await pagina.goto(pathToFileURL(path.join(QUI, "index.html")).href);
  const info = await pagina.evaluate(tl => window.avvia(tl), timeline);
  if (errori.length) throw new Error("Errori nella pagina:\n" + errori.join("\n"));
  return { pagina, info };
}

// Cattura diretta via CDP: con optimizeForSpeed Chromium comprime il PNG molto più in fretta
const sessioni = new WeakMap();
const fotogramma = async (pagina, t, file) => {
  await pagina.evaluate(t => window.renderAt(t), t);
  if (!sessioni.has(pagina)) sessioni.set(pagina, await pagina.context().newCDPSession(pagina));
  const { data } = await sessioni.get(pagina).send("Page.captureScreenshot", { format: "png", optimizeForSpeed: true });
  fs.writeFileSync(file, Buffer.from(data, "base64"));
};

const browser = await playwright.chromium.launch();
try {
  if (process.argv.includes("--anteprima")) {
    const istanti = arg("--anteprima").split(",").map(Number);
    const cartella = path.join(BUILD, "anteprime");
    fs.mkdirSync(cartella, { recursive: true });
    const { pagina, info } = await apriPagina(browser);
    for (const t of istanti) {
      const file = path.join(cartella, `t_${t.toFixed(2).padStart(6, "0")}.png`);
      await fotogramma(pagina, t, file);
      console.log(file);
    }
    fs.writeFileSync(path.join(BUILD, "effetti.json"), JSON.stringify({ clic: info.clic, notifiche: info.notifiche, tasti: info.tasti }));
    console.log(`durata ${info.durata}s, ${info.clic.length} clic`);
  } else if (process.argv.includes("--video")) {
    const fps = Number(arg("--fps", 30));
    const processi = Number(arg("--processi", 4));
    const cartella = path.join(BUILD, "fotogrammi");
    fs.rmSync(cartella, { recursive: true, force: true });
    fs.mkdirSync(cartella, { recursive: true });
    const aperte = await Promise.all(Array.from({ length: processi }, () => apriPagina(browser)));
    const { durata, clic, notifiche, tasti } = aperte[0].info;
    fs.writeFileSync(path.join(BUILD, "effetti.json"), JSON.stringify({ clic, notifiche, tasti }));
    const totale = Math.ceil(durata * fps);
    let prossimo = 0, fatti = 0;
    const inizio = Date.now();
    await Promise.all(aperte.map(async ({ pagina }) => {
      while (prossimo < totale) {
        const n = prossimo++;
        await fotogramma(pagina, n / fps, path.join(cartella, `${String(n).padStart(5, "0")}.png`));
        if (++fatti % 300 === 0) console.log(`${fatti}/${totale} fotogrammi (${((Date.now() - inizio) / 1000).toFixed(0)}s)`);
      }
    }));
    console.log(`${totale} fotogrammi in ${((Date.now() - inizio) / 1000).toFixed(0)}s, codifico…`);
    const ff = spawnSync("ffmpeg", [
      "-y", "-loglevel", "error", "-framerate", String(fps), "-i", path.join(cartella, "%05d.png"),
      "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
      path.join(BUILD, "video_muto.mp4"),
    ], { stdio: "inherit" });
    if (ff.status !== 0) throw new Error("ffmpeg non è riuscito a codificare il video");
    console.log(path.join(BUILD, "video_muto.mp4"));
  } else {
    console.log("Usa --anteprima t1,t2,… oppure --video");
  }
} finally {
  await browser.close();
}
