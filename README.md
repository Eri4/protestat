# Protestat

**Shqip** · [English below](#english)

Protestat është një aplikacion falas për telefonin që mbledh lajme publike nga media shqiptare, Policia e Shtetit dhe sizmologët. Ai i rendit ato si ngjarje (protesta, rrugë të bllokuara, urgjenca, tërmete) dhe tregon sa të besueshme janë.

- **Pa server, pa llogari, pa reklama.** Gjithçka ndodh dhe ruhet vetëm në telefonin tënd.
- **Punon edhe pa internet** me lajmet që ke marrë më parë.
- **Ndaj me të tjerët** me Telegram, WhatsApp, Signal ose Bluetooth.
- **Raporto vetë** çfarë sheh (p.sh. polici në terren / postbllok); të tjerët mund ta konfirmojnë ose të thonë se ka ikur.
- **Udhëzues** brenda aplikacionit (butoni **?**) për çdo funksion.
- **Shqip dhe anglisht.**

## Instalimi

**Android (rekomandohet):**

1. Hap faqen [Releases](../../releases/latest) në telefon.
2. Shkarko `Protestat-vX.Y.Z.apk`.
3. Hape skedarin. Herën e parë Android pyet nëse lejon instalimin nga ky burim: zgjidh **Lejo**.
4. Prek **Instalo**.

Përditësimet: aplikacioni të njofton vetë kur del një version i ri.

**iPhone:** hap faqen e aplikacionit në **Safari**, prek **Ndaj** ⬆️, pastaj **Shto në ekranin bazë**. Në iPhone mund të lexohen vetëm disa burime, por mund të marrësh raporte nga të tjerët.

## Si funksionon

1. Kur e hap aplikacionin ose prek ⟳, telefoni lexon burimet publike drejtpërdrejt.
2. Lajmet grupohen në **ngjarje** sipas llojit, vendit dhe kohës.
3. Çdo ngjarje merr një **vlerësim besueshmërie**:

| Vlerësimi | Kur jepet |
| --- | --- |
| Konfirmuar zyrtarisht | Policia ose EMSC (tërmetet) e njofton vetë |
| E lartë | 3 ose më shumë media të pavarura e raportojnë |
| Mesatare | 2 media të pavarura |
| E ulët | 1 media, ose 2 burime të paverifikuara |
| E paverifikuar | Vetëm një burim i panjohur ose një lidhje e shtuar nga dikush |
| E kundërshtuar | Një burim i njëjtë ose më i besueshëm e mohon |
| E vjetër | Nuk ka raport të ri prej disa orësh |

Rishpërndarjet, pëlqimet dhe kopjet **nuk llogariten**. Raportet që të dërgon dikush tjetër shënohen si "të ndara" dhe nuk e rrisin besueshmërinë.

## Burimet dhe nivelet e besimit

Mbi 55 burime shqiptare nga Shqipëria, Kosova dhe Maqedonia e Veriut, të renditura sipas nivelit:

| Niveli | Çfarë do të thotë | Shembuj |
| --- | --- | --- |
| **A · Zyrtare** | Institucioni flet vetë. Një mjafton për "konfirmuar". | Policia e Shtetit, EMSC (tërmetet), Bashkia e Tiranës |
| **B · Media e verifikuar** | Redaksi e njohur, raportim origjinal, korrigjon gabimet | RTSH, Euronews Albania, Report TV, Reporter.al, Faktoje, Koha.net, Telegrafi, Alsat |
| **C · Portal / agregator** | Ripostime, burime anonime, tituj sensacionalë | JOQ Albania, Lapsi, Syri, Albeu, Shqip.com |
| **D · E paverifikuar** | Të shtuara nga ti, Telegram, rrjetet sociale, raportet e njerëzve | — |

Të lëna jashtë qëllimisht: faqet që e ndalojnë leximin automatik në robots.txt (Balkan Insight, Radio Evropa e Lirë, Bota.al, Monitor) dhe ato që bllokojnë aksesin (Top Channel, A2, Ora News).

**Instagram, TikTok, Facebook:** këto platforma nuk lejojnë lexim automatik pa leje të posaçme. Aplikacioni ka listën e llogarive të njohura (JOQ, RTSH, Faktoje…) me nivelin e tyre; postimet i ruan duke ngjitur lidhjen.

**Shto burimet e tua:** te *Burimet* prek **Shto burim** dhe ngjit:

- lidhjen e një faqeje lajmesh (aplikacioni gjen vetë RSS-in nëse ekziston);
- një lidhje RSS;
- një kanal publik Telegram: `@emri` ose `t.me/emri`.

**TikTok, Instagram, Facebook, X:** këto platforma nuk lejojnë lexim automatik pa leje të posaçme. Prandaj ngjit lidhjen e postimit te **Shto një lidhje**, dhe ruhet si raport i paverifikuar.

## Raportet nga njerëzit

1. Prek **＋ Raporto**, zgjidh çfarë sheh (🚓 polici në terren, ✊ protestë, 🚧 rrugë e bllokuar…), vendos shenjën në hartë dhe ruaje.
2. Ndaje me Telegram që ta shohin të tjerët.
3. Kush e sheh, prek **👍 E shoh edhe unë**; kur ikën, **👋 Nuk është më aty**.

1 person = e paverifikuar, 2 = e ulët, 3+ = mesatare. Raportet e njerëzve vetëm nuk arrijnë kurrë "e lartë", sepse dikush me shumë telefona mund t'i falsifikojë. Kur edhe mediat raportojnë të njëjtën gjë, vlerësimi rritet; kur e mohojnë, shfaqet ⚠️ Kundërshtim. Raportet e policisë në terren vjetrohen pas 3 orësh. Çdo raport është i nënshkruar nga telefoni që e bëri, ndaj nuk mund të shumëfishohet duke e ripërcjellë.

## Grupi (opsional)

Telefonat mund të ndajnë raporte automatikisht në një **grup**. Serveri e zgjedh përdoruesi: **në telefonin e vet** (Android, përmes Wi-Fi/hotspot, edhe pa internet) ose **në një VPS** (shiko [server/README.md](server/README.md)). Gjithçka enkriptohet në telefon; serveri nuk e lexon dot dhe e fshin pas 72 orësh. Hyrja bëhet me një kod/QR.

## Siguria dhe privatësia

- Nuk njeh fytyra, nuk identifikon njerëz dhe nuk ndjek askënd.
- Tubimet shfaqen vetëm si **zona të përafërta** (~500 m ose qyteti), kurrë si pika të sakta.
- "Afër meje" e përdor vendndodhjen tënde vetëm një herë, e rrumbullakos në ~1 km dhe nuk e ruan.
- Skedarët që ndan përmbajnë vetëm lajme publike: kurrë vendndodhjen, fotot apo cilësimet e tua.
- Te Cilësimet: **Fshi të gjitha të dhënat** me një prekje.
- Android nuk bën kopje rezervë të të dhënave në cloud.

## Çfarë nuk bën

- Nuk mbledh lajme vazhdimisht në sfond: Android dhe iOS e ndalojnë. Përditësohet kur e hap.
- Nuk lexon Facebook/Instagram/TikTok automatikisht.
- Nuk mund të vërtetojë se diçka po ndodh *tani* vetëm nga një video.

---

<a id="english"></a>

# Protestat (English)

Protestat is a free phone app that collects public news from Albanian media, the State Police and seismologists. It groups them into events (protests, road blocks, emergencies, earthquakes) and shows how trustworthy each one is.

- **No server, no accounts, no ads.** Everything runs and is stored on your phone.
- **Works offline** with what you already downloaded.
- **Share with others** via Telegram, WhatsApp, Signal or Bluetooth.
- **Albanian and English.**

## Install

**Android (recommended):** open [Releases](../../releases/latest) on your phone, download `Protestat-vX.Y.Z.apk`, open it, allow installs from this source the first time, then tap **Install**. The app tells you when an update is available.

**iPhone:** open the app's web page in **Safari** → **Share** ⬆️ → **Add to Home Screen**. On iPhone only a few sources can be read directly, but you can receive reports from others.

## How it works

The phone reads public sources directly when you open the app or tap ⟳. Reports are grouped into **events** by type, place and time. Each event gets a **confidence rating** based on how many *independent* sources report it (see the table above). Reposts, likes and copies don't count. Reports shared by someone else are marked "shared" and never raise confidence.

**Sources and trust levels:** 55+ Albanian-language sources (Albania, Kosovo, North Macedonia) ranked A (official), B (verified newsroom), C (portal/aggregator), D (unverified: your own sources, Telegram, social links, people reports). Sites whose robots.txt forbids automated reading are excluded.

**People reports:** tap **＋ Report**, choose what you see (🚓 police on the ground / checkpoint, ✊ protest, 🚧 blocked road…), place the marker and save. Others tap **👍 I see it too** or **👋 It's gone**. 1 person = unverified, 2 = low, 3+ = moderate; people alone never reach "high". News that agrees raises it; news that denies it shows ⚠️ Conflict. Every people report is signed by the phone that made it, so forwarding can't multiply it.

**Groups (optional):** phones can share automatically through a group server chosen by users: on an Android phone (Wi‑Fi/hotspot, works offline) or on a VPS ([server/README.md](server/README.md)). Data is end-to-end encrypted; the server cannot read it and deletes it after 72 hours. Join with a code or QR.

**Guides:** the **?** button opens step-by-step guides for every feature.

**Add your own sources** in *Sources* → **Add source**: a news site link (the app finds its RSS feed), an RSS link, or a public Telegram channel (`@name` or `t.me/name`). For TikTok, Instagram, Facebook or X, use **Add a link**: these platforms don't allow automated reading without special approval.

## Safety and privacy

No face recognition, no identification of people, no tracking. Gatherings are shown only as approximate areas (~500 m or city). "Near me" uses your location once, rounded to ~1 km, and never stores it. Shared files contain only public news. One-tap **Delete all data**. No cloud backup.

---

## For developers

Svelte 5 + TypeScript + Vite, wrapped with Capacitor 8 for Android. Storage is IndexedDB (Dexie). There is no backend.

```bash
npm install
npm run dev        # web version at http://localhost:5173
npm test           # unit tests (real feed samples in tests/fixtures)
npm run check      # type check
npm run build      # production web build in dist/
npx cap sync android && cd android && ./gradlew assembleDebug   # APK (needs JDK 21 + Android SDK)
```

In the browser, most Albanian sites block cross-origin reads (no CORS headers). The Android app uses native HTTP (`CapacitorHttp`) instead. For desktop testing behind a CORS proxy, set `localStorage['protestat.allSources'] = '1'`.

### Project layout

```text
src/lib/adapters/   parsers: RSS/Atom, Telegram public preview, web page headlines, EMSC
src/lib/engine/     fetcher, collector (retries, backoff, 304), classify, normalize, incidents (confidence rules)
src/lib/geo/        offline place list (GeoNames CC-BY) + Tirana landmarks
src/lib/share/      signed .protestat bundles (ECDSA P-256, gzip) and import checks
src/lib/sources/    built-in sources, user-added sources, pasted links
src/lib/ui/         screens
scripts/            build-geo.mjs (place list), android-icons.mjs
```

### Publishing your own build

1. Create a public GitHub repository and push this code.
2. In `src/lib/config.ts`, set `PROJECT_URL` and `RELEASES_API` to your repository.
3. **Signing key** (once). Keep the file and passwords safe: losing them means users can't update.

   ```bash
   keytool -genkeypair -v -keystore release.keystore -alias protestat -keyalg RSA -keysize 4096 -validity 10000
   base64 -w0 release.keystore   # copy the output
   ```

   Add repository secrets: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (`protestat`), `ANDROID_KEY_PASSWORD`.
4. Release: `git tag v0.1.0 && git push origin v0.1.0`. GitHub Actions builds the APK and attaches it with its SHA-256 checksum and signing certificate.
5. Web/iPhone version: enable *Settings → Pages → Source: GitHub Actions*. Every push to `main` deploys `dist/`.

### Adding a built-in source

Add it to `src/lib/sources/defaults.ts`. Before you do:

- check the site's robots.txt and terms;
- prefer an RSS feed;
- set `family` when outlets share an owner, so they count as one source.

Never add bypasses for CAPTCHAs, logins, rate limits or bot protection.

### Data licences

- Place names: [GeoNames](https://www.geonames.org/) (CC BY 4.0).
- Country outline: [Natural Earth](https://www.naturalearthdata.com/) (public domain).
- Online map: [OpenFreeMap](https://openfreemap.org/), © OpenMapTiles, data © OpenStreetMap contributors.

## License

GPL-3.0-or-later. See [LICENSE](LICENSE).
