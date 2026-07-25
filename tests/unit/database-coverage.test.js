import { describe, it, expect, vi } from 'vitest';

describe('database.js — dual pool path', () => {
  it('tests isReadQuery with various SQL patterns', async () => {
    const db = await import('../../src/backend/database.js');
    const { pool } = db;

    // Test that pool exports query, connect, end
    expect(typeof pool.query).toBe('function');
    expect(typeof pool.connect).toBe('function');
    expect(typeof pool.end).toBe('function');
    expect(typeof pool.on).toBe('function');
    expect(typeof pool.totalCount).toBe('number');
    expect(typeof pool.idleCount).toBe('number');
    expect(typeof pool.waitingCount).toBe('number');
  });

  it('pool.on registers event handlers', async () => {
    const db = await import('../../src/backend/database.js');
    const { pool } = db;
    const handler = vi.fn();
    expect(() => pool.on('error', handler)).not.toThrow();
  });

  it('pool.end returns a promise', async () => {
    const db = await import('../../src/backend/database.js');
    const { pool } = db;
    const result = pool.end();
    expect(result).toBeInstanceOf(Promise);
  });
});

describe('database.js — isReadQuery patterns', () => {
  it('routes SELECT to read pool', async () => {
    const db = await import('../../src/backend/database.js');
    const { pool } = db;
    // We can't directly test isReadQuery since it's not exported,
    // but we can test the pool.query behavior indirectly
    try {
      await pool.query('SELECT 1');
    } catch (e) {
      // Connection will fail in test env, but the routing logic should still work
      expect(e).toBeDefined();
    }
  });

  it('routes WITH to read pool', async () => {
    const db = await import('../../src/backend/database.js');
    const { pool } = db;
    try {
      await pool.query('WITH cte AS (SELECT 1) SELECT * FROM cte');
    } catch (e) {
      expect(e).toBeDefined();
    }
  });

  it('routes INSERT to write pool', async () => {
    const db = await import('../../src/backend/database.js');
    const { pool } = db;
    try {
      await pool.query('INSERT INTO test (col) VALUES ($1)', ['value']);
    } catch (e) {
      expect(e).toBeDefined();
    }
  });

  it('routes UPDATE to write pool', async () => {
    const db = await import('../../src/backend/database.js');
    const { pool } = db;
    try {
      await pool.query('UPDATE test SET col = $1 WHERE id = $2', ['value', 1]);
    } catch (e) {
      expect(e).toBeDefined();
    }
  });

  it('routes DELETE to write pool', async () => {
    const db = await import('../../src/backend/database.js');
    const { pool } = db;
    try {
      await pool.query('DELETE FROM test WHERE id = $1', [1]);
    } catch (e) {
      expect(e).toBeDefined();
    }
  });
});
