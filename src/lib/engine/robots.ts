// Minimal robots.txt reader (RFC 9309): the rules in the "User-agent: *" group(s) decide.
// The longest matching rule wins; on a tie, Allow wins. "*" is a wildcard, a trailing "$" anchors the end.

function toRegExp(pattern: string): RegExp {
  const anchored = pattern.endsWith('$');
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp(`^${body}${anchored ? '$' : ''}`);
}

interface Group {
  agents: string[];
  rules: { allow: boolean; path: string }[];
}

export function parseRobots(txt: string): Group[] {
  const groups: Group[] = [];
  let cur: Group | null = null;
  let lastWasAgent = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === 'user-agent') {
      if (!lastWasAgent || !cur) {
        cur = { agents: [], rules: [] };
        groups.push(cur);
      }
      cur.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (cur && (key === 'allow' || key === 'disallow') && value) cur.rules.push({ allow: key === 'allow', path: value });
    }
  }
  return groups;
}

/** True when robots.txt forbids generic crawlers from fetching this path (e.g. "/feed/"). */
export function isDisallowed(robotsTxt: string, pathAndQuery: string): boolean {
  if (!robotsTxt || /<html/i.test(robotsTxt.slice(0, 500))) return false;
  let best: { allow: boolean; path: string } | null = null;
  for (const g of parseRobots(robotsTxt)) {
    if (!g.agents.includes('*')) continue;
    for (const r of g.rules) {
      if (!toRegExp(r.path).test(pathAndQuery)) continue;
      if (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow)) best = r;
    }
  }
  return !!best && !best.allow;
}
