import { describe, it, expect, beforeAll, afterAll } from 'vitest';

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://scraper:admin@localhost:5432/mubawab';

const mcp = await import('../../src/core/mcp-core.js');

describe('mcp-core.js — real imports', () => {
  it('should export handleRequest', () => {
    expect(typeof mcp.handleRequest).toBe('function');
  });

  it('should export getDb', () => {
    expect(typeof mcp.getDb).toBe('function');
  });

  it('should export closeDb', () => {
    expect(typeof mcp.closeDb).toBe('function');
  });

  it('should export logError', () => {
    expect(typeof mcp.logError).toBe('function');
  });

  it('should export TOOLS array with 17 tools', () => {
    expect(Array.isArray(mcp.TOOLS)).toBe(true);
    expect(mcp.TOOLS.length).toBe(17);
  });

  it('should export HANDLERS object with 17 handlers', () => {
    expect(typeof mcp.HANDLERS).toBe('object');
    const handlerKeys = Object.keys(mcp.HANDLERS);
    expect(handlerKeys.length).toBe(17);
  });

  it('should have MCP_VERSION', () => {
    expect(mcp.MCP_VERSION).toBe('2025-03-26');
  });
});

describe('mcp-core.js — initialize', () => {
  it('should return server info on initialize', async () => {
    const res = await mcp.handleRequest({
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2025-03-26' }
    });
    expect(res.jsonrpc).toBe('2.0');
    expect(res.id).toBe(1);
    expect(res.result.serverInfo.name).toContain('realestatecapitale');
    expect(res.result.capabilities.tools).toBeDefined();
  });

  it('should fallback to default version on unknown protocol', async () => {
    const res = await mcp.handleRequest({
      jsonrpc: '2.0', id: 2, method: 'initialize',
      params: { protocolVersion: '9999-01-01' }
    });
    expect(res.result.protocolVersion).toBe('2025-03-26');
  });
});

describe('mcp-core.js — tools/list', () => {
  it('should return all 17 tools', async () => {
    const res = await mcp.handleRequest({
      jsonrpc: '2.0', id: 3, method: 'tools/list', params: {}
    });
    expect(res.result.tools.length).toBe(17);
    const names = res.result.tools.map(t => t.name);
    expect(names).toContain('search_listings');
    expect(names).toContain('get_listing');
    expect(names).toContain('estimate_property');
    expect(names).toContain('create_lead');
  });
});

describe('mcp-core.js — tools/call with DB', () => {
  it('list_quartiers should return data', async () => {
    const res = await mcp.handleRequest({
      jsonrpc: '2.0', id: 10, method: 'tools/call',
      params: { name: 'list_quartiers', arguments: {} }
    });
    expect(res.result.isError).toBeFalsy();
    expect(res.result._meta.data.data).toBeDefined();
    expect(Array.isArray(res.result._meta.data.data)).toBe(true);
  });

  it('list_villes should return data', async () => {
    const res = await mcp.handleRequest({
      jsonrpc: '2.0', id: 11, method: 'tools/call',
      params: { name: 'list_villes', arguments: {} }
    });
    expect(res.result.isError).toBeFalsy();
    expect(Array.isArray(res.result._meta.data.data)).toBe(true);
  });

  it('search_listings should return paginated results', async () => {
    const res = await mcp.handleRequest({
      jsonrpc: '2.0', id: 12, method: 'tools/call',
      params: { name: 'search_listings', arguments: { pageSize: 3 } }
    });
    expect(res.result.isError).toBeFalsy();
    const data = res.result._meta.data;
    expect(data.data).toBeDefined();
    expect(data.meta).toBeDefined();
    expect(data.meta.pageSize).toBe(3);
  });

  it('search_listings with location filter', async () => {
    const res = await mcp.handleRequest({
      jsonrpc: '2.0', id: 13, method: 'tools/call',
      params: { name: 'search_listings', arguments: { location: 'agdal', pageSize: 2 } }
    });
    expect(res.result.isError).toBeFalsy();
    expect(Array.isArray(res.result._meta.data.data)).toBe(true);
  });

  it('get_market_trends should return data', async () => {
    const res = await mcp.handleRequest({
      jsonrpc: '2.0', id: 14, method: 'tools/call',
      params: { name: 'get_market_trends', arguments: { months: 6 } }
    });
    expect(res.result.isError).toBeFalsy();
    expect(res.result._meta.data.data).toBeDefined();
  });

  it('get_quartier_stats should return data', async () => {
    const res = await mcp.handleRequest({
      jsonrpc: '2.0', id: 15, method: 'tools/call',
      params: { name: 'get_quartier_stats', arguments: {} }
    });
    expect(res.result.isError).toBeFalsy();
    expect(Array.isArray(res.result._meta.data.data)).toBe(true);
  });

  it('create_lead should succeed', async () => {
    const res = await mcp.handleRequest({
      jsonrpc: '2.0', id: 16, method: 'tools/call',
      params: { name: 'create_lead', arguments: { name: 'Test MCP Vitest', phone: '0612345678' } }
    });
    expect(res.result._meta.data.ok).toBe(true);
    expect(Number(res.result._meta.data.id)).toBeGreaterThan(0);
  });

  it('create_lead should validate name length', async () => {
    const res = await mcp.handleRequest({
      jsonrpc: '2.0', id: 17, method: 'tools/call',
      params: { name: 'create_lead', arguments: { name: 'X', phone: '0612345678' } }
    });
    expect(res.result._meta.data.error).toBeDefined();
  });

  it('create_lead should validate phone length', async () => {
    const res = await mcp.handleRequest({
      jsonrpc: '2.0', id: 18, method: 'tools/call',
      params: { name: 'create_lead', arguments: { name: 'Valid Name', phone: '123' } }
    });
    expect(res.result._meta.data.error).toBeDefined();
  });
});

