// 81 ilin nöbetçi eczanelerini CollectAPI'den çekip www/nobetci/<il>.json olarak yazar.
// GitHub Actions'ta COLLECTAPI_KEY gizli değişkeniyle çalışır; anahtar uygulamaya hiç girmez.
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const out = path.join(root, "www", "nobetci");
const iller = Object.keys(require(path.join(root, "ilceler.json")));
const key = (process.env.COLLECTAPI_KEY || "").trim();

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

(async () => {
  if (!key) {
    console.log("COLLECTAPI_KEY tanımlı değil, nöbetçi verisi güncellenmedi.");
    return;
  }
  fs.mkdirSync(out, { recursive: true });
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
    }
    await sleep(300);
  }
  fs.writeFileSync(path.join(out, "durum.json"), JSON.stringify({ time, failed }));
  if (failed.length === iller.length) process.exit(1);
})();
