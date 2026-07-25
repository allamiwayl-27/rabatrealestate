import { describe, it, expect, vi } from 'vitest';

function makeMockPool(rows = [], total = 0) {
  let callNum = 0;
  return {
    query: vi.fn(async (sql) => {
      callNum++;
      if (String(sql).includes('COUNT(*)::int AS total') && !String(sql).includes('final_rows')) {
        return { rows: [{ total }] };
      }
      return { rows };
    }),
  };
}

const DB_TABLES = {
  annonces: 'annonces',
  localisations: 'localisations',
  contacts: 'contacts',
};

describe('prices.js — getPrices', () => {
  it('returns price analytics for vente', async () => {
    const pool = makeMockPool([
      { district: 'Agdal', statut: 'vente', property_type: 'Appartement', segment_scope: 'typed', nb_annonces: 50, surface_moyenne: 85, prix_moyen: 1200000, prix_m2_moyen: 14118, prix_m2_min: 8000, prix_m2_max: 25000, last_month_samples: 20, prev_month_samples: 18, variation_pct: 3.5 }
    ]);
    const normalize = (v) => (v == null ? '' : String(v)).trim().toLowerCase();
    const expandLocationTerms = (v) => [v];
    const makePrices = (await import('../../src/backend/prices.js')).default;
    const getPrices = makePrices({ pool, DB_TABLES, normalize, expandLocationTerms });
    const result = await getPrices(new URLSearchParams({ transaction: 'Vente', location: 'agdal', benchmarkMode: 'typed' }));
    expect(result.data).toBeDefined();
    expect(result.meta).toBeDefined();
  });

  it('handles Location transaction', async () => {
    const pool = makeMockPool([
      { district: 'Agdal', statut: 'location', property_type: 'Tous types', segment_scope: 'minimal', nb_annonces: 10, surface_moyenne: 60, prix_moyen: 5000, prix_m2_moyen: 83, prix_m2_min: 50, prix_m2_max: 150, last_month_samples: 0, prev_month_samples: 0, variation_pct: 0 }
    ]);
    const normalize = (v) => (v == null ? '' : String(v)).trim().toLowerCase();
    const expandLocationTerms = (v) => [v];
    const makePrices = (await import('../../src/backend/prices.js')).default;
    const getPrices = makePrices({ pool, DB_TABLES, normalize, expandLocationTerms });
    const result = await getPrices(new URLSearchParams({ transaction: 'Location' }));
    expect(result.data).toBeDefined();
  });

  it('handles Achat transaction (same as Vente)', async () => {
    const pool = makeMockPool([]);
    pool.query = vi.fn(async (sql) => {
      if (String(sql).includes('COUNT(*)::int AS total') && !String(sql).includes('final_rows')) {
        return { rows: [{ total: 0 }] };
      }
      return { rows: [] };
    });
    const normalize = (v) => (v == null ? '' : String(v)).trim().toLowerCase();
    const expandLocationTerms = (v) => [v];
    const makePrices = (await import('../../src/backend/prices.js')).default;
    const getPrices = makePrices({ pool, DB_TABLES, normalize, expandLocationTerms });
    const result = await getPrices(new URLSearchParams({ transaction: 'Achat' }));
    expect(result.data).toEqual([]);
  });

  it('filters by propertyType', async () => {
    const pool = makeMockPool([]);
    pool.query = vi.fn(async (sql) => {
      if (String(sql).includes('COUNT(*)::int AS total') && !String(sql).includes('final_rows')) {
        return { rows: [{ total: 0 }] };
      }
      return { rows: [] };
    });
    const normalize = (v) => (v == null ? '' : String(v)).trim().toLowerCase();
    const expandLocationTerms = (v) => [v];
    const makePrices = (await import('../../src/backend/prices.js')).default;
    const getPrices = makePrices({ pool, DB_TABLES, normalize, expandLocationTerms });
    const result = await getPrices(new URLSearchParams({ propertyType: 'Villa' }));
    expect(result.data).toEqual([]);
  });

  it('filters by agency', async () => {
    const pool = makeMockPool([]);
    pool.query = vi.fn(async (sql) => {
      if (String(sql).includes('COUNT(*)::int AS total') && !String(sql).includes('final_rows')) {
        return { rows: [{ total: 0 }] };
      }
      return { rows: [] };
    });
    const normalize = (v) => (v == null ? '' : String(v)).trim().toLowerCase();
    const expandLocationTerms = (v) => [v];
    const makePrices = (await import('../../src/backend/prices.js')).default;
    const getPrices = makePrices({ pool, DB_TABLES, normalize, expandLocationTerms });
    const result = await getPrices(new URLSearchParams({ agency: 'Immo Plus' }));
    expect(result.data).toEqual([]);
  });

  it('filters by priceMin and priceMax', async () => {
    const pool = makeMockPool([]);
    pool.query = vi.fn(async (sql) => {
      if (String(sql).includes('COUNT(*)::int AS total') && !String(sql).includes('final_rows')) {
        return { rows: [{ total: 0 }] };
      }
      return { rows: [] };
    });
    const normalize = (v) => (v == null ? '' : String(v)).trim().toLowerCase();
    const expandLocationTerms = (v) => [v];
    const makePrices = (await import('../../src/backend/prices.js')).default;
    const getPrices = makePrices({ pool, DB_TABLES, normalize, expandLocationTerms });
    const result = await getPrices(new URLSearchParams({ priceMin: '500000', priceMax: '2000000' }));
    expect(result.data).toEqual([]);
  });

  it('benchmarkMode fallback filters', async () => {
    const pool = makeMockPool([
      { district: 'Agdal', statut: 'vente', property_type: 'Tous types', segment_scope: 'fallback', nb_annonces: 10, surface_moyenne: 80, prix_moyen: 1000000, prix_m2_moyen: 12500, prix_m2_min: 8000, prix_m2_max: 20000, last_month_samples: 0, prev_month_samples: 0, variation_pct: 0 }
    ]);
    const normalize = (v) => (v == null ? '' : String(v)).trim().toLowerCase();
    const expandLocationTerms = (v) => [v];
    const makePrices = (await import('../../src/backend/prices.js')).default;
    const getPrices = makePrices({ pool, DB_TABLES, normalize, expandLocationTerms });
    const result = await getPrices(new URLSearchParams({ benchmarkMode: 'fallback' }));
    expect(result.data).toHaveLength(1);
    expect(result.data[0].scope).toBe('fallback');
  });

  it('benchmarkMode auto returns all', async () => {
    const pool = makeMockPool([
      { district: 'Agdal', statut: 'vente', property_type: 'Appartement', segment_scope: 'typed', nb_annonces: 50, surface_moyenne: 85, prix_moyen: 1200000, prix_m2_moyen: 14118, prix_m2_min: 8000, prix_m2_max: 25000, last_month_samples: 20, prev_month_samples: 18, variation_pct: 3.5 },
      { district: 'Hassan', statut: 'vente', property_type: 'Tous types', segment_scope: 'minimal', nb_annonces: 3, surface_moyenne: 70, prix_moyen: 900000, prix_m2_moyen: 12857, prix_m2_min: 9000, prix_m2_max: 18000, last_month_samples: 0, prev_month_samples: 0, variation_pct: 0 }
    ]);
    const normalize = (v) => (v == null ? '' : String(v)).trim().toLowerCase();
    const expandLocationTerms = (v) => [v];
    const makePrices = (await import('../../src/backend/prices.js')).default;
    const getPrices = makePrices({ pool, DB_TABLES, normalize, expandLocationTerms });
    const result = await getPrices(new URLSearchParams({ benchmarkMode: 'auto' }));
    expect(result.data).toHaveLength(2);
  });

  it('handles invalid benchmarkMode', async () => {
    const pool = makeMockPool([]);
    pool.query = vi.fn(async (sql) => {
      if (String(sql).includes('COUNT(*)::int AS total') && !String(sql).includes('final_rows')) {
        return { rows: [{ total: 0 }] };
      }
      return { rows: [] };
    });
    const normalize = (v) => (v == null ? '' : String(v)).trim().toLowerCase();
    const expandLocationTerms = (v) => [v];
    const makePrices = (await import('../../src/backend/prices.js')).default;
    const getPrices = makePrices({ pool, DB_TABLES, normalize, expandLocationTerms });
    const result = await getPrices(new URLSearchParams({ benchmarkMode: 'invalid' }));
    expect(result.data).toEqual([]);
  });

  it('formats trend with + sign for positive', async () => {
    const pool = makeMockPool([
      { district: 'Test', statut: 'vente', property_type: 'Tous types', segment_scope: 'minimal', nb_annonces: 1, surface_moyenne: 50, prix_moyen: 500000, prix_m2_moyen: 10000, prix_m2_min: 10000, prix_m2_max: 10000, last_month_samples: 0, prev_month_samples: 0, variation_pct: 5.5 }
    ]);
    const normalize = (v) => (v == null ? '' : String(v)).trim().toLowerCase();
    const expandLocationTerms = (v) => [v];
    const makePrices = (await import('../../src/backend/prices.js')).default;
    const getPrices = makePrices({ pool, DB_TABLES, normalize, expandLocationTerms });
    const result = await getPrices(new URLSearchParams({}));
    expect(result.data[0].trend).toContain('+');
  });

  it('formats negative trend without +', async () => {
    const pool = makeMockPool([
      { district: 'Test', statut: 'vente', property_type: 'Tous types', segment_scope: 'minimal', nb_annonces: 1, surface_moyenne: 50, prix_moyen: 500000, prix_m2_moyen: 10000, prix_m2_min: 10000, prix_m2_max: 10000, last_month_samples: 0, prev_month_samples: 0, variation_pct: -3.2 }
    ]);
    const normalize = (v) => (v == null ? '' : String(v)).trim().toLowerCase();
    const expandLocationTerms = (v) => [v];
    const makePrices = (await import('../../src/backend/prices.js')).default;
    const getPrices = makePrices({ pool, DB_TABLES, normalize, expandLocationTerms });
    const result = await getPrices(new URLSearchParams({}));
    expect(result.data[0].trend).not.toContain('+');
    expect(result.data[0].trend).toContain('-3.2');
  });
});
