/**
 * Story 3.2 — Lawful-access signal-detection unit tests (DoD-4 mutation kill).
 *
 * Directly exercises the heuristic detection helpers + the robots.txt parser
 * so their mutants are killed (the route-level integration tests stub the
 * fetcher, leaving the regex/parser mutants untested). These are behavioral
 * logic — paywall/login/CAPTCHA detection + robots parsing decide whether a
 * source may be crawled (defamation-adjacent T1 invariant).
 *
 * @rules FR-1.2, AC-1, AC-7
 */
import { describe, it, expect } from 'vitest';
import {
  detectPaywall,
  detectLoginForm,
  detectCaptcha,
  parseRobotsTxt,
  robotsTxtUrlFor,
} from './sources.js';

describe('detectPaywall', () => {
  it('detects Piano paywall scripts', () => {
    expect(detectPaywall('<script src="https://cdn.piano.io/xdomain/api.js"></script>')).toBe(true);
  });
  it('detects generic paywall class', () => {
    expect(detectPaywall('<div class="paywall-content">Subscribe to read</div>')).toBe(true);
  });
  it('detects subscription-block metered content', () => {
    expect(detectPaywall('<div data-metered-content>')).toBe(true);
  });
  it('returns false for a clean page', () => {
    expect(detectPaywall('<html><body><p>Public article</p></body></html>')).toBe(false);
  });
});

describe('detectLoginForm', () => {
  it('detects a password input', () => {
    expect(detectLoginForm('<form><input type="password" name="pw"></form>')).toBe(true);
  });
  it('detects a password input with single quotes', () => {
    expect(detectLoginForm("<input type='password' id='login'>")).toBe(true);
  });
  it('returns false when no password input exists', () => {
    expect(detectLoginForm('<form><input type="text" name="q"></form>')).toBe(false);
  });
});

describe('detectCaptcha', () => {
  it('detects Cloudflare Turnstile', () => {
    expect(detectCaptcha('<script src="https://challenges.cloudflare.com/turnstile/v0/api.js"></script>')).toBe(true);
  });
  it('detects ReCAPTCHA', () => {
    expect(detectCaptcha('<script src="https://www.google.com/recaptcha/api.js"></script>')).toBe(true);
  });
  it('detects DataDome', () => {
    expect(detectCaptcha('<script src="https://js.datadome.co/tags.js"></script>')).toBe(true);
  });
  it('returns false for a clean page', () => {
    expect(detectCaptcha('<html><body>public</body></html>')).toBe(false);
  });
});

describe('parseRobotsTxt', () => {
  it('allows when no User-agent:* group exists (empty = allow all)', () => {
    expect(parseRobotsTxt('', '/feed').allowed).toBe(true);
  });
  it('allows when User-agent:* has no Disallow', () => {
    expect(parseRobotsTxt('User-agent: *\nAllow: /', '/feed').allowed).toBe(true);
  });
  it('disallows on Disallow: / (root block)', () => {
    expect(parseRobotsTxt('User-agent: *\nDisallow: /', '/feed').allowed).toBe(false);
  });
  it('disallows when the source path is under a Disallow rule', () => {
    expect(parseRobotsTxt('User-agent: *\nDisallow: /private', '/private/feed').allowed).toBe(false);
  });
  it('parses Crawl-delay for User-agent:*', () => {
    const result = parseRobotsTxt('User-agent: *\nCrawl-delay: 5', '/feed');
    expect(result.crawlDelayMs).toBe(5000);
  });
  it('returns null crawlDelayMs when absent', () => {
    expect(parseRobotsTxt('User-agent: *\nAllow: /', '/feed').crawlDelayMs).toBeNull();
  });
  it('handles comments (#) inline', () => {
    expect(parseRobotsTxt('User-agent: * # star\nDisallow: / # block', '/feed').allowed).toBe(false);
  });
});

