// "npx cap add android/ios" sonrası konum iznini yerel projelere ekler.
// Birden çok kez çalıştırmak güvenlidir.
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

const manifest = path.join(root, "android/app/src/main/AndroidManifest.xml");
if (fs.existsSync(manifest)) {
  let xml = fs.readFileSync(manifest, "utf8");
  const perms = ["ACCESS_COARSE_LOCATION", "ACCESS_FINE_LOCATION"]
    .filter(p => !xml.includes(`android.permission.${p}`))
    .map(p => `    <uses-permission android:name="android.permission.${p}" />\n`).join("");
  if (perms) {
    xml = xml.replace("</manifest>", perms + "</manifest>");
    fs.writeFileSync(manifest, xml);
    console.log("Android: konum izinleri eklendi.");
  }
}

const plist = path.join(root, "ios/App/App/Info.plist");
if (fs.existsSync(plist)) {
  let xml = fs.readFileSync(plist, "utf8");
  if (!xml.includes("NSLocationWhenInUseUsageDescription")) {
    xml = xml.replace(/<dict>/, "<dict>\n\t<key>NSLocationWhenInUseUsageDescription</key>\n\t<string>Size en yakın eczaneleri göstermek için konumunuz kullanılır.</string>");
    fs.writeFileSync(plist, xml);
    console.log("iOS: konum izni açıklaması eklendi.");
  }
}
