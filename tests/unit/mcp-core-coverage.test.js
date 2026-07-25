import { describe, it, expect, vi } from 'vitest';

process.env.DATABASE_URL = 'postgresql://scraper:admin@localhost:5432/mubawab';

let mockQueryFn;

vi.mock('pg', () => {
  const MockPool = function () {
    return {
      query: (...args) => mockQueryFn(...args),
      connect: vi.fn(),
      end: vi.fn().mockResolvedValue(undefined),
      totalCount: 0, idleCount: 0, waitingCount: 0,
      on: vi.fn(),
    };
  };
  return { Pool: MockPool, Client: vi.fn() };
});

async function loadMcp() {
  vi.resetModules();
  mockQueryFn = vi.fn(async () => ({ rows: [] }));
  return await import('../../src/core/mcp-core.js');
}

describe('mcp-core.js — summary branches', () => {
  it('line 791: non-array data summary (estimation object)', async () => {
    vi.resetModules();
    mockQueryFn = vi.fn(async (text) => {
      if (String(text || '').includes('sp_estimation')) return {
        rows: [{ result: { estimation_disponible: true, quartier: 'Agdal', type: 'vente', surface_saisie: 100, prix_m2_moyen: 15000, estimation_basse: 1400000, estimation_mediane: 1500000, estimation_haute: 1600000, nb_annonces: 10 } }]
      };
      return { rows: [] };
    });
    const mcp = await import('../../src/core/mcp-core.js');
    const res = await mcp.handleRequest({
      jsonrpc: '2.0', id: 901, method: 'tools/call',
      params: { name: 'estimate_property', arguments: { type: 'vente', quartier: 'Agdal', surface: 100 } }
    });
    expect(res.result.content[0].text).toContain('Estimation');
  });

  it('line 799: default summary (empty result, no data)', async () => {
    vi.resetModules();
    mockQueryFn = vi.fn(async () => ({ rows: [] }));
    const mcp = await import('../../src/core/mcp-core.js');
    const res = await mcp.handleRequest({
      jsonrpc: '2.0', id: 902, method: 'tools/call',
      params: { name: 'list_quartiers', arguments: {} }
    });
    expect(res.result.content[0].text).toBeDefined();
  });

  it('line 795: ok result summary (create_lead)', async () => {
    vi.resetModules();
    mockQueryFn = vi.fn(async () => ({ rows: [{ id: 999 }] }));
    const mcp = await import('../../src/core/mcp-core.js');
    const res = await mcp.handleRequest({
      jsonrpc: '2.0', id: 904, method: 'tools/call',
      params: { name: 'create_lead', arguments: { name: 'Test', phone: '0612345678' } }
    });
    expect(res.result.content[0].text).toBeDefined();
  });

  it('line 797: single listing result summary (get_listing)', async () => {
    vi.resetModules();
    mockQueryFn = vi.fn(async (text) => {
      const t = String(text || '');
      if (t.includes('a.id = $1')) return {
        rows: [{ id: 1, title: 'Villa', price: 2000000, surface: 300, rooms: 5, bedrooms: 4, bathrooms: 3, city: 'Hay Riad', statut: 'vente', type_bien: 'Villa', agency_name: null, phone: null, description: null, posted_at: '2025-01-01', lat: null, lng: null, type: 'Vente' }]
      };
      if (t.includes('url_image')) return { rows: [] };
      if (t.includes('e.nom')) return { rows: [] };
      return { rows: [] };
    });
    const mcp = await import('../../src/core/mcp-core.js');
    const res = await mcp.handleRequest({
      jsonrpc: '2.0', id: 905, method: 'tools/call',
      params: { name: 'get_listing', arguments: { id: 1 } }
    });
    expect(res.result.content[0].text).toContain('Annonce #1');
  });
});

