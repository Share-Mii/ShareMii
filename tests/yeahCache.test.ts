import { describe, expect, it, beforeEach } from 'vitest';
import {
  getYeahedIds,
  isYeahedLocally,
  setYeahedLocally,
  migrateLegacyYeahStorage,
} from '@/utils/yeahCache';

describe('yeahCache', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('tracks yeah state locally', () => {
    expect(isYeahedLocally('abc')).toBe(false);
    setYeahedLocally('abc', true);
    expect(isYeahedLocally('abc')).toBe(true);
    setYeahedLocally('abc', false);
    expect(isYeahedLocally('abc')).toBe(false);
  });

  it('migrates legacy favorites key', () => {
    localStorage.setItem('sharemii:favorites', JSON.stringify(['legacy-id']));
    migrateLegacyYeahStorage();
    expect(getYeahedIds().has('legacy-id')).toBe(true);
    expect(localStorage.getItem('sharemii:favorites')).toBeNull();
  });
});