describe('mcp-core.js — error handling', () => {
  it('should return error for unknown tool', async () => {
    const res = await mcp.handleRequest({
      jsonrpc: '2.0', id: 20, method: 'tools/call',
      params: { name: 'nonexistent_tool', arguments: {} }
    });
    expect(res.error).toBeDefined();
    expect(res.error.code).toBe(-32601);
  });

  it('should return error for unknown method', async () => {
    const res = await mcp.handleRequest({
      jsonrpc: '2.0', id: 21, method: 'unknown/method', params: {}
    });
    expect(res.error).toBeDefined();
    expect(res.error.code).toBe(-32601);
  });

  it('should return null for notifications/initialized', async () => {
    const res = await mcp.handleRequest({
      jsonrpc: '2.0', id: null, method: 'notifications/initialized', params: {}
    });
    expect(res).toBeNull();
  });
});

describe('mcp-core.js — get_listing with invalid ID', () => {
  it('should return error for invalid ID', async () => {
    const res = await mcp.handleRequest({
      jsonrpc: '2.0', id: 30, method: 'tools/call',
      params: { name: 'get_listing', arguments: { id: -1 } }
    });
    expect(res.result._meta.data.error).toBeDefined();
  });

  it('should return error for non-existent listing', async () => {
    const res = await mcp.handleRequest({
      jsonrpc: '2.0', id: 31, method: 'tools/call',
      params: { name: 'get_listing', arguments: { id: 99999999 } }
    });
    expect(res.result._meta.data.error).toBeDefined();
  });
});

describe('mcp-core.js — estimate_property validation', () => {
  it('should return error for invalid type', async () => {
    const res = await mcp.handleRequest({
      jsonrpc: '2.0', id: 40, method: 'tools/call',
      params: { name: 'estimate_property', arguments: { type: 'invalid', quartier: 'agdal', surface: 100 } }
    });
    expect(res.result._meta.data.error).toBeDefined();
  });

  it('should return error for missing quartier', async () => {
    const res = await mcp.handleRequest({
      jsonrpc: '2.0', id: 41, method: 'tools/call',
      params: { name: 'estimate_property', arguments: { type: 'vente', quartier: '', surface: 100 } }
    });
    expect(res.result._meta.data.error).toBeDefined();
  });

  it('should return error for invalid surface', async () => {
    const res = await mcp.handleRequest({
      jsonrpc: '2.0', id: 42, method: 'tools/call',
      params: { name: 'estimate_property', arguments: { type: 'vente', quartier: 'agdal', surface: -10 } }
    });
    expect(res.result._meta.data.error).toBeDefined();
  });
});
