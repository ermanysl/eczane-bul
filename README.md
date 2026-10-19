# Eczane Bul

Aynı kod hem **web uygulaması** (PWA) hem **Android/iOS uygulaması** (Capacitor) olarak çalışır.

## Web

Klasörü herhangi bir statik sunucuda yayınlayın (Netlify, GitHub Pages, Cloudflare Pages vb.). Konum için **HTTPS** gerekir.

Yerelde denemek için:

```
python -m http.server 8080
```

ve tarayıcıda `http://localhost:8080` açın. Telefonda Chrome/Safari ile açıp "Ana ekrana ekle" derseniz uygulama gibi tam ekran açılır.

## Veri kaynakları

- **Gündüz (tüm eczaneler):** OpenStreetMap (Overpass API), anahtar gerekmez.
- **Nöbetçi eczaneler:** CollectAPI. Anahtar uygulamada değil, GitHub'da gizli olarak durur. GitHub Actions her sabah 09:15'te listeyi çekip `nobetci/<il>.json` olarak siteyle birlikte yayınlar. Kod değişikliği push'larında API çağrılmaz, son liste korunur.
  Kurulum: depoda **Settings → Secrets and variables → Actions → New repository secret**, adı `COLLECTAPI_KEY`, değeri CollectAPI anahtarı. İsteğe bağlı: aynı sayfadaki **Variables** sekmesinde `NOBETCI_ILLER` değişkeni (örn. `İstanbul,Ankara,İzmir`) sadece o illeri çeker. Ücretsiz plan (ayda 100 istek) için en fazla 3 il seçin; tanımlanmazsa sadece İstanbul çekilir (ayda ~30 istek). Sonra Actions'tan "GitHub Pages" iş akışını bir kez elle çalıştırın.
- **İl/ilçe listesi:** `ilceler.json` (81 il, 973 ilçe; kaynak: turkey-neighbourhoods, MIT).

## Mobil uygulama (Android / iOS)

Gerekenler: [Node.js](https://nodejs.org), Android için [Android Studio](https://developer.android.com/studio), iOS için Mac + Xcode.

İlk kurulum (bir kez):

```
npm install
npm run android:ekle     # android/ klasörünü oluşturur, konum iznini ekler
npm run ios:ekle         # sadece Mac'te
```

Her kod değişikliğinden sonra:

```
npm run android          # dosyaları kopyalar ve Android Studio'yu açar
npm run ios              # Xcode'u açar
```

Android Studio'da ▶ Run ile telefona/emülatöre yükleyin. Mağaza için **Build > Generate Signed App Bundle** kullanın.

`www/` klasörü otomatik üretilir; kaynak dosyalar kökteki `index.html`, `app.js`, `style.css` dosyalarıdır.
