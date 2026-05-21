import { describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';

/**
 * Optional integration probe: set in .env.local and run `npm test`:
 *   VITE_SUPABASE_URL=...
 *   VITE_SUPABASE_ANON_KEY=...
 *   SUPABASE_RLS_TEST_COLLECTION_ID=<public collection uuid that contains a non-public Mii row>
 *
 * If the anon key cannot read hidden Miis, every embedded `miis.visible` row must not be hidden/removed.
 * Skipped when the collection id is unset (CI / local default).
 */
const collectionId = process.env.SUPABASE_RLS_TEST_COLLECTION_ID;
const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

const shouldRun = Boolean(collectionId && url && anonKey);
const describeProbe = shouldRun ? describe : describe.skip;

describeProbe('RLS: collection item embed (anon)', () => {
  it('does not expose non-public Miis through mii_collection_items → miis', async () => {
    const client = createClient(url!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client
      .from('mii_collection_items')
      .select('mii_id, miis(id, visibility)')
      .eq('collection_id', collectionId!)
      .limit(50);

    if (error) {
      throw new Error(error.message);
    }
    expect(data).toBeTruthy();
    for (const row of data ?? []) {
      const m = row.miis as
        | { id: string; visibility: string }
        | { id: string; visibility: string }[]
        | null
        | undefined;
      const mii = Array.isArray(m) ? m[0] : m;
      if (!mii) continue;
      expect(
        mii.visibility,
        `leaked visibility for mii ${mii.id}`,
      ).toBe('public');
    }
  });
});
