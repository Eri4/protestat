import { describe, expect, it } from 'vitest';
import { isDisallowed } from '../src/lib/engine/robots';

describe('robots.txt', () => {
  it('reads wildcard rules correctly (a /*?x rule does not block everything)', () => {
    const txt = 'User-agent: *\nDisallow: /wp-admin/\nDisallow: /*?vp_ad_preview=\n';
    expect(isDisallowed(txt, '/feed/')).toBe(false);
    expect(isDisallowed(txt, '/news?vp_ad_preview=1')).toBe(true);
  });
  it('blocks a feed under a disallowed path (Radio Evropa e Lirë /api/*)', () => {
    const txt = 'User-agent: *\nDisallow: /api/*\n\nUser-agent: AhrefsBot\nDisallow: /\n';
    expect(isDisallowed(txt, '/api/zkmiol-vomx-tpej-mp')).toBe(true);
    expect(isDisallowed(txt, '/feed/')).toBe(false);
  });
  it('ignores rules for other bots', () => {
    expect(isDisallowed('User-agent: ClaudeBot\nDisallow: /\n\nUser-agent: GPTBot\nDisallow: /\n', '/feed/')).toBe(false);
  });
  it('handles grouped agents and allow overrides', () => {
    expect(isDisallowed('User-agent: foo\nUser-agent: *\nDisallow: /\n', '/feed/')).toBe(true);
    expect(isDisallowed('User-agent: *\nDisallow: /\nAllow: /feed/\n', '/feed/')).toBe(false);
  });
  it('treats an HTML error page as no robots.txt', () => {
    expect(isDisallowed('<html><body>404</body></html>', '/feed/')).toBe(false);
  });
});
