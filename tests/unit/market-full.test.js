import { describe, it, expect, vi } from 'vitest';

const DB_TABLES = {
  annonces: 'annonces', localisations: 'localisations', caracteristiques: 'caracteristiques',
  contacts: 'contacts', images: 'images', annonceEquipements: 'annonce_equipements',
  equipements: 'equipements', historiquePrix: 'historique_prix', quartiers: 'quartiers',
  users: 'users', leads: 'leads', publicUsers: 'public_users',
  savedListings: 'saved_listings', savedSearches: 'saved_searches',
  savedEstimations: 'saved_estimations', articlesBlog: 'articles_blog',
  agencies: 'agencies', newsletterSubscribers: 'newsletter_subscribers',
  contactMessages: 'contact_messages',
};

function poolReturning(rows) {
  return { query: vi.fn(async () => ({ rows })) };
}

function poolSequence(...rowsArray) {
  let i = 0;
  return { query: vi.fn(async () => ({ rows: rowsArray[Math.min(i++, rowsArray.length - 1)] })) };
}

async function getMarket(pool) {
  const makeMarket = (await import('../../src/backend/market.js')).default;
  return makeMarket({ pool, DB_TABLES });
}

describe('market.js — getPriceTrendsByQuarter', () => {
  it('returns data with pagination (status vente)', async () => {
    const pool = poolSequence(
      [{ total: 1 }],
      [{ district: 'Agdal', ville: 'Rabat', status: 'vente', latest_month: '2025-01-01', latest_price_m2: 15000, previous_price_m2: 14000, latest_samples: 10, previous_samples: 10, variation_pct: 7.1 }]
    );
    const market = await getMarket(pool);
    const result = await market.getPriceTrendsByQuarter(new URLSearchParams({ status: 'vente', months: '6' }));
    expect(result.data).toHaveLength(1);
    expect(result.data[0].district).toBe('Agdal');
    expect(result.data[0].variationPct).toBe(7.1);
    expect(result.meta).toBeDefined();
  });

  it('defaults to status all (empty result)', async () => {
    const pool = poolSequence([], []);
    const market = await getMarket(pool);
    const result = await market.getPriceTrendsByQuarter(new URLSearchParams({}));
    expect(result.data).toEqual([]);
  });

  it('clamps months between 3 and 36', async () => {
    const pool = poolSequence([{ total: 0 }], []);
    const market = await getMarket(pool);
    await market.getPriceTrendsByQuarter(new URLSearchParams({ months: '100' }));
    expect(pool.query.mock.calls[0][1][0]).toBe(36);
  });
});

describe('market.js — getMarketHeatmap', () => {
  it('returns parsed heatmap data (JSON string)', async () => {
    const pool = poolReturning([{ result: JSON.stringify([{ district: 'Agdal', score: 85 }]) }]);
    const market = await getMarket(pool);
    const result = await market.getMarketHeatmap(new URLSearchParams({}));
    expect(result.data).toEqual([{ district: 'Agdal', score: 85 }]);
  });

  it('handles non-string (already object) result', async () => {
    const pool = poolReturning([{ result: [{ district: 'Agdal', score: 85 }] }]);
    const market = await getMarket(pool);
    const result = await market.getMarketHeatmap(new URLSearchParams({}));
    expect(result.data).toHaveLength(1);
  });
});

describe('market.js — getComparables', () => {
  it('throws for missing listingId', async () => {
    const market = await getMarket(poolReturning([]));
    await expect(market.getComparables(new URLSearchParams({}))).rejects.toThrow('listingId est requis');
  });

  it('throws for listingId 0', async () => {
    const market = await getMarket(poolReturning([]));
    await expect(market.getComparables(new URLSearchParams({ listingId: '0' }))).rejects.toThrow('listingId est requis');
  });

  it('throws 404 when target not found', async () => {
    const pool = poolReturning([]);
    const market = await getMarket(pool);
    await expect(market.getComparables(new URLSearchParams({ listingId: '99999' }))).rejects.toThrow('Annonce cible introuvable');
  });

  it('returns comparables for valid listing', async () => {
    const pool = poolSequence(
      [{ id: 1, statut: 'vente', type_bien_raw: 'appartement', price: 1000000, surface: 80, price_m2: 12500, district: 'Agdal' }],
      [{ id: 2, title: 'Appartement Agdal', statut: 'vente', district: 'Agdal', price: 950000, surface: 75, price_m2: 12667, surface_diff_ratio: 0.05, price_m2_diff_ratio: 0.013, similarity_score: 0.032 }]
    );
    const market = await getMarket(pool);
    const result = await market.getComparables(new URLSearchParams({ listingId: '1' }));
    expect(result.target.id).toBe(1);
    expect(result.comparables).toHaveLength(1);
  });
});

