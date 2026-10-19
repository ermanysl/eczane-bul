const ILLER = ["Adana","Adıyaman","Afyonkarahisar","Ağrı","Aksaray","Amasya","Ankara","Antalya","Ardahan","Artvin","Aydın","Balıkesir","Bartın","Batman","Bayburt","Bilecik","Bingöl","Bitlis","Bolu","Burdur","Bursa","Çanakkale","Çankırı","Çorum","Denizli","Diyarbakır","Düzce","Edirne","Elazığ","Erzincan","Erzurum","Eskişehir","Gaziantep","Giresun","Gümüşhane","Hakkari","Hatay","Iğdır","Isparta","İstanbul","İzmir","Kahramanmaraş","Karabük","Karaman","Kars","Kastamonu","Kayseri","Kilis","Kırıkkale","Kırklareli","Kırşehir","Kocaeli","Konya","Kütahya","Malatya","Manisa","Mardin","Mersin","Muğla","Muş","Nevşehir","Niğde","Ordu","Osmaniye","Rize","Sakarya","Samsun","Şanlıurfa","Siirt","Sinop","Şırnak","Sivas","Tekirdağ","Tokat","Trabzon","Tunceli","Uşak","Van","Yalova","Yozgat","Zonguldak"];

// Eczanelerin olağan çalışma saatleri; bu aralık dışında ve pazar günleri nöbetçi moda geçilir.
const DAY_START = 9, DAY_END = 19;

const $ = id => document.getElementById(id);
const store = {
  get(k){ try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v){ try { localStorage.setItem(k, v); } catch {} }
};

const ilSel = $("il");
ILLER.forEach(i => ilSel.add(new Option(i, i)));
$("apikey").value = store.get("collectapi_key") || "";
$("radius").value = store.get("radius") || "3000";
$("btnSave").onclick = () => {
  store.set("collectapi_key", $("apikey").value.trim());
  store.set("radius", $("radius").value);
  status("Ayarlar kaydedildi.");
};

let modeChoice = store.get("mode") || "auto";
let me = null, center = null, items = [], markers = [];

const map = L.map("map").setView([39.0, 35.0], 6);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom:19, attribution:"© OpenStreetMap" }).addTo(map);
const layer = L.layerGroup().addTo(map);

