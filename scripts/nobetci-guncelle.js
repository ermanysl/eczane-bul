// Nöbetçi eczaneleri CollectAPI'den çekip www/nobetci/<il>.json olarak yazar.
// GitHub Actions'ta COLLECTAPI_KEY gizli değişkeniyle çalışır; anahtar uygulamaya hiç girmez.
// NOBETCI_ILLER (virgülle ayrılmış, örn. "İstanbul,Ankara") verilirse sadece o iller çekilir; boşsa 81 il.
// Kod değişikliği sonrası yayınlarda (push) API kotası harcanmasın diye mevcut liste canlı siteden kopyalanır.
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const out = path.join(root, "www", "nobetci");
const SITE = "https://ermanysl.github.io/eczane-bul/nobetci/";
const tumIller = Object.keys(require(path.join(root, "ilceler.json")));
const key = (process.env.COLLECTAPI_KEY || "").trim();
const secili = (process.env.NOBETCI_ILLER || "").split(",").map(s => s.trim()).filter(Boolean);
const iller = secili.length ? tumIller.filter(il => secili.some(s => s.toLocaleLowerCase("tr") === il.toLocaleLowerCase("tr"))) : tumIller;
const apiKullan = process.env.GITHUB_EVENT_NAME !== "push";

const slug = s => s.toLocaleLowerCase("tr").replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u")
  .replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c").replace(/[^a-z0-9]+/g, "-");
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchIl(il){
  const r = await fetch(`https://api.collectapi.com/health/dutyPharmacy?il=${encodeURIComponent(il)}`, {
    headers: { "content-type": "application/json", authorization: key.startsWith("apikey") ? key : "apikey " + key }
  });
  const j = await r.json();
  if (!j.success) throw new Error(j.message || `HTTP ${r.status}`);
  return j.result.map(d => {
    const [lat, lng] = (d.loc || "").split(",").map(Number);
    return { name: d.name, ilce: d.dist, address: d.address, phone: d.phone, pos: lat && lng ? [lat, lng] : null };
  });
}

// Canlı sitedeki son listeyi kopyalar (API çağrısı yapmaz)
async function copyLive(il){
  const r = await fetch(SITE + slug(il) + ".json");
  if (!r.ok) throw new Error(`canlı sitede yok (HTTP ${r.status})`);
  fs.writeFileSync(path.join(out, slug(il) + ".json"), await r.text());
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  if (!apiKullan || !key) {
    console.log(key ? "Push yayını: liste canlı siteden kopyalanıyor." : "COLLECTAPI_KEY tanımlı değil, canlı sitedeki liste kullanılıyor.");
    for (const il of iller) await copyLive(il).then(() => console.log(`${il}: kopyalandı`), e => console.log(`${il}: ${e.message}`));
    return;
  }
  const time = new Date().toISOString();
  const failed = [];
  for (const il of iller) {
    try {
      const items = await fetchIl(il);
      fs.writeFileSync(path.join(out, slug(il) + ".json"), JSON.stringify({ il, time, items }));
      console.log(`${il}: ${items.length}`);
    } catch (e) {
      failed.push(il);
      console.log(`${il}: HATA ${e.message}`);
      // Hata olursa dünkü liste hiç yoktan iyidir
      await copyLive(il).catch(() => {});
    }
    await sleep(300);
  }
  if (failed.length === iller.length) process.exit(1);
})();