describe('market.js — getInvestorAlerts', () => {
  it('returns investor alerts', async () => {
    const pool = poolSequence(
      [{ total: 1 }],
      [{ id: 1, title: 'Good deal', statut: 'vente', district: 'Agdal', property_type: 'Appartement', price: 800000, surface: 80, price_m2: 10000, segment_avg_price_m2: 15000, segment_median_price_m2: 14500, sample_size: 20, delta_vs_avg_pct: -33.3, delta_vs_median_pct: -31, url: 'http://test.com', date_publication: '2025-01-01', alert_level: 'Opportunite forte' }]
    );
    const market = await getMarket(pool);
    const result = await market.getInvestorAlerts(new URLSearchParams({ status: 'vente' }));
    expect(result.data).toHaveLength(1);
    expect(result.data[0].alertLevel).toBe('Opportunite forte');
  });

  it('handles status all', async () => {
    const pool = poolSequence([{ total: 0 }], []);
    const market = await getMarket(pool);
    const result = await market.getInvestorAlerts(new URLSearchParams({ status: 'all' }));
    expect(result.data).toEqual([]);
  });
});

describe('market.js — getQuartierComparison', () => {
  it('throws when q1 missing', async () => {
    const market = await getMarket(poolReturning([]));
    await expect(market.getQuartierComparison(new URLSearchParams({ q2: 'Hassan' }))).rejects.toThrow('q1 et q2 sont requis');
  });

  it('throws when q2 missing', async () => {
    const market = await getMarket(poolReturning([]));
    await expect(market.getQuartierComparison(new URLSearchParams({ q1: 'Agdal' }))).rejects.toThrow('q1 et q2 sont requis');
  });

  it('returns comparison data', async () => {
    const pool = poolReturning([
      { district: 'Agdal', ville: 'Rabat', statut: 'vente', listings_count: 50, avg_price_m2: 15000, median_price_m2: 14500, p25_price_m2: 12000, p75_price_m2: 17000, avg_surface: 85, volatility_pct: 5.2, computed_at: '2025-01-01' }
    ]);
    const market = await getMarket(pool);
    const result = await market.getQuartierComparison(new URLSearchParams({ q1: 'Agdal', q2: 'Hassan' }));
    expect(result.data).toHaveLength(1);
    expect(result.data[0].avgPriceM2).toBe(15000);
  });
});

describe('market.js — getRentalYield', () => {
  it('returns all yield data', async () => {
    const pool = poolReturning([
      { district: 'Agdal', ville: 'Rabat', sale_price_m2: 15000, rent_price_m2: 120, sale_count: 50, rent_count: 30, gross_yield_pct: 9.6, computed_at: '2025-01-01' }
    ]);
    const market = await getMarket(pool);
    const result = await market.getRentalYield(new URLSearchParams({}));
    expect(result.data).toHaveLength(1);
    expect(result.data[0].grossYieldPct).toBe(9.6);
  });

  it('filters by quartier', async () => {
    const market = await getMarket(poolReturning([]));
    const result = await market.getRentalYield(new URLSearchParams({ quartier: 'Agdal' }));
    expect(result.data).toEqual([]);
  });

  it('handles null gross_yield_pct', async () => {
    const pool = poolReturning([
      { district: 'Test', ville: 'Rabat', sale_price_m2: 10000, rent_price_m2: 80, sale_count: 10, rent_count: 5, gross_yield_pct: null, computed_at: null }
    ]);
    const market = await getMarket(pool);
    const result = await market.getRentalYield(new URLSearchParams({}));
    expect(result.data[0].grossYieldPct).toBeNull();
  });
});

describe('market.js — getLiquidity', () => {
  it('returns all liquidity data', async () => {
    const pool = poolReturning([
      { district: 'Agdal', statut: 'vente', active_listings: 100, exited_30d: 20, turnover_rate_pct: 20, months_of_inventory: 5, liquidity_label: 'Correct', computed_at: '2025-01-01' }
    ]);
    const market = await getMarket(pool);
    const result = await market.getLiquidity(new URLSearchParams({}));
    expect(result.data).toHaveLength(1);
    expect(result.data[0].turnoverRatePct).toBe(20);
  });

  it('filters by quartier', async () => {
    const pool = poolReturning([
      { district: 'Agdal', statut: 'vente', active_listings: 50, exited_30d: 10, turnover_rate_pct: 20, months_of_inventory: 5, liquidity_label: 'Correct', computed_at: null }
    ]);
    const market = await getMarket(pool);
    const result = await market.getLiquidity(new URLSearchParams({ quartier: 'Agdal' }));
    expect(result.data).toHaveLength(1);
  });

  it('handles null months_of_inventory', async () => {
    const pool = poolReturning([
      { district: 'Test', statut: 'location', active_listings: 10, exited_30d: 2, turnover_rate_pct: 20, months_of_inventory: null, liquidity_label: 'N/A', computed_at: null }
    ]);
    const market = await getMarket(pool);
    const result = await market.getLiquidity(new URLSearchParams({ status: 'location' }));
    expect(result.data[0].monthsOfInventory).toBeNull();
  });
});