describe('robotsTxtUrlFor', () => {
  it('derives the origin robots.txt URL', () => {
    expect(robotsTxtUrlFor('https://example.com/path/feed')).toBe('https://example.com/robots.txt');
  });
  it('returns null for an invalid URL', () => {
    expect(robotsTxtUrlFor('not-a-url')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// createDefaultSignalFetcher — behavioral coverage of the fetch+parse pipeline
// ─────────────────────────────────────────────────────────────────────────────

import { createDefaultSignalFetcher } from './sources.js';

/** A controllable fetch stub returning canned responses per URL. */
function makeFetchStub(responses: {
  robots?: { ok: boolean; body: string };
  page?: { ok: boolean; body: string };
}): typeof fetch {
  return (async (url: unknown) => {
    const u = String(url);
    if (u.endsWith('/robots.txt')) {
      const r = responses.robots;
      if (r === undefined) throw new Error('robots fetch failed');
      return { ok: r.ok, status: r.ok ? 200 : 500, text: async () => r.body } as unknown as Response;
    }
    const p = responses.page;
    if (p === undefined) throw new Error('page fetch failed');
    return { ok: p.ok, status: p.ok ? 200 : 500, text: async () => p.body } as unknown as Response;
  }) as typeof fetch;
}

describe('createDefaultSignalFetcher', () => {
  it('returns allowed when robots.txt allows + page is clean', async () => {
    const fetcher = createDefaultSignalFetcher(
      makeFetchStub({
        robots: { ok: true, body: 'User-agent: *\nAllow: /' },
        page: { ok: true, body: '<html>clean</html>' },
      }),
    );
    const signals = await fetcher('https://example.com/feed', 1000);
    expect(signals.robotsStatus).toBe('allowed');
    expect(signals.robotsAllowed).toBe(true);
    expect(signals.paywallDetected).toBe(false);
  });

  it('returns disallowed when robots.txt blocks the path', async () => {
    const fetcher = createDefaultSignalFetcher(
      makeFetchStub({
        robots: { ok: true, body: 'User-agent: *\nDisallow: /private' },
        page: { ok: true, body: '<html>clean</html>' },
      }),
    );
    const signals = await fetcher('https://example.com/private/feed', 1000);
    expect(signals.robotsStatus).toBe('disallowed');
    expect(signals.robotsAllowed).toBe(false);
  });

  it('returns unreachable when robots.txt fetch throws (AC-7 fail-closed)', async () => {
    const fetcher = createDefaultSignalFetcher(
      makeFetchStub({ page: { ok: true, body: '<html>clean</html>' } }),
    );
    const signals = await fetcher('https://example.com/feed', 1000);
    expect(signals.robotsStatus).toBe('unreachable');
    expect(signals.robotsAllowed).toBe(false);
    expect(signals.robotsTxtContent).toBeNull();
  });

  it('returns unreachable when robots.txt responds non-2xx', async () => {
    const fetcher = createDefaultSignalFetcher(
      makeFetchStub({
        robots: { ok: false, body: '' },
        page: { ok: true, body: '<html>clean</html>' },
      }),
    );
    const signals = await fetcher('https://example.com/feed', 1000);
    expect(signals.robotsStatus).toBe('unreachable');
  });

  it('detects paywall on the landing page', async () => {
    const fetcher = createDefaultSignalFetcher(
      makeFetchStub({
        robots: { ok: true, body: 'User-agent: *\nAllow: /' },
        page: { ok: true, body: '<script src="piano.js"></script>' },
      }),
    );
    const signals = await fetcher('https://example.com/feed', 1000);
    expect(signals.paywallDetected).toBe(true);
  });

  it('detects login form on the landing page', async () => {
    const fetcher = createDefaultSignalFetcher(
      makeFetchStub({
        robots: { ok: true, body: 'User-agent: *\nAllow: /' },
        page: { ok: true, body: '<input type="password" name="pw">' },
      }),
    );
    const signals = await fetcher('https://example.com/feed', 1000);
    expect(signals.loginRequired).toBe(true);
  });

  it('detects CAPTCHA on the landing page', async () => {
    const fetcher = createDefaultSignalFetcher(
      makeFetchStub({
        robots: { ok: true, body: 'User-agent: *\nAllow: /' },
        page: { ok: true, body: '<script src="https://www.google.com/recaptcha/api.js"></script>' },
      }),
    );
    const signals = await fetcher('https://example.com/feed', 1000);
    expect(signals.captchaRequired).toBe(true);
  });

  it('defaults scan booleans false when the landing page fetch fails', async () => {
    const fetcher = createDefaultSignalFetcher(
      makeFetchStub({ robots: { ok: true, body: 'User-agent: *\nAllow: /' } }),
    );
    const signals = await fetcher('https://example.com/feed', 1000);
    expect(signals.paywallDetected).toBe(false);
    expect(signals.loginRequired).toBe(false);
    expect(signals.captchaRequired).toBe(false);
  });

  it('defaults scan booleans false when the landing page responds non-2xx', async () => {
    const fetcher = createDefaultSignalFetcher(
      makeFetchStub({
        robots: { ok: true, body: 'User-agent: *\nAllow: /' },
        page: { ok: false, body: '' },
      }),
    );
    const signals = await fetcher('https://example.com/feed', 1000);
    expect(signals.paywallDetected).toBe(false);
  });

  it('parses Crawl-delay from robots.txt', async () => {
    const fetcher = createDefaultSignalFetcher(
      makeFetchStub({
        robots: { ok: true, body: 'User-agent: *\nCrawl-delay: 3' },
        page: { ok: true, body: '<html>clean</html>' },
      }),
    );
    const signals = await fetcher('https://example.com/feed', 1000);
    expect(signals.robotsCrawlDelayMs).toBe(3000);
  });
});
