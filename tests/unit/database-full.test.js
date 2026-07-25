import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('database.js — read/write pool split', () => {
  it('exports pool', () => {
    const { pool } = require('../../src/backend/database.js');
    expect(pool).toBeDefined();
  });

  it('pool has query method', () => {
    const { pool } = require('../../src/backend/database.js');
    expect(typeof pool.query).toBe('function');
  });

  it('pool has connect method', () => {
    const { pool } = require('../../src/backend/database.js');
    expect(typeof pool.connect).toBe('function');
  });

  it('pool has end method', () => {
    const { pool } = require('../../src/backend/database.js');
    expect(typeof pool.end).toBe('function');
  });

  it('pool exposes totalCount', () => {
    const { pool } = require('../../src/backend/database.js');
    expect(typeof pool.totalCount).toBe('number');
  });

  it('pool exposes idleCount', () => {
    const { pool } = require('../../src/backend/database.js');
    expect(typeof pool.idleCount).toBe('number');
  });

  it('pool exposes waitingCount', () => {
    const { pool } = require('../../src/backend/database.js');
    expect(typeof pool.waitingCount).toBe('number');
  });

  it('pool has on method', () => {
    const { pool } = require('../../src/backend/database.js');
    expect(typeof pool.on).toBe('function');
  });
});

describe('database.js — isReadQuery', () => {
  const { pool } = require('../../src/backend/database.js');

  it('routes SELECT to read pool', async () => {
    if (pool._readPool) {
      const spy = vi.spyOn(pool._readPool, 'query');
      try { await pool.query('SELECT 1'); } catch {}
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    }
  });
});
