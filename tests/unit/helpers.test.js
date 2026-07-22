import { describe, it, expect } from 'vitest';
import helpers from '../../src/backend/helpers.js';

describe('helpers', () => {
  it('should export parsePagination', () => {
    expect(typeof helpers.parsePagination).toBe('function');
  });

  it('should export computePaginationMeta', () => {
    expect(typeof helpers.computePaginationMeta).toBe('function');
  });

  it('should export normalize', () => {
    expect(typeof helpers.normalize).toBe('function');
  });

  it('should export normalizeNoAccent', () => {
    expect(typeof helpers.normalizeNoAccent).toBe('function');
  });

  it('parsePagination should return page, pageSize, offset', () => {
    const params = new URLSearchParams('page=2&pageSize=20');
    const result = helpers.parsePagination(params);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(20);
    expect(result.offset).toBe(20);
  });

  it('parsePagination should use defaults', () => {
    const params = new URLSearchParams('');
    const result = helpers.parsePagination(params);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });

  it('parsePagination should cap pageSize at maxPageSize', () => {
    const params = new URLSearchParams('pageSize=500');
    const result = helpers.parsePagination(params, { maxPageSize: 100 });
    expect(result.pageSize).toBe(100);
  });

  it('computePaginationMeta should compute totalPages', () => {
    const result = helpers.computePaginationMeta(95, 1, 20);
    expect(result.total).toBe(95);
    expect(result.totalPages).toBe(5);
    expect(result.page).toBe(1);
  });

  it('normalize should lowercase and trim', () => {
    expect(helpers.normalize('  Agdal  ')).toBe('agdal');
    expect(helpers.normalize(null)).toBe('');
    expect(helpers.normalize(undefined)).toBe('');
  });

  it('normalizeNoAccent should remove accents', () => {
    expect(helpers.normalizeNoAccent('Témara')).toBe('temara');
    expect(helpers.normalizeNoAccent('Salé')).toBe('sale');
    expect(helpers.normalizeNoAccent('Souissi')).toBe('souissi');
  });

  it('should export estimerCredit', () => {
    expect(typeof helpers.estimerCredit).toBe('function');
    const result = helpers.estimerCredit(1000000);
    expect(result.mensualite).toBeGreaterThan(0);
    expect(result.total).toBeGreaterThan(result.mensualite);
  });

  it('should export expandLocationTerms', () => {
    expect(typeof helpers.expandLocationTerms).toBe('function');
  });
});
