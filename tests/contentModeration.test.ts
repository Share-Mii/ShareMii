import { describe, expect, it } from 'vitest';
import {
  quickTextPolicyFailReason,
  textContainsUrl,
} from '@/utils/contentModeration';

describe('contentModeration', () => {
  it('detects URLs and domains', () => {
    expect(textContainsUrl('check https://x.com/foo')).toBe(true);
    expect(textContainsUrl('visit example.com')).toBe(true);
    expect(quickTextPolicyFailReason('go to site.net')).not.toBeNull();
  });

  it('allows normal chat without links', () => {
    expect(textContainsUrl('this is BS but allowed')).toBe(false);
    expect(quickTextPolicyFailReason('what the heck')).toBeNull();
  });
});
