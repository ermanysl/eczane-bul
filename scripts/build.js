// Web dosyalarını Capacitor'ın paketleyeceği www/ klasörüne kopyalar.
// Kaynak dosyalar kökte kalır; web sürümü doğrudan kökten yayınlanır.
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const out = path.join(root, "www");
const FILES = ["index.html", "app.js", "style.css", "sw.js", "manifest.webmanifest",
  "icon.svg", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png"];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
for (const f of FILES) fs.copyFileSync(path.join(root, f), path.join(out, f));
console.log(`www/ hazır (${FILES.length} dosya).`);
