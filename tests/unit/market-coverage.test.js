import { describe, it, expect, vi, beforeEach } from 'vitest';

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

function mockPool(rows) {
  return { query: vi.fn(async () => ({ rows })) };
}

function mockPoolSeq(...rowsList) {
  let i = 0;
  return { query: vi.fn(async () => ({ rows: rowsList[Math.min(i++, rowsList.length - 1)] })) };
}

async function loadMarket(pool) {
  const mod = await import('../../src/backend/market.js');
  return mod.default({ pool, DB_TABLES });
}

describe('market.js — coverage boost: getPriceTrendsByQuarter', () => {
  it('covers full path with vente status', async () => {
    const pool = mockPoolSeq(
      [{ total: 2 }],
      [{ district: 'Agdal', ville: 'Rabat', status: 'vente', latest_month: '2025-06-01', latest_price_m2: 16000, previous_price_m2: 15000, latest_samples: 5, previous_samples: 4, variation_pct: 6.7 }]
    );
    const market = await loadMarket(pool);
    const result = await market.getPriceTrendsByQuarter(new URLSearchParams({ status: 'vente', months: '6' }));
    expect(result.data.length).toBeGreaterThanOrEqual(1);
    expect(result.meta).toBeDefined();
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  it('covers path with status all', async () => {
    const pool = mockPoolSeq([{ total: 0 }], []);
    const market = await loadMarket(pool);
    const result = await market.getPriceTrendsByQuarter(new URLSearchParams({ status: 'all' }));
    expect(result.data).toEqual([]);
  });

  it('covers default status (no status param)', async () => {
    const pool = mockPoolSeq([{ total: 0 }], []);
    const market = await loadMarket(pool);
    await market.getPriceTrendsByQuarter(new URLSearchParams({}));
    expect(pool.query).toHaveBeenCalledTimes(2);
  });
});

describe('market.js — coverage boost: getSuspiciousListings', () => {
  it('covers full path with status vente', async () => {
    const pool = mockPoolSeq(
      [{ total: 1 }],
      [{ id: 1, title: 'Test', status: 'vente', district: 'Agdal', property_type: 'Appartement', price: 500000, surface: 80, price_m2: 6250, median_price_m2: 15000, lower_fence_price_m2: 10000, upper_fence_price_m2: 20000, lower_fence_tuned_price_m2: 8000, upper_fence_tuned_price_m2: 22000, deviation_pct: -58.3, sample_size: 30, url: 'http://test.com', date_publication: '2025-01-01', suspicion_type: 'Prix anormalement bas', severity: 'Critique' }]
    );
    const market = await loadMarket(pool);
    const result = await market.getSuspiciousListings(new URLSearchParams({ status: 'vente' }));
    expect(result.data).toHaveLength(1);
  });

  it('covers path with status all (no status filter)', async () => {
    const pool = mockPoolSeq([{ total: 0 }], []);
    const market = await loadMarket(pool);
    const result = await market.getSuspiciousListings(new URLSearchParams({ status: 'all' }));
    expect(result.data).toEqual([]);
  });

  it('covers path with default params', async () => {
    const pool = mockPoolSeq([{ total: 0 }], []);
    const market = await loadMarket(pool);
    await market.getSuspiciousListings(new URLSearchParams({}));
  });
});

describe('market.js — coverage boost: getMarketHeatmap', () => {
  it('covers string result parsing', async () => {
    const pool = mockPool([{ result: JSON.stringify([{ district: 'Agdal', score: 85 }]) }]);
    const market = await loadMarket(pool);
    const result = await market.getMarketHeatmap(new URLSearchParams({}));
    expect(result.data).toHaveLength(1);
  });

  it('covers object result (non-string)', async () => {
    const pool = mockPool([{ result: [{ district: 'Agdal', score: 85 }] }]);
    const market = await loadMarket(pool);
    const result = await market.getMarketHeatmap(new URLSearchParams({}));
    expect(result.data).toHaveLength(1);
  });

  it('covers null result', async () => {
    const pool = mockPool([{ result: null }]);
    const market = await loadMarket(pool);
    const result = await market.getMarketHeatmap(new URLSearchParams({}));
    expect(result.data).toEqual([]);
  });

  it('covers pagination', async () => {
    const data = Array.from({ length: 25 }, (_, i) => ({ district: `D${i}`, score: i }));
    const pool = mockPool([{ result: JSON.stringify(data) }]);
    const market = await loadMarket(pool);
    const result = await market.getMarketHeatmap(new URLSearchParams({ page: '2', pageSize: '10' }));
    expect(result.meta.page).toBe(2);
  });
});

describe('market.js — coverage boost: getComparables', () => {
  it('covers valid listing comparables', async () => {
    const pool = mockPoolSeq(
      [{ id: 1, statut: 'vente', type_bien_raw: 'appartement', price: 1000000, surface: 80, price_m2: 12500, district: 'Agdal' }],
      [{ id: 2, title: 'Test', statut: 'vente', district: 'Agdal', price: 950000, surface: 75, price_m2: 12667, surface_diff_ratio: 0.05, price_m2_diff_ratio: 0.013, similarity_score: 0.032 }]
    );
    const market = await loadMarket(pool);
    const result = await market.getComparables(new URLSearchParams({ listingId: '1' }));
    expect(result.target).toBeDefined();
    expect(result.comparables).toHaveLength(1);
  });

  it('covers missing listingId', async () => {
    const market = await loadMarket(mockPool([]));
    await expect(market.getComparables(new URLSearchParams({}))).rejects.toThrow();
  });

  it('covers listingId 0', async () => {
    const market = await loadMarket(mockPool([]));
    await expect(market.getComparables(new URLSearchParams({ listingId: '0' }))).rejects.toThrow();
  });

  it('covers listing not found (404)', async () => {
    const market = await loadMarket(mockPool([]));
    await expect(market.getComparables(new URLSearchParams({ listingId: '99999' }))).rejects.toThrow('introuvable');
  });
});

describe('market.js — coverage boost: getInvestorAlerts', () => {
  it('covers full path with vente status', async () => {
    const pool = mockPoolSeq(
      [{ total: 1 }],
      [{ id: 1, title: 'Deal', statut: 'vente', district: 'Agdal', property_type: 'Appartement', price: 800000, surface: 80, price_m2: 10000, segment_avg_price_m2: 15000, segment_median_price_m2: 14500, sample_size: 20, delta_vs_avg_pct: -33.3, delta_vs_median_pct: -31, url: 'http://test.com', date_publication: '2025-01-01', alert_level: 'Opportunite forte' }]
    );
    const market = await loadMarket(pool);
    const result = await market.getInvestorAlerts(new URLSearchParams({ status: 'vente' }));
    expect(result.data).toHaveLength(1);
  });

  it('covers path with status all', async () => {
    const pool = mockPoolSeq([{ total: 0 }], []);
    const market = await loadMarket(pool);
    await market.getInvestorAlerts(new URLSearchParams({ status: 'all' }));
  });

  it('covers default params', async () => {
    const pool = mockPoolSeq([{ total: 0 }], []);
    const market = await loadMarket(pool);
    await market.getInvestorAlerts(new URLSearchParams({}));
  });
});

describe('market.js — coverage boost: getQuartierComparison', () => {
  it('covers full path with data', async () => {
    const pool = mockPool([
      { district: 'Agdal', ville: 'Rabat', statut: 'vente', listings_count: 50, avg_price_m2: 15000, median_price_m2: 14500, p25_price_m2: 12000, p75_price_m2: 17000, avg_surface: 85, volatility_pct: 5.2, computed_at: '2025-01-01' }
    ]);
    const market = await loadMarket(pool);
    const result = await market.getQuartierComparison(new URLSearchParams({ q1: 'Agdal', q2: 'Hassan' }));
    expect(result.data).toHaveLength(1);
  });

  it('covers missing q1', async () => {
    const market = await loadMarket(mockPool([]));
    await expect(market.getQuartierComparison(new URLSearchParams({ q2: 'Hassan' }))).rejects.toThrow();
  });

  it('covers missing q2', async () => {
    const market = await loadMarket(mockPool([]));
    await expect(market.getQuartierComparison(new URLSearchParams({ q1: 'Agdal' }))).rejects.toThrow();
  });

  it('covers status filter', async () => {
    const pool = mockPool([]);
    const market = await loadMarket(pool);
    await market.getQuartierComparison(new URLSearchParams({ q1: 'Agdal', q2: 'Hassan', status: 'vente' }));
  });
});

describe('market.js — coverage boost: getRentalYield', () => {
  it('covers all data', async () => {
    const pool = mockPool([{ district: 'Agdal', ville: 'Rabat', sale_price_m2: 15000, rent_price_m2: 120, sale_count: 50, rent_count: 30, gross_yield_pct: 9.6, computed_at: '2025-01-01' }]);
    const market = await loadMarket(pool);
    const result = await market.getRentalYield(new URLSearchParams({}));
    expect(result.data).toHaveLength(1);
  });

  it('covers with quartier filter', async () => {
    const pool = mockPool([{ district: 'Agdal', ville: 'Rabat', sale_price_m2: 15000, rent_price_m2: 120, sale_count: 50, rent_count: 30, gross_yield_pct: 9.6, computed_at: null }]);
    const market = await loadMarket(pool);
    const result = await market.getRentalYield(new URLSearchParams({ quartier: 'Agdal' }));
    expect(result.data).toHaveLength(1);
  });

  it('covers null gross_yield_pct', async () => {
    const pool = mockPool([{ district: 'Test', ville: 'Rabat', sale_price_m2: 10000, rent_price_m2: 80, sale_count: 10, rent_count: 5, gross_yield_pct: null, computed_at: null }]);
    const market = await loadMarket(pool);
    const result = await market.getRentalYield(new URLSearchParams({}));
    expect(result.data[0].grossYieldPct).toBeNull();
  });
});

describe('market.js — coverage boost: getLiquidity', () => {
  it('covers all data without quartier', async () => {
    const pool = mockPool([{ district: 'Agdal', statut: 'vente', active_listings: 100, exited_30d: 20, turnover_rate_pct: 20, months_of_inventory: 5, liquidity_label: 'Correct', computed_at: '2025-01-01' }]);
    const market = await loadMarket(pool);
    const result = await market.getLiquidity(new URLSearchParams({}));
    expect(result.data).toHaveLength(1);
  });

  it('covers with quartier filter', async () => {
    const pool = mockPool([{ district: 'Agdal', statut: 'vente', active_listings: 50, exited_30d: 10, turnover_rate_pct: 20, months_of_inventory: 5, liquidity_label: 'Correct', computed_at: null }]);
    const market = await loadMarket(pool);
    const result = await market.getLiquidity(new URLSearchParams({ quartier: 'Agdal' }));
    expect(result.data).toHaveLength(1);
  });

  it('covers status all', async () => {
    const pool = mockPool([]);
    const market = await loadMarket(pool);
    await market.getLiquidity(new URLSearchParams({ status: 'all' }));
  });

  it('covers status vente with quartier', async () => {
    const pool = mockPool([{ district: 'Agdal', statut: 'vente', active_listings: 50, exited_30d: 10, turnover_rate_pct: 20, months_of_inventory: null, liquidity_label: 'Correct', computed_at: null }]);
    const market = await loadMarket(pool);
    await market.getLiquidity(new URLSearchParams({ quartier: 'Agdal', status: 'vente' }));
  });

  it('covers null months_of_inventory', async () => {
    const pool = mockPool([{ district: 'Test', statut: 'location', active_listings: 10, exited_30d: 2, turnover_rate_pct: 20, months_of_inventory: null, liquidity_label: 'N/A', computed_at: null }]);
    const market = await loadMarket(pool);
    const result = await market.getLiquidity(new URLSearchParams({ status: 'location' }));
    expect(result.data[0].monthsOfInventory).toBeNull();
  });
});

describe('market.js — coverage boost: getFirstTimeBuyer', () => {
  it('covers all data', async () => {
    const pool = mockPool([{ district: 'Agdal', ville: 'Rabat', category: 'Entree', listings_count: 20, min_price: 500000, p25_price: 700000, median_price: 900000, avg_surface: 70 }]);
    const market = await loadMarket(pool);
    const result = await market.getFirstTimeBuyer(new URLSearchParams({}));
    expect(result.data).toHaveLength(1);
  });

  it('covers with ville filter', async () => {
    const pool = mockPool([]);
    const market = await loadMarket(pool);
    await market.getFirstTimeBuyer(new URLSearchParams({ ville: 'Rabat' }));
  });
});

describe('market.js — coverage boost: getAgencyLeaderboard', () => {
  it('covers all data', async () => {
    const pool = mockPool([{ agency_name: 'Immo Plus', total_listings: 100, sales_listings: 60, rentals_listings: 40, avg_price_m2: 14000, avg_price: 1200000, sold_30d: 15, computed_at: '2025-01-01' }]);
    const market = await loadMarket(pool);
    const result = await market.getAgencyLeaderboard(new URLSearchParams({ limit: '10' }));
    expect(result.data).toHaveLength(1);
  });

  it('covers default limit', async () => {
    const pool = mockPool([]);
    const market = await loadMarket(pool);
    await market.getAgencyLeaderboard(new URLSearchParams({}));
  });
});

describe('market.js — coverage boost: getNegotiationMargin', () => {
  it('covers full path with quartier and vente', async () => {
    const pool = mockPool([{ district: 'Agdal', statut: 'vente', listings_count: 50, avg_listing_price: 1200000, avg_estimated_price: 1100000, avg_margin_pct: 8.3, min_margin_pct: -5, max_margin_pct: 20 }]);
    const market = await loadMarket(pool);
    const result = await market.getNegotiationMargin(new URLSearchParams({ quartier: 'Agdal', status: 'vente' }));
    expect(result.data).toHaveLength(1);
  });

  it('covers no quartier, status all', async () => {
    const pool = mockPool([]);
    const market = await loadMarket(pool);
    await market.getNegotiationMargin(new URLSearchParams({}));
  });

  it('covers quartier only', async () => {
    const pool = mockPool([{ district: 'Agdal', statut: 'vente', listings_count: 30, avg_listing_price: 1000000, avg_estimated_price: 950000, avg_margin_pct: 5, min_margin_pct: -2, max_margin_pct: 12 }]);
    const market = await loadMarket(pool);
    await market.getNegotiationMargin(new URLSearchParams({ quartier: 'Agdal' }));
  });

  it('covers status only', async () => {
    const pool = mockPool([{ district: 'Hassan', statut: 'vente', listings_count: 20, avg_listing_price: 800000, avg_estimated_price: 780000, avg_margin_pct: 2.5, min_margin_pct: -1, max_margin_pct: 8 }]);
    const market = await loadMarket(pool);
    await market.getNegotiationMargin(new URLSearchParams({ status: 'vente' }));
  });
});

describe('market.js — coverage boost: getPredictions', () => {
  it('covers full path with quartier, status vente', async () => {
    const pool = mockPool([{ district: 'Agdal', statut: 'vente', current_price_m2: 15000, predicted_90d_price_m2: 15500, slope: 0.001, r_squared: 0.8, months_count: 12, prediction_label: 'Hausse probable' }]);
    const market = await loadMarket(pool);
    const result = await market.getPredictions(new URLSearchParams({ quartier: 'Agdal', status: 'vente', months: '12' }));
    expect(result.data).toHaveLength(1);
    expect(result.data[0].change90dPct).toBeGreaterThan(0);
  });

  it('covers no quartier, status all', async () => {
    const pool = mockPool([]);
    const market = await loadMarket(pool);
    await market.getPredictions(new URLSearchParams({}));
  });

  it('covers status only', async () => {
    const pool = mockPool([]);
    const market = await loadMarket(pool);
    await market.getPredictions(new URLSearchParams({ status: 'location' }));
  });

  it('covers months clamping', async () => {
    const pool = mockPool([]);
    const market = await loadMarket(pool);
    await market.getPredictions(new URLSearchParams({ months: '2' }));
  });

  it('covers negative prediction (baisse)', async () => {
    const pool = mockPool([{ district: 'Hassan', statut: 'vente', current_price_m2: 12000, predicted_90d_price_m2: 11000, slope: -0.001, r_squared: 0.6, months_count: 6, prediction_label: 'Baisse probable' }]);
    const market = await loadMarket(pool);
    const result = await market.getPredictions(new URLSearchParams({ quartier: 'Hassan' }));
    expect(result.data[0].change90dPct).toBeLessThan(0);
  });
});

describe('market.js — normalizeStatusFilter edge cases', () => {
  it('handles invalid status', async () => {
    const pool = mockPoolSeq([{ total: 0 }], []);
    const market = await loadMarket(pool);
    await market.getPriceTrendsByQuarter(new URLSearchParams({ status: 'invalid' }));
    expect(pool.query).toHaveBeenCalledTimes(2);
  });
});