describe('market.js — getFirstTimeBuyer', () => {
  it('returns all data', async () => {
    const pool = poolReturning([
      { district: 'Agdal', ville: 'Rabat', category: 'Entree', listings_count: 20, min_price: 500000, p25_price: 700000, median_price: 900000, avg_surface: 70 }
    ]);
    const market = await getMarket(pool);
    const result = await market.getFirstTimeBuyer(new URLSearchParams({}));
    expect(result.data).toHaveLength(1);
  });

  it('filters by ville', async () => {
    const market = await getMarket(poolReturning([]));
    const result = await market.getFirstTimeBuyer(new URLSearchParams({ ville: 'Rabat' }));
    expect(result.data).toEqual([]);
  });
});

describe('market.js — getAgencyLeaderboard', () => {
  it('returns leaderboard data', async () => {
    const pool = poolReturning([
      { agency_name: 'Immo Plus', total_listings: 100, sales_listings: 60, rentals_listings: 40, avg_price_m2: 14000, avg_price: 1200000, sold_30d: 15, computed_at: '2025-01-01' }
    ]);
    const market = await getMarket(pool);
    const result = await market.getAgencyLeaderboard(new URLSearchParams({ limit: '10' }));
    expect(result.data).toHaveLength(1);
    expect(result.data[0].agencyName).toBe('Immo Plus');
  });

  it('clamps limit between 5 and 100', async () => {
    const pool = poolReturning([]);
    const market = await getMarket(pool);
    await market.getAgencyLeaderboard(new URLSearchParams({ limit: '500' }));
    expect(pool.query.mock.calls[0][1][0]).toBe(100);
  });
});

describe('market.js — getSuspiciousListings', () => {
  it('returns suspicious listings', async () => {
    const pool = poolSequence(
      [{ total: 1 }],
      [{ id: 1, title: 'Suspicious', statut: 'vente', district: 'Agdal', property_type: 'Appartement', price: 500000, surface: 80, price_m2: 6250, median_price_m2: 15000, lower_fence_price_m2: 10000, upper_fence_price_m2: 20000, lower_fence_tuned_price_m2: 8000, upper_fence_tuned_price_m2: 22000, deviation_pct: -58.3, sample_size: 30, url: 'http://test.com', date_publication: '2025-01-01' }]
    );
    const market = await getMarket(pool);
    const result = await market.getSuspiciousListings(new URLSearchParams({ status: 'vente' }));
    expect(result.data).toHaveLength(1);
    expect(result.data[0].deviationPct).toBe(-58.3);
  });

  it('defaults to status all (empty)', async () => {
    const pool = poolSequence([{ total: 0 }], []);
    const market = await getMarket(pool);
    const result = await market.getSuspiciousListings(new URLSearchParams({}));
    expect(result.data).toEqual([]);
  });
});

describe('market.js — getNegotiationMargin', () => {
  it('returns negotiation margin data', async () => {
    const pool = poolReturning([
      { district: 'Agdal', statut: 'vente', listings_count: 50, avg_listing_price: 1200000, avg_estimated_price: 1100000, avg_margin_pct: 8.3, min_margin_pct: -5, max_margin_pct: 20 }
    ]);
    const market = await getMarket(pool);
    const result = await market.getNegotiationMargin(new URLSearchParams({ quartier: 'Agdal', status: 'vente' }));
    expect(result.data).toHaveLength(1);
    expect(result.data[0].avgMarginPct).toBe(8.3);
  });

  it('handles no quartier', async () => {
    const market = await getMarket(poolReturning([]));
    const result = await market.getNegotiationMargin(new URLSearchParams({}));
    expect(result.data).toEqual([]);
  });

  it('handles status all', async () => {
    const market = await getMarket(poolReturning([]));
    const result = await market.getNegotiationMargin(new URLSearchParams({ status: 'all' }));
    expect(result.data).toEqual([]);
  });
});

describe('market.js — getPredictions', () => {
  it('returns predictions data', async () => {
    const pool = poolReturning([
      { district: 'Agdal', statut: 'vente', current_price_m2: 15000, predicted_90d_price_m2: 15500, slope: 0.001, r_squared: 0.8, months_count: 12, prediction_label: 'Hausse probable' }
    ]);
    const market = await getMarket(pool);
    const result = await market.getPredictions(new URLSearchParams({ quartier: 'Agdal', status: 'vente', months: '12' }));
    expect(result.data).toHaveLength(1);
    expect(result.data[0].predictionLabel).toBe('Hausse probable');
    expect(result.data[0].change90dPct).toBeGreaterThan(0);
  });

  it('handles no quartier', async () => {
    const market = await getMarket(poolReturning([]));
    const result = await market.getPredictions(new URLSearchParams({}));
    expect(result.data).toEqual([]);
  });

  it('handles status all', async () => {
    const market = await getMarket(poolReturning([]));
    const result = await market.getPredictions(new URLSearchParams({ status: 'all' }));
    expect(result.data).toEqual([]);
  });

  it('clamps months between 3 and 36', async () => {
    const pool = poolReturning([]);
    const market = await getMarket(pool);
    await market.getPredictions(new URLSearchParams({ months: '100' }));
    expect(pool.query.mock.calls[0][1][0]).toBe(36);
  });
});
