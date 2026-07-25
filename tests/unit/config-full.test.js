import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('config.js', () => {
  const origEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it('exports loadDotEnv', () => {
    const config = require('../../src/backend/config.js');
    expect(typeof config.loadDotEnv).toBe('function');
  });

  it('exports ROOT', () => {
    const config = require('../../src/backend/config.js');
    expect(typeof config.ROOT).toBe('string');
    expect(config.ROOT).toContain('src');
  });

  it('exports SITE_URL', () => {
    const config = require('../../src/backend/config.js');
    expect(config.SITE_URL).toContain('https');
    expect(config.SITE_URL).toContain('realestatecapitale');
  });

  it('exports SITE_DOMAIN', () => {
    const config = require('../../src/backend/config.js');
    expect(config.SITE_DOMAIN).toBe('realestatecapitale.ma');
  });

  it('exports SITE_PROTOCOL', () => {
    const config = require('../../src/backend/config.js');
    expect(config.SITE_PROTOCOL).toBe('https');
  });

  it('exports DB_TABLES with all table names', () => {
    const config = require('../../src/backend/config.js');
    expect(config.DB_TABLES).toBeDefined();
    expect(config.DB_TABLES.annonces).toBeDefined();
    expect(config.DB_TABLES.localisations).toBeDefined();
    expect(config.DB_TABLES.caracteristiques).toBeDefined();
    expect(config.DB_TABLES.contacts).toBeDefined();
    expect(config.DB_TABLES.images).toBeDefined();
    expect(config.DB_TABLES.annonceEquipements).toBeDefined();
    expect(config.DB_TABLES.equipements).toBeDefined();
    expect(config.DB_TABLES.historiquePrix).toBeDefined();
    expect(config.DB_TABLES.quartiers).toBeDefined();
    expect(config.DB_TABLES.users).toBeDefined();
    expect(config.DB_TABLES.leads).toBeDefined();
    expect(config.DB_TABLES.publicUsers).toBeDefined();
    expect(config.DB_TABLES.savedListings).toBeDefined();
    expect(config.DB_TABLES.savedSearches).toBeDefined();
    expect(config.DB_TABLES.savedEstimations).toBeDefined();
    expect(config.DB_TABLES.articlesBlog).toBeDefined();
    expect(config.DB_TABLES.agencies).toBeDefined();
    expect(config.DB_TABLES.newsletterSubscribers).toBeDefined();
    expect(config.DB_TABLES.contactMessages).toBeDefined();
  });

  it('exports LOCATION_ALIASES with known locations', () => {
    const config = require('../../src/backend/config.js');
    expect(config.LOCATION_ALIASES).toBeDefined();
    expect(config.LOCATION_ALIASES['hay riad']).toBeDefined();
    expect(config.LOCATION_ALIASES['hay riad']).toContain('riyad');
    expect(config.LOCATION_ALIASES.ocean).toBeDefined();
    expect(config.LOCATION_ALIASES.ocean).toContain('l ocean');
    expect(config.LOCATION_ALIASES.takadoum).toBeDefined();
    expect(config.LOCATION_ALIASES.takadoum).toContain('takaddoum');
  });

  it('DB_TABLES uses env overrides', () => {
    process.env.DB_TABLE_ANNONCES = 'custom_annonces';
    delete require.cache[require.resolve('../../src/backend/config.js')];
    const config = require('../../src/backend/config.js');
    expect(config.DB_TABLES.annonces).toBe('custom_annonces');
    delete process.env.DB_TABLE_ANNONCES;
  });

  it('SITE_DOMAIN uses env override', () => {
    process.env.SITE_DOMAIN = 'example.com';
    delete require.cache[require.resolve('../../src/backend/config.js')];
    const config = require('../../src/backend/config.js');
    expect(config.SITE_DOMAIN).toBe('example.com');
    expect(config.SITE_URL).toBe('https://example.com');
    delete process.env.SITE_DOMAIN;
  });
});
