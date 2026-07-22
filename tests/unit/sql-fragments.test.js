import { describe, it, expect } from 'vitest';
import * as sql from '../../src/backend/sql-fragments.js';

describe('sql-fragments', () => {
  it('should export normalizeExpr', () => {
    expect(typeof sql.normalizeExpr).toBe('function');
  });

  it('should export normalizeCol', () => {
    expect(typeof sql.normalizeCol).toBe('function');
  });

  it('normalizeExpr should wrap expression with regexp_replace', () => {
    const result = sql.normalizeExpr('l.quartier');
    expect(result).toContain('regexp_replace');
    expect(result).toContain('translate');
    expect(result).toContain('l.quartier');
  });

  it('normalizeCol should delegate to normalizeExpr', () => {
    const result = sql.normalizeCol('col');
    expect(result).toContain('regexp_replace');
  });

  it('should export cityFallback', () => {
    expect(typeof sql.cityFallback).toBe('function');
    const result = sql.cityFallback('col', 'villeCol');
    expect(result).toContain('NULLIF');
    expect(result).toContain('COALESCE');
  });

  it('should export districtCase', () => {
    expect(typeof sql.districtCase).toBe('function');
    const result = sql.districtCase('l.quartier', 'l.ville');
    expect(result).toContain('CASE');
    expect(result).toContain('Hay Riad');
    expect(result).toContain('Hassan');
    expect(result).toContain('Souissi');
    expect(result).toContain('Agdal');
  });

  it('should export propertyTypeCase', () => {
    expect(typeof sql.propertyTypeCase).toBe('function');
    const result = sql.propertyTypeCase('a.type_bien');
    expect(result).toContain('Appartement');
    expect(result).toContain('Villa');
    expect(result).toContain('Maison');
  });
});
