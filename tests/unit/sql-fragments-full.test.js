import { describe, it, expect } from 'vitest';
import * as sql from '../../src/backend/sql-fragments.js';

describe('sql-fragments — normalizeExpr', () => {
  it('wraps expression with regexp_replace and translate', () => {
    const r = sql.normalizeExpr('l.quartier');
    expect(r).toContain('regexp_replace');
    expect(r).toContain('translate');
    expect(r).toContain('l.quartier');
    expect(r).toContain('coalesce');
  });

  it('handles null expression', () => {
    const r = sql.normalizeExpr("NULLIF(x,'')");
    expect(r).toContain('NULLIF');
  });
});

describe('sql-fragments — normalizeCol', () => {
  it('delegates to normalizeExpr', () => {
    const r = sql.normalizeCol('a.type_bien');
    expect(r).toContain('regexp_replace');
    expect(r).toContain('a.type_bien');
  });
});

describe('sql-fragments — cityFallback', () => {
  it('returns NULLIF wrapping COALESCE', () => {
    const r = sql.cityFallback('l.quartier', 'l.ville');
    expect(r).toContain('NULLIF');
    expect(r).toContain('COALESCE');
    expect(r).toContain('l.quartier');
  });

  it('accepts custom defaultCity', () => {
    const r = sql.cityFallback('col', 'villeCol', "'Rabat'");
    expect(r).toContain("'Rabat'");
  });
});

describe('sql-fragments — districtCase', () => {
  it('returns CASE with known quartiers', () => {
    const r = sql.districtCase('l.quartier', 'l.ville');
    expect(r).toContain('CASE');
    expect(r).toContain('Hay Riad');
    expect(r).toContain('Hassan');
    expect(r).toContain('Souissi');
    expect(r).toContain('Agdal');
    expect(r).toContain('ELSE');
    expect(r).toContain('END');
  });

  it('includes riad matching', () => {
    const r = sql.districtCase('col', 'ville');
    expect(r).toContain('%riyad%');
    expect(r).toContain('%hay riad%');
  });
});

describe('sql-fragments — propertyTypeCase', () => {
  it('returns CASE with all property types', () => {
    const r = sql.propertyTypeCase('a.type_bien');
    expect(r).toContain('CASE');
    expect(r).toContain('Appartement');
    expect(r).toContain('Villa');
    expect(r).toContain('Maison');
    expect(r).toContain('Terrain');
    expect(r).toContain('Bureau');
    expect(r).toContain('Local commercial');
    expect(r).toContain('Riad');
    expect(r).toContain('Autre');
    expect(r).toContain('END');
  });

  it('includes commerce/local matching', () => {
    const r = sql.propertyTypeCase('col');
    expect(r).toContain('%local%');
    expect(r).toContain('%commerce%');
  });
});

describe('sql-fragments — priceRangeFilter', () => {
  it('generates filter for vente and location ranges', () => {
    const r = sql.priceRangeFilter('a.statut', 'a.prix', 'a.surface');
    expect(r).toContain('vente');
    expect(r).toContain('location');
    expect(r).toContain('BETWEEN');
    expect(r).toContain('NULLIF');
  });
});

describe('sql-fragments — priceRangeSimple', () => {
  it('generates simple price range filter', () => {
    const r = sql.priceRangeSimple('statut', 'prix');
    expect(r).toContain('vente');
    expect(r).toContain('location');
    expect(r).toContain('BETWEEN');
    expect(r).not.toContain('surface');
  });
});

describe('sql-fragments — phoneSubquery', () => {
  it('generates phone subquery with alias', () => {
    const r = sql.phoneSubquery('a');
    expect(r).toContain('COALESCE');
    expect(r).toContain('contacts c4');
    expect(r).toContain('a.id');
    expect(r).toContain('212600000000');
  });
});

describe('sql-fragments — priceM2Expr', () => {
  it('generates price/surface expression', () => {
    const r = sql.priceM2Expr('prix', 'surface');
    expect(r).toContain('prix');
    expect(r).toContain('surface');
    expect(r).toContain('NULLIF');
  });
});

describe('sql-fragments — constants', () => {
  it('exports all price constants', () => {
    expect(sql.PRICE_RANGE_VENTE_MIN).toBe(100000);
    expect(sql.PRICE_RANGE_VENTE_MAX).toBe(30000000);
    expect(sql.PRICE_M2_VENTE_MIN).toBe(3000);
    expect(sql.PRICE_M2_VENTE_MAX).toBe(80000);
    expect(sql.PRICE_RANGE_LOCATION_MIN).toBe(500);
    expect(sql.PRICE_RANGE_LOCATION_MAX).toBe(200000);
    expect(sql.PRICE_M2_LOCATION_MIN).toBe(20);
    expect(sql.PRICE_M2_LOCATION_MAX).toBe(3000);
  });
});
