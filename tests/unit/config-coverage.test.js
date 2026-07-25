import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'fs';

describe('config.js — loadDotEnv coverage', () => {
  const origEnv = { ...process.env };
  let loadDotEnv;

  afterEach(() => {
    process.env = { ...origEnv };
    vi.restoreAllMocks();
    vi.resetModules();
  });

  async function getLoadDotEnv() {
    const config = await import('../../src/backend/config.js');
    loadDotEnv = config.loadDotEnv;
    return config;
  }

  it('parses .env file with key=value pairs', async () => {
    await getLoadDotEnv();
    const envContent = 'DB_HOST=localhost\nDB_PORT=5432\n# comment\n\nEMPTY_VAL=\nQUOTED="quoted value"\n';
    const spy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(envContent);

    delete process.env.DB_HOST;
    delete process.env.DB_PORT;
    delete process.env.EMPTY_VAL;
    delete process.env.QUOTED;
    loadDotEnv();

    expect(process.env.DB_HOST).toBe('localhost');
    expect(process.env.DB_PORT).toBe('5432');
    expect(process.env.EMPTY_VAL).toBe('');
    expect(process.env.QUOTED).toBe('quoted value');
  });

  it('does not override existing env vars', async () => {
    await getLoadDotEnv();
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue('EXISTING_KEY=from_file\n');
    process.env.EXISTING_KEY = 'original';
    loadDotEnv();

    expect(process.env.EXISTING_KEY).toBe('original');
  });

  it('skips lines without = sign', async () => {
    await getLoadDotEnv();
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue('VALID=ok\nINVALID_LINE\nANOTHER=\n');
    delete process.env.VALID;
    loadDotEnv();

    expect(process.env.VALID).toBe('ok');
  });

  it('handles missing .env file', async () => {
    await getLoadDotEnv();
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    expect(() => loadDotEnv()).not.toThrow();
  });

  it('loads .env.prod in production mode', async () => {
    const origNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    await getLoadDotEnv();
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue('PROD_KEY=prod_value\n');
    delete process.env.PROD_KEY;
    loadDotEnv();

    expect(process.env.PROD_KEY).toBe('prod_value');
    process.env.NODE_ENV = origNodeEnv;
  });

  it('handles key with = in value', async () => {
    await getLoadDotEnv();
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue('URL=http://localhost:5432?foo=bar\n');
    delete process.env.URL;
    loadDotEnv();

    expect(process.env.URL).toBe('http://localhost:5432?foo=bar');
  });
});

describe('config.js — exports', () => {
  it('exports all expected properties', async () => {
    const config = await import('../../src/backend/config.js');
    expect(config.SITE_DOMAIN).toBeDefined();
    expect(config.SITE_PROTOCOL).toBeDefined();
    expect(config.SITE_URL).toBeDefined();
    expect(config.DB_TABLES).toBeDefined();
    expect(config.LOCATION_ALIASES).toBeDefined();
    expect(config.ROOT).toBeDefined();
    expect(typeof config.loadDotEnv).toBe('function');
  });
});