function status(t){ $("status").textContent = t; }
function esc(s){ return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function norm(s){ return (s || "").replace(/ (İlçesi|Merkez)$/i, "").trim(); }

function isNightNow(d = new Date()){
  const h = d.getHours() + d.getMinutes() / 60;
  return d.getDay() === 0 || h < DAY_START || h >= DAY_END;
}
function activeMode(){ return modeChoice === "auto" ? (isNightNow() ? "night" : "day") : modeChoice; }

function renderMode(){
  document.querySelectorAll(".modes button").forEach(b => b.classList.toggle("on", b.dataset.mode === modeChoice));
  const m = activeMode();
  document.body.classList.toggle("day", m === "day");
  $("modeInfo").textContent = (modeChoice === "auto" ? "Otomatik: " : "") +
    (m === "day" ? "Gündüz — yakınınızdaki tüm eczaneler gösteriliyor." : "Gece/tatil — sadece nöbetçi eczaneler gösteriliyor.");
}
document.querySelectorAll(".modes button").forEach(b => b.onclick = () => {
  modeChoice = b.dataset.mode; store.set("mode", modeChoice); renderMode();
  if (me || ilSel.value) search();
});
// Otomatik moddayken saat 09:00 / 19:00 geçişini yakala
setInterval(() => {
  const before = document.body.classList.contains("day") ? "day" : "night";
  renderMode();
  if (modeChoice === "auto" && activeMode() !== before && (me || ilSel.value)) search();
}, 60000);
renderMode();

function haversine(a, b){
  const R = 6371, r = x => x * Math.PI / 180;
  const dLat = r(b[0] - a[0]), dLng = r(b[1] - a[1]);
  const h = Math.sin(dLat/2)**2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Telefon konumu → il/ilçe (OpenStreetMap Nominatim ters geocoding)
$("btnLoc").onclick = () => {
  if (!navigator.geolocation) return status("Cihazınız konum desteklemiyor.");
  status("Konum alınıyor…");
  navigator.geolocation.getCurrentPosition(async pos => {
    me = [pos.coords.latitude, pos.coords.longitude];
    center = me;
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&accept-language=tr&lat=${me[0]}&lon=${me[1]}`);
      const a = (await r.json()).address || {};
      const il = norm(a.province || a.state || a.city);
      const ilce = norm(a.town || a.county || a.district || a.suburb || a.city_district);
      if (ILLER.includes(il)) ilSel.value = il;
      $("ilce").value = ilce;
      status(`Konumunuz: ${il} / ${ilce}`);
    } catch { status("İl/ilçe bulunamadı; gündüz modu yine de konumunuzla çalışır."); }
    search();
  }, err => status("Konum izni verilmedi (" + err.message + "). İl/ilçeyi elle seçin."),
  { enableHighAccuracy:true, timeout:15000 });
};

$("btnSearch").onclick = async () => {
  me = null; // elle seçimde mesafe ilçe merkezine göre değil, konum yoksa gösterilmez
  center = await geocodeArea(ilSel.value, $("ilce").value.trim());
  search();
};

async function geocodeArea(il, ilce){
  if (!il) return null;
  try {
    const q = encodeURIComponent([ilce, il, "Türkiye"].filter(Boolean).join(", "));
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${q}`);
    const j = await r.json();
    return j[0] ? [+j[0].lat, +j[0].lon] : null;
  } catch { return null; }
}

async function search(){
  const mode = activeMode();
  status(mode === "day" ? "Yakındaki eczaneler aranıyor…" : "Nöbetçi eczaneler aranıyor…");
  let data;
  try {
    data = mode === "day" ? await fetchAllNearby() : await fetchDuty();
  } catch (e) { return status("Veri alınamadı: " + e.message); }
  if (!data) return;
  const ref = me || center;
  items = data.map(p => ({ ...p, km: me && p.pos ? haversine(me, p.pos) : null }))
    .sort((a, b) => (a.km ?? (ref && a.pos ? haversine(ref, a.pos) : 1e9)) - (b.km ?? (ref && b.pos ? haversine(ref, b.pos) : 1e9)));
  render();
  if (!items.some(p => p.demo))
    status(`${items.length} ${mode === "day" ? "eczane" : "nöbetçi eczane"} bulundu${me ? ", en yakına göre sıralandı" : ""}.`);
}

// Gündüz: OpenStreetMap'teki tüm eczaneler (Overpass API, ücretsiz)
async function fetchAllNearby(){
  if (!center) { status("Gündüz modu için konum ya da il/ilçe gerekli."); return null; }
  const rad = +($("radius").value || 3000);
  const q = `[out:json][timeout:25];nwr(around:${rad},${center[0]},${center[1]})[amenity=pharmacy];out center tags;`;
  const r = await fetch("https://overpass-api.de/api/interpreter", { method:"POST", body:"data=" + encodeURIComponent(q) });
  if (!r.ok) throw new Error("Overpass " + r.status);
  const j = await r.json();
  return j.elements.map(e => {
    const t = e.tags || {};
    const lat = e.lat ?? e.center?.lat, lng = e.lon ?? e.center?.lon;
    const addr = [t["addr:street"], t["addr:housenumber"], t["addr:district"] || t["addr:suburb"]].filter(Boolean).join(" ");
    return { name: t.name || "Eczane", address: addr, phone: t.phone || t["contact:phone"], hours: t.opening_hours, pos: [lat, lng] };
  });
}

// Gece: nöbetçi eczaneler (CollectAPI)
async function fetchDuty(){
  const il = ilSel.value, ilce = $("ilce").value.trim();
  if (!il) { status("Nöbetçi eczane için il seçin."); return null; }
  const key = store.get("collectapi_key") || $("apikey").value.trim();
  if (!key) { status("Demo veri gösteriliyor (Ayarlar'a CollectAPI anahtarı girilmedi)."); return demoData(il, ilce); }
  const url = `https://api.collectapi.com/health/dutyPharmacy?il=${encodeURIComponent(il)}` + (ilce ? `&ilce=${encodeURIComponent(ilce)}` : "");
  const r = await fetch(url, { headers: { "content-type":"application/json", authorization: key.startsWith("apikey") ? key : "apikey " + key } });
  const j = await r.json();
  if (!j.success) throw new Error(j.message || "API hatası");
  return j.result.map(d => {
    const [lat, lng] = (d.loc || "").split(",").map(Number);
    return { name: d.name, address: d.address, phone: d.phone, duty: true, pos: lat && lng ? [lat, lng] : null };
  });
}

function dirUrl(p){
  const dest = p.pos ? p.pos.join(",") : encodeURIComponent(p.name + " " + (p.address || ""));
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
}

function render(){
  layer.clearLayers(); markers = [];
  const list = $("list"); list.innerHTML = "";
  if (!items.length) { list.innerHTML = "<p class='muted'>Sonuç yok. Ayarlar'dan arama yarıçapını büyütebilirsiniz.</p>"; return; }
  const bounds = [];
  if (me) { L.circleMarker(me, { radius:8, color:"#1570ef", fillOpacity:.9 }).addTo(layer).bindPopup("Siz"); bounds.push(me); }
  items.forEach((p, i) => {
    const div = document.createElement("div");
    div.className = "ph";
    div.innerHTML = `${p.km != null ? `<span class="dist">${p.km.toFixed(1)} km</span>` : ""}
      <h3>${esc(p.name)}${p.duty ? '<span class="badge">Nöbetçi</span>' : ""}</h3>
      ${p.address ? `<p>${esc(p.address)}</p>` : ""}
      ${p.hours ? `<p>🕒 ${esc(p.hours)}</p>` : ""}
      ${p.phone ? `<p>☎ <a href="tel:${esc(p.phone)}">${esc(p.phone)}</a></p>` : ""}
      <a class="go" target="_blank" rel="noopener" href="${dirUrl(p)}">🧭 Yol tarifi</a>`;
    div.onclick = e => { if (e.target.tagName !== "A") select(i); };
    list.appendChild(div);
    if (p.pos) {
      const m = L.marker(p.pos).addTo(layer)
        .bindPopup(`<b>${esc(p.name)}</b><br>${esc(p.address)}<br><a target="_blank" rel="noopener" href="${dirUrl(p)}">Yol tarifi al</a>`);
      m.on("click", () => select(i, false));
      markers[i] = m; bounds.push(p.pos);
    }
  });
  if (bounds.length) map.fitBounds(bounds, { padding:[30, 30], maxZoom:15 });
}

function select(i, openPopup = true){
  const cards = document.querySelectorAll(".ph");
  cards.forEach((el, j) => el.classList.toggle("sel", i === j));
  cards[i].scrollIntoView({ block:"nearest", behavior:"smooth" });
  const m = markers[i];
  if (m) { map.setView(m.getLatLng(), 16); if (openPopup) m.openPopup(); }
}

// API anahtarı yokken deneme amaçlı sahte nöbetçi eczaneler
function demoData(il, ilce){
  const c = me || center || [map.getCenter().lat, map.getCenter().lng];
  return ["Şifa", "Hayat", "Merkez", "Güven", "Sağlık"].map((n, k) => ({
    name: `${n} Eczanesi (DEMO)`, duty: true, demo: true,
    address: `${ilce || "Merkez"} / ${il} – örnek adres ${k + 1}`, phone: "0212 000 00 0" + k,
    pos: [c[0] + (Math.random() - .5) * 0.04, c[1] + (Math.random() - .5) * 0.04]
  }));
}

// PWA: çevrimdışı kabuk + "ana ekrana ekle". Capacitor ile paketlenmiş mobil uygulamada dosyalar zaten cihazda, service worker gereksiz.
const isNative = !!window.Capacitor?.isNativePlatform?.();
if (!isNative && "serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
let installEvt = null;
addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvt = e; $("btnInstall").hidden = false; });
$("btnInstall").onclick = async () => { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice; installEvt = null; $("btnInstall").hidden = true; };
