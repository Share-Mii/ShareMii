import { describe, expect, it } from 'vitest';
import { buildMiiShareUrl, buildProfileShareUrl } from '@/utils/share';

describe('share urls', () => {
  it('builds clean path routes for miis and profiles', () => {
    expect(buildMiiShareUrl('550e8400-e29b-41d4-a716-446655440000')).toContain(
      '/mii/550e8400-e29b-41d4-a716-446655440000',
    );
    expect(buildProfileShareUrl('MarioFan')).toContain('/u/MarioFan');
  });
});