describe('mcp-core.js — get_listing edge cases', () => {
  it('get_listing not found', async () => {
    vi.resetModules();
    mockQueryFn = vi.fn(async () => ({ rows: [] }));
    const mcp = await import('../../src/core/mcp-core.js');
    const res = await mcp.handleRequest({
      jsonrpc: '2.0', id: 972, method: 'tools/call',
      params: { name: 'get_listing', arguments: { id: 99999 } }
    });
    expect(res.result._meta.data.error).toBeDefined();
  });

  it('get_listing invalid id', async () => {
    vi.resetModules();
    mockQueryFn = vi.fn(async () => ({ rows: [] }));
    const mcp = await import('../../src/core/mcp-core.js');
    const res = await mcp.handleRequest({
      jsonrpc: '2.0', id: 974, method: 'tools/call',
      params: { name: 'get_listing', arguments: { id: -1 } }
    });
    expect(res.result._meta.data.error).toBeDefined();
  });
});

describe('mcp-core.js — quartier_stats with transaction (lines 562-565)', () => {
  it('Vente transaction filter', async () => {
    vi.resetModules();
    mockQueryFn = vi.fn(async () => ({ rows: [] }));
    const mcp = await import('../../src/core/mcp-core.js');
    const res = await mcp.handleRequest({
      jsonrpc: '2.0', id: 980, method: 'tools/call',
      params: { name: 'get_quartier_stats', arguments: { transaction: 'Vente' } }
    });
    expect(res.result).toBeDefined();
  });

  it('Location transaction filter', async () => {
    vi.resetModules();
    mockQueryFn = vi.fn(async () => ({ rows: [] }));
    const mcp = await import('../../src/core/mcp-core.js');
    const res = await mcp.handleRequest({
      jsonrpc: '2.0', id: 981, method: 'tools/call',
      params: { name: 'get_quartier_stats', arguments: { transaction: 'Location' } }
    });
    expect(res.result).toBeDefined();
  });
});

describe('mcp-core.js — method dispatch edge cases', () => {
  it('notifications/initialized returns null', async () => {
    vi.resetModules();
    mockQueryFn = vi.fn(async () => ({ rows: [] }));
    const mcp = await import('../../src/core/mcp-core.js');
    const res = await mcp.handleRequest({ jsonrpc: '2.0', id: 1, method: 'notifications/initialized' });
    expect(res).toBeNull();
  });

  it('unknown method returns error', async () => {
    vi.resetModules();
    mockQueryFn = vi.fn(async () => ({ rows: [] }));
    const mcp = await import('../../src/core/mcp-core.js');
    const res = await mcp.handleRequest({ jsonrpc: '2.0', id: 2, method: 'unknown/method' });
    expect(res.error.code).toBe(-32601);
  });

  it('unknown tool returns error', async () => {
    vi.resetModules();
    mockQueryFn = vi.fn(async () => ({ rows: [] }));
    const mcp = await import('../../src/core/mcp-core.js');
    const res = await mcp.handleRequest({
      jsonrpc: '2.0', id: 3, method: 'tools/call',
      params: { name: 'nonexistent', arguments: {} }
    });
    expect(res.error.code).toBe(-32601);
  });

  it('initialize with supported version', async () => {
    vi.resetModules();
    mockQueryFn = vi.fn(async () => ({ rows: [] }));
    const mcp = await import('../../src/core/mcp-core.js');
    const res = await mcp.handleRequest({
      jsonrpc: '2.0', id: 4, method: 'initialize',
      params: { protocolVersion: mcp.MCP_VERSION }
    });
    expect(res.result.protocolVersion).toBe(mcp.MCP_VERSION);
  });

  it('initialize with unsupported version falls back', async () => {
    vi.resetModules();
    mockQueryFn = vi.fn(async () => ({ rows: [] }));
    const mcp = await import('../../src/core/mcp-core.js');
    const res = await mcp.handleRequest({
      jsonrpc: '2.0', id: 5, method: 'initialize',
      params: { protocolVersion: '0.0' }
    });
    expect(res.result.protocolVersion).toBe(mcp.MCP_VERSION);
  });

  it('tools/list returns TOOLS', async () => {
    vi.resetModules();
    mockQueryFn = vi.fn(async () => ({ rows: [] }));
    const mcp = await import('../../src/core/mcp-core.js');
    const res = await mcp.handleRequest({ jsonrpc: '2.0', id: 6, method: 'tools/list' });
    expect(res.result.tools.length).toBeGreaterThan(0);
  });
});
