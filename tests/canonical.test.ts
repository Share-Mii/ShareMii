import { describe, expect, it } from 'vitest';
import {
  CANONICAL_ORIGIN,
  canonicalOrigin,
  canonicalRedirectResponse,
} from '../worker/http/canonical';

describe('canonical redirects', () => {
  it('redirects http to https apex', () => {
    const res = canonicalRedirectResponse(
      new Request('http://sharemii.net/browse?q=test'),
    );
    expect(res?.status).toBe(301);
    expect(res?.headers.get('Location')).toBe(
      'https://sharemii.net/browse?q=test',
    );
  });

  it('redirects www to apex', () => {
    const res = canonicalRedirectResponse(
      new Request('https://www.sharemii.net/mii/abc'),
    );
    expect(res?.status).toBe(301);
    expect(res?.headers.get('Location')).toBe('https://sharemii.net/mii/abc');
  });

  it('leaves canonical https apex alone', () => {
    expect(
      canonicalRedirectResponse(new Request('https://sharemii.net/create')),
    ).toBeNull();
  });

  it('normalizes production origin', () => {
    expect(
      canonicalOrigin(new Request('http://www.sharemii.net/browse')),
    ).toBe(CANONICAL_ORIGIN);
    expect(canonicalOrigin(new Request('http://localhost:5173/'))).toBe(
      'http://localhost:5173',
    );
  });
});
