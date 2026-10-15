import type { Category, SourceKind } from '../model/types';
import { fold } from '../geo/gazetteer';

// Keyword rules on folded text (ë→e, ç→c, lower case). Albanian stems first, then English.
// Order matters: the first matching category wins.
const RULES: [Category, RegExp][] = [
  [
    'demonstration',
    /\bprotest|\btubim|\bmarshim|\bdemonstrat|\bgrev[eaes]\b|\bbojkot|\bgaz(?:i)? lotsjell|\bstudentet? .*(?:rruge|shesh)|\brally\b|\bmarch(?:ed|ers)?\b|\bsit-in\b/,
  ],
  [
    'road-closure',
    /\bbllok(?:im|uar|ojne|ohet|uan|on)\b.*\brrug|\brrug\w* .*\bbllok|\bmbyll\w* (?:e )?rrug|\brrug\w* (?:e )?mbyll|\bdevijim|\bqarkullim\w* (?:i |te )?(?:kufizuar|ndaluar|bllokuar)|\broad(?:s)? (?:closed|blocked)|\bclosure\b/,
  ],
  [
    'emergency',
    /\bzjarr|\bshperthim|\bshperth|\bplagos|\bte plagosur|\bevakuim|\bevakuo|\bambulanc|\bshemb|\bfire\b|\bexplosion|\binjured|\bevacuat/,
  ],
  [
    'hazard',
    /\btermet|\blekund(?:je|ja) sizmik|\bpermbyt|\bstuhi|\breshje te dendura|\brreshqitje|\bmoti i keq|\bearthquake|\bflood|\bstorm\b|\blandslide/,
  ],
  ['traffic', /\baksident|\bperplas|\btrafik|\bmakine u|\bautomjet|\baccident|\bcrash|\btraffic\b/],
  [
    'police-presence',
    /\bpostbllo[kq]|\bpika (?:e )?kontroll|\bkordon\w* (?:e |i )?polic|\bforca (?:te |e )?(?:shumta )?polic|\bpolic\w* ne terren|\bcheckpoint|\bpolice (?:cordon|presence)/,
  ],
  // A police notice must actually involve the police; "arrest" alone also appears in political news.
  ['police-notice', /\bpolici|\bpolice\b/],
  // "Official notice" comes only from official sources (see below): news that merely mentions
  // the government is not an official notice.
];

const DENIAL =
  /\bnuk (?:eshte|esht) e vertete|\blajm(?:e)? (?:i|te) rreme|\bpergenjeshtr|\bdemant|\bmohon\b|\bfake news|\bnot true|\bis false\b|\bfalse claim|\bdebunk|\bmanipul(?:uar|im)/;

// Sports news uses words like "fitore", "sulm" or "Arena" that look like other categories.
const SPORTS =
  /\bndeshj|\bkampionat|\bsuperlig|\bliga e (?:konferences|kampioneve|evropes)|\bligen e (?:konferences|kampioneve|evropes)|\bconference league|\beuropa league|\bchampions league|\bfutboll|\bbasketboll|\btrajner|\bstadium|\barena\b|\btifoz|\bgolin?\b|\bpenallt|\bmondial|\b\d{1,2}\s?-\s?\d{1,2}\b.*\b(?:fitore|barazim|humbje|perfundoi)|\b(?:fitore|barazim|humbje|humbjes)\b.*\b\d{1,2}\s?-\s?\d{1,2}\b/;

export function classify(text: string, sourceKind: SourceKind): Category {
  const f = fold(text);
  if (SPORTS.test(f)) return 'other';
  for (const [cat, re] of RULES) if (re.test(f)) return cat;
  if (sourceKind === 'police') return 'police-notice';
  if (sourceKind === 'official') return 'official-notice';
  if (sourceKind === 'hazard') return 'hazard';
  return 'other';
}

export const isDenial = (text: string) => DENIAL.test(fold(text));
