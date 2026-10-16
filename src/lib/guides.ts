// Step-by-step guides shown on the Guides page. Plain words, short steps, both languages.

export interface Guide {
  id: string;
  icon: string;
  title: { sq: string; en: string };
  /** Paragraphs; lines starting with "1." "2." … are shown as numbered steps. */
  body: { sq: string[]; en: string[] };
}

export const GUIDES: Guide[] = [
  {
    id: 'start',
    icon: '👋',
    title: { sq: 'Çfarë është Protestat?', en: 'What is Protestat?' },
    body: {
      sq: [
        'Protestat mbledh lajme publike nga media shqiptare, Policia e Shtetit dhe sizmologët, si dhe raporte nga njerëzit që përdorin aplikacionin.',
        'I bashkon në ngjarje (protesta, polici në terren, rrugë të bllokuara, urgjenca, tërmete) dhe të tregon me fjalë të thjeshta sa të besueshme janë.',
        'Nuk ka server, llogari apo reklama. Gjithçka ruhet vetëm në telefonin tënd.',
      ],
      en: [
        'Protestat collects public news from Albanian media, the State Police and seismologists, plus reports from people using the app.',
        'It groups them into events (protests, police on the ground, blocked roads, emergencies, earthquakes) and tells you in plain words how trustworthy each one is.',
        'No server, no accounts, no ads. Everything stays on your phone.',
      ],
    },
  },
  {
    id: 'read',
    icon: '📰',
    title: { sq: 'Si ta lexosh një ngjarje', en: 'How to read an event' },
    body: {
      sq: [
        'Çdo kartë ka: llojin (me ngjyrë dhe ikonë), titullin, një fjali "Çfarë do të thotë", moshën dhe vendin.',
        '🟢 I ri = raporti i fundit para më pak se 1 ore. 🟡 Para pak = ende aktual. ⏳ E vjetër = asnjë raport i ri prej disa orësh: mund të ketë përfunduar.',
        '⚠️ Kundërshtim = disa burime ose njerëz thonë të kundërtën. Hape dhe lexo të dyja anët.',
        'Shenja e besueshmërisë: ✓ Konfirmuar zyrtarisht (Policia ose EMSC), ●●● E lartë (3+ media të pavarura), ●● Mesatare (2 media ose 3+ njerëz), ● E ulët (1 media ose 2 njerëz), ? E paverifikuar (vetëm një burim i panjohur ose 1 person).',
        'Rishpërndarjet, pëlqimet dhe artikujt e kopjuar NUK llogariten. Mediat e të njëjtit pronar numërohen si një.',
        'Prek kartën për detajet: pse ka atë vlerësim, kronologjinë e të gjitha raportimeve dhe lidhjet e burimeve.',
      ],
      en: [
        'Each card shows: the type (colour and icon), the headline, a "What this means" sentence, its age and the place.',
        '🟢 New = latest report less than 1 hour ago. 🟡 Recent = still current. ⏳ Old = no new report for hours: it may be over.',
        '⚠️ Conflict = some sources or people say the opposite. Open it and read both sides.',
        'Trust badge: ✓ Officially confirmed (Police or EMSC), ●●● High (3+ independent newsrooms), ●● Moderate (2 newsrooms or 3+ people), ● Low (1 newsroom or 2 people), ? Unverified (a single unknown source or 1 person).',
        'Reposts, likes and copied articles do NOT count. Outlets with the same owner count as one.',
        'Tap the card for details: why it has that rating, the timeline of every report and links to the sources.',
      ],
    },
  },
  {
    id: 'trust',
    icon: '🏅',
    title: { sq: 'Nivelet e besimit të burimeve (A, B, C, D)', en: 'Source trust levels (A, B, C, D)' },
    body: {
      sq: [
        'A · Zyrtare: institucioni flet vetë (Policia e Shtetit, EMSC për tërmetet, Bashkia). Një raport A mjafton për "Konfirmuar".',
        'B · Media e verifikuar: redaksi me pronar dhe gazetarë të njohur, raportim origjinal, korrigjon gabimet (p.sh. RTSH, Euronews Albania, Reporter.al, Faktoje, Koha.net).',
        'C · Portal / agregator: kryesisht ripostime, burime anonime ose tituj sensacionalë (p.sh. JOQ, Albeu, portale të vogla). Shfaqen, por nuk e ngrenë besueshmërinë.',
        'D · E paverifikuar: burimet që shton vetë, kanalet Telegram, lidhjet nga Instagram/TikTok/Facebook dhe raportet nga njerëzit.',
        'Renditja është gjykim i projektit, jo vendim për ndonjë media. Kodi është i hapur: kushdo mund të propozojë ndryshime.',
      ],
      en: [
        'A · Official: the institution speaks for itself (State Police, EMSC for earthquakes, the municipality). One A report is enough for "Confirmed".',
        'B · Verified newsroom: known owner and journalists, original reporting, corrects mistakes (e.g. RTSH, Euronews Albania, Reporter.al, Faktoje, Koha.net).',
        'C · Portal / aggregator: mostly reposts, anonymous sources or sensational headlines (e.g. JOQ, Albeu, small portals). Shown, but they do not raise trust.',
        'D · Unverified: sources you add yourself, Telegram channels, Instagram/TikTok/Facebook links and people reports.',
        'The ranking is the project\'s judgement, not a verdict on any outlet. The code is open: anyone can propose changes.',
      ],
    },
  },
  {
    id: 'report',
    icon: '📣',
    title: { sq: 'Si të raportosh diçka që sheh', en: 'How to report something you see' },
    body: {
      sq: [
        '1. Prek butonin e kuq "＋ Raporto" (në hartë ose te lajmet).',
        '2. Zgjidh çfarë sheh: 🚓 Polici në terren / postbllok, ✊ Protestë, 🚧 Rrugë e bllokuar, 🚨 Urgjencë, 🚗 Aksident, ⚠️ Rrezik.',
        'Për polici: zgjidh llojin (👮 me uniformë, 🕵️ policë civilë, 🛡️ forca speciale, 🚙 makina pa shenja) dhe pse janë aty (kontroll dokumentesh, kontroll makinash, shoqërime, ruajnë një ndërtesë…). Të dyja janë opsionale.',
        '3. Lëviz hartën e vogël derisa shenja të jetë mbi vend, ose prek "📍 Përdor vendndodhjen time".',
        '4. Shkruaj një shënim të shkurtër nëse do (p.sh. "3 makina policie, kontrollojnë makinat").',
        '5. Prek "Ruaj raportin". Pastaj ndaje me Telegram ose me çdo aplikacion tjetër, që ta shohin edhe të tjerët.',
        '🔒 Mos shkruaj emra, targa apo të dhëna personale. Vendi rrumbullakoset në ~200 m. Raportet e policisë në terren konsiderohen të vjetra pas 3 orësh.',
      ],
      en: [
        '1. Tap the red "＋ Report" button (on the map or the news).',
        '2. Choose what you see: 🚓 Police on the ground / checkpoint, ✊ Protest, 🚧 Blocked road, 🚨 Emergency, 🚗 Accident, ⚠️ Hazard.',
        'For police: choose the kind (👮 uniformed, 🕵️ plainclothes, 🛡️ special units, 🚙 unmarked cars) and why they are there (checking IDs, checking vehicles, detaining people, guarding a building…). Both are optional.',
        '3. Move the small map until the marker is on the spot, or tap "📍 Use my location".',
        '4. Write a short note if you like (e.g. "3 police cars, checking vehicles").',
        '5. Tap "Save report". Then share it on Telegram or any other app so others can see it too.',
        '🔒 Do not write names, number plates or personal details. The spot is rounded to ~200 m. Police-on-the-ground reports count as old after 3 hours.',
      ],
    },
  },
  {
    id: 'confirm',
    icon: '👍',
    title: { sq: 'Konfirmo ose thuaj se ka ikur', en: 'Confirm, or say it\'s gone' },
    body: {
      sq: [
        'Kur hap një ngjarje që mund ta shohësh me sy (protestë, polici, rrugë e bllokuar…), ke dy butona:',
        '👍 "E shoh edhe unë": shton konfirmimin tënd. 👋 "Nuk është më aty": tregon se ka përfunduar.',
        'Çdo telefon numërohet vetëm një herë dhe vlen përgjigja e fundit. 1 person = e paverifikuar, 2 = e ulët, 3 ose më shumë = mesatare.',
        'Raportet e njerëzve vetëm nuk arrijnë kurrë "e lartë" ose "konfirmuar", sepse dikush me shumë telefona mund t\'i falsifikojë. Kur edhe mediat raportojnë të njëjtën gjë, vlerësimi rritet.',
        'Nëse disa thonë "e shoh" dhe të tjerë "ka ikur", ngjarja shfaqet me ⚠️ Kundërshtim. Nëse lajmet e mohojnë, shfaqet gjithashtu si kundërshtim.',
      ],
      en: [
        'When you open an event you can see with your own eyes (protest, police, blocked road…), you get two buttons:',
        '👍 "I see it too" adds your confirmation. 👋 "It\'s gone" says it is over.',
        'Each phone counts only once and its latest answer is used. 1 person = unverified, 2 = low, 3 or more = moderate.',
        'People reports alone never reach "high" or "confirmed", because someone with several phones could fake them. When newsrooms report the same thing, the rating goes up.',
        'If some say "I see it" and others "it\'s gone", the event shows ⚠️ Conflict. If the news denies it, it also shows as a conflict.',
      ],
    },
  },
  {
    id: 'map',
    icon: '🗺️',
    title: { sq: 'Si ta përdorësh hartën', en: 'How to use the map' },
    body: {
      sq: [
        'Butonat lart zgjedhin çfarë shfaqet. Në fillim janë ndezur: ✊ Protesta, 🚓 Polici në terren dhe 👮 Njoftime policie. Numri në buton = sa ngjarje ka.',
        'Butoni 🕒 zgjedh periudhën: 2 orë, 12 orë, 24 orë ose 7 ditë.',
        'Çdo rreth = një ngjarje. Ngjyra dhe ikona = lloji. Numri i vogël = sa burime ose njerëz e raportojnë. E zbehur = e vjetër. "!" vjollcë = ka kundërshtime.',
        'Prek një rreth ose kartën poshtë për ta parë; "Detaje →" hap gjithçka. Kur zmadhon, shfaqet zona e përafërt (asnjëherë pika e saktë).',
        'Kur shumë ngjarje janë në të njëjtin vend (p.sh. Tiranë), shfaqet një flluskë me numrin: prek për t\'i parë veç e veç. Prek një protestë për të parë pikat e sakta që përmendin raportet (p.sh. "Kryeministria · 8").',
        '📍 vendos një shenjë blu "Ti je këtu". Shfaqet vetëm në telefonin tënd dhe nuk ruhet. ⓘ shpjegon simbolet.',
      ],
      en: [
        'The buttons on top choose what is shown. At first these are on: ✊ Protests, 🚓 Police on scene and 👮 Police notices. The number on a button = how many events.',
        'The 🕒 button picks the period: 2 hours, 12 hours, 24 hours or 7 days.',
        'Each circle = one event. Colour and icon = type. The small number = how many sources or people report it. Faded = old. Purple "!" = there are conflicts.',
        'Tap a circle or the card at the bottom to see it; "Details →" opens everything. When you zoom in, the approximate area appears (never the exact point).',
        'When many events are in one place (e.g. Tirana) a bubble shows the number: tap it to see them one by one. Tap a protest to see the exact places the reports name (e.g. "Kryeministria · 8").',
        '📍 puts a blue "You are here" pin on the map. It is shown only on your phone and never stored. ⓘ explains the symbols.',
      ],
    },
  },
  {
    id: 'accuracy',
    icon: '🎯',
    title: { sq: 'Si të kesh informacion më të saktë', en: 'How to get more accurate information' },
    body: {
      sq: [
        'Aplikacioni di vetëm atë që lexon telefoni yt dhe atë që të dërgojnë të tjerët. Për më shumë saktësi:',
        '1. Merr raporte nga njerëz që njeh: te "Ndaj" → "Merr raporte", hap skedarin .protestat që të dërgojnë (p.sh. në Telegram).',
        '2. Aktivizo më shumë burime te "Burimet" (çdo burim ka nivelin A–D).',
        '3. Shto burimet e tua: një faqe lajmesh, RSS ose kanal Telegram.',
        '4. Raporto ose konfirmo vetë atë që sheh. Sa më shumë njerëz të pavarur, aq më i saktë vlerësimi.',
        'Mbaj mend: raportet e marra nga të tjerët nuk e rrisin besueshmërinë vetë. Burimi origjinal është ai që vlen.',
      ],
      en: [
        'The app only knows what your phone reads and what others send you. For more accuracy:',
        '1. Get reports from people you know: "Share" → "Receive reports", open the .protestat file they send you (e.g. on Telegram).',
        '2. Turn on more sources in "Sources" (each source has a level A–D).',
        '3. Add your own sources: a news site, an RSS feed or a Telegram channel.',
        '4. Report or confirm what you see yourself. The more independent people, the more accurate the rating.',
        'Remember: reports received from others do not raise trust on their own. The original source is what counts.',
      ],
    },
  },
  {
    id: 'sources',
    icon: '📡',
    title: { sq: 'Si të shtosh burime', en: 'How to add sources' },
    body: {
      sq: [
        '1. Te "Burimet" prek "＋ Shto burim".',
        '2. Ngjit lidhjen e një faqeje lajmesh (aplikacioni gjen vetë RSS-in), një lidhje RSS, ose një kanal publik Telegram si @emri ose t.me/emri.',
        '3. Prek "Shiko": del lista e 5 titujve të fundit. Nëse duken mirë, prek "Shto këtë burim".',
        'Burimet që shton ti janë niveli D (të paverifikuara). Aplikacioni respekton robots.txt të faqes dhe e lexon jo më shpesh se çdo 15 minuta.',
        'Me çelësin pranë çdo burimi mund ta ndezësh ose fikësh. Pika e gjelbër = u lexua me sukses; e kuqe = gabim.',
      ],
      en: [
        '1. In "Sources" tap "＋ Add source".',
        '2. Paste a news site link (the app finds its RSS feed), an RSS link, or a public Telegram channel like @name or t.me/name.',
        '3. Tap "Check": the 5 latest headlines appear. If they look right, tap "Add this source".',
        'Sources you add are level D (unverified). The app respects the site\'s robots.txt and reads it no more than every 15 minutes.',
        'The switch next to each source turns it on or off. Green dot = read successfully; red = error.',
      ],
    },
  },
  {
    id: 'social',
    icon: '📱',
    title: { sq: 'Instagram, TikTok, Facebook', en: 'Instagram, TikTok, Facebook' },
    body: {
      sq: [
        'Këto platforma nuk lejojnë që aplikacionet t\'i lexojnë automatikisht pa leje të posaçme, ndaj Protestat nuk i lexon vetë.',
        'Te "Burimet" → "Rrjetet sociale" ka listën e llogarive të njohura (p.sh. JOQ Albania, RTSH, Faktoje) me nivelin e tyre. Prek "Hap" për t\'i parë.',
        '1. Kur sheh një postim të rëndësishëm, kopjo lidhjen e tij (Share → Copy link).',
        '2. Te "Burimet" prek "Shto një lidhje", ngjit lidhjen, zgjidh llogarinë, llojin dhe vendin.',
        'Ruhet si raport i paverifikuar. Kur edhe burime të tjera raportojnë të njëjtën gjë, vlerësimi rritet.',
      ],
      en: [
        'These platforms do not let apps read them automatically without special approval, so Protestat cannot read them by itself.',
        'In "Sources" → "Social media" there is a list of known accounts (e.g. JOQ Albania, RTSH, Faktoje) with their level. Tap "Open" to view them.',
        '1. When you see an important post, copy its link (Share → Copy link).',
        '2. In "Sources" tap "Add a link", paste it, choose the account, the type and the place.',
        'It is saved as an unverified report. When other sources report the same thing, the rating goes up.',
      ],
    },
  },
  {
    id: 'share',
    icon: '✈️',
    title: { sq: 'Si të ndash dhe të marrësh raporte', en: 'How to share and receive reports' },
    body: {
      sq: [
        'Një ngjarje të vetme: hape → "Telegram" (hap Telegram-in me mesazhin gati) ose "Ndaj" (çdo aplikacion).',
        'Shumë raporte njëherësh: te "Ndaj" zgjidh periudhën → "Dërgo skedarin" → zgjidh Telegram, WhatsApp, Signal ose Bluetooth.',
        'Për të marrë: hap skedarin .protestat që të dërguan → te "Ndaj" → "Merr raporte" → "Zgjidh skedarin".',
        'Skedari ka vetëm lajme publike dhe raporte njerëzish, kurrë vendndodhjen tënde, fotot apo cilësimet. Çdo raport njeriu është i nënshkruar, ndaj nuk mund të shumëfishohet.',
        '"Kodi yt i dërguesit" (p.sh. 7F3A-91C2) është i rastësishëm. Mund ta ndryshosh te Cilësimet.',
      ],
      en: [
        'A single event: open it → "Telegram" (opens Telegram with the message ready) or "Share" (any app).',
        'Many reports at once: in "Share" choose the period → "Send file" → choose Telegram, WhatsApp, Signal or Bluetooth.',
        'To receive: open the .protestat file you were sent → "Share" → "Receive reports" → "Choose file".',
        'The file has only public news and people reports, never your location, photos or settings. Each people report is signed, so it cannot be multiplied.',
        '"Your sender code" (e.g. 7F3A-91C2) is random. You can change it in Settings.',
      ],
    },
  },
  {
    id: 'group',
    icon: '👥',
    title: { sq: 'Grupi: ndaj automatikisht me njerëz që zgjedh', en: 'Groups: share automatically with people you choose' },
    body: {
      sq: [
        'Një grup i lejon disa telefona të ndajnë raporte dhe burime vetë, pa dërguar skedarë. Është opsional: aplikacioni punon edhe pa të.',
        '1. Dikush prek "Ndaj" → "Krijo grup" dhe zgjedh ku do të jetë serveri: në telefonin e vet ose në një server (VPS).',
        '2. Pastaj prek "Fto të tjerë" dhe e dërgon kodin në Telegram, ose i lë të tjerët ta skanojnë si QR.',
        '3. Të tjerët prekin kodin (ose "Bashkohu me kod" dhe e ngjisin). Kaq.',
        'Kur aplikacioni është hapur, telefonat dërgojnë dhe marrin raporte çdo minutë. "Sinkronizo tani" e bën menjëherë.',
        '🔐 Gjithçka enkriptohet në telefon me çelësin që ndodhet brenda kodit. Serveri ruan vetëm të dhëna të palexueshme dhe i fshin pas 72 orësh. Ndaje kodin vetëm me njerëz që i beson.',
        'Raportet e njerëzve mbeten të nënshkruara, ndaj çdo person numërohet një herë edhe në grup. Lajmet nga grupi shënohen "të ndara" dhe nuk e rrisin besueshmërinë vetë.',
        'Largimi nga grupi ose fikja e serverit nuk fshin asgjë: çdo gjë e marrë mbetet në telefon.',
      ],
      en: [
        'A group lets several phones share reports and sources by themselves, without sending files. It is optional: the app works without it.',
        '1. Someone taps "Share" → "Create a group" and chooses where the server runs: on their own phone or on a server (VPS).',
        '2. Then they tap "Invite others" and send the code on Telegram, or let others scan it as a QR code.',
        '3. The others tap the code (or "Join with a code" and paste it). That is all.',
        'While the app is open, phones send and receive reports every minute. "Sync now" does it immediately.',
        '🔐 Everything is encrypted on the phone with the key inside the code. The server only stores unreadable data and deletes it after 72 hours. Share the code only with people you trust.',
        'People reports stay signed, so each person still counts once inside a group. News from the group is marked "shared" and does not raise trust on its own.',
        'Leaving the group or turning the server off deletes nothing: everything received stays on the phone.',
      ],
    },
  },
  {
    id: 'server',
    icon: '🖥️',
    title: { sq: 'Si të ngresh një server për grupin', en: 'How to set up a server for a group' },
    body: {
      sq: [
        'Mënyra më e lehtë — në telefonin tënd (vetëm Android): "Krijo grup" → "📱 Në këtë telefon". Punon për njerëz në të njëjtin Wi-Fi ose të lidhur me hotspot-in tënd, edhe pa internet. Del një njoftim; me "Ndalo" e fik. Android 15 e ndal vetë pas 6 orësh në ditë.',
        'Përmes internetit — në një VPS ose kompjuter me Node.js 18+:',
        '1. Shkarko skedarin server/relay.mjs nga faqja e projektit në GitHub.',
        '2. Nise: "node relay.mjs" (porta 8787). Ose me Docker: "docker run -d -p 8787:8787 -v protestat:/data ghcr.io/eri4/protestat-relay".',
        '3. Duhet një adresë https. Pa domain: "cloudflared tunnel --url http://localhost:8787" të jep falas një adresë https://….trycloudflare.com. Me domain: përdor docker-compose me Caddy nga dosja server/.',
        '4. Në aplikacion: "Krijo grup" → "🖥️ Në serverin tim" → ngjit adresën https.',
        'Serveri nuk ka llogari dhe nuk sheh përmbajtjen. Por sheh adresat IP të telefonave dhe kur lidhen: zgjidh me kujdes kush e mban.',
      ],
      en: [
        'Easiest — on your own phone (Android only): "Create a group" → "📱 On this phone". Works for people on the same Wi-Fi or connected to your hotspot, even without internet. A notification shows while it runs; "Stop" turns it off. Android 15 stops it after 6 hours a day.',
        'Over the internet — on a VPS or computer with Node.js 18+:',
        '1. Download server/relay.mjs from the project page on GitHub.',
        '2. Start it: "node relay.mjs" (port 8787). Or with Docker: "docker run -d -p 8787:8787 -v protestat:/data ghcr.io/eri4/protestat-relay".',
        '3. You need an https address. Without a domain: "cloudflared tunnel --url http://localhost:8787" gives you a free https://….trycloudflare.com address. With a domain: use the docker-compose with Caddy in the server/ folder.',
        '4. In the app: "Create a group" → "🖥️ On my server" → paste the https address.',
        'The server has no accounts and cannot see content. But it does see the phones\' IP addresses and when they connect: choose carefully who runs it.',
      ],
    },
  },
  {
    id: 'privacy',
    icon: '🔒',
    title: { sq: 'Privatësia dhe siguria', en: 'Privacy and safety' },
    body: {
      sq: [
        'Nuk njeh fytyra, nuk identifikon njerëz dhe nuk ndjek askënd.',
        'Tubimet shfaqen vetëm si zona të përafërta. Raportet e njerëzve rrumbullakohen në ~200 m.',
        '"Afër meje" e përdor vendndodhjen tënde vetëm një herë dhe nuk e ruan.',
        'Te Cilësimet: "Fshi të gjitha të dhënat" i heq të gjitha me një prekje.',
        'Mos raporto apo ndaj të dhëna që mund të vënë dikë në rrezik.',
      ],
      en: [
        'No face recognition, no identifying people, no tracking.',
        'Gatherings are only shown as approximate areas. People reports are rounded to ~200 m.',
        '"Near me" uses your location once and never stores it.',
        'In Settings: "Delete all data" removes everything with one tap.',
        'Do not report or share details that could put someone at risk.',
      ],
    },
  },
  {
    id: 'install',
    icon: '⬇️',
    title: { sq: 'Instalimi dhe përditësimi', en: 'Install and update' },
    body: {
      sq: [
        'Android: shkarko skedarin .apk nga faqja e projektit, hape, lejo instalimin herën e parë dhe prek "Instalo". Aplikacioni të njofton kur del një version i ri.',
        'iPhone: hap faqen në Safari → Ndaj ⬆️ → "Shto në ekranin bazë". Në iPhone lexohen vetëm disa burime, por mund të marrësh raporte nga të tjerët.',
      ],
      en: [
        'Android: download the .apk file from the project page, open it, allow installing the first time and tap "Install". The app tells you when a new version is out.',
        'iPhone: open the page in Safari → Share ⬆️ → "Add to Home Screen". Only a few sources can be read on iPhone, but you can receive reports from others.',
      ],
    },
  },
];
