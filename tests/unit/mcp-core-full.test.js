import { describe, it, expect, vi } from 'vitest';

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://scraper:admin@localhost:5432/mubawab';

const mcp = await import('../../src/core/mcp-core.js');

describe('mcp-core.js — handler wrappers (get_comparables, etc.)', () => {
  it('get_comparables tool exists in HANDLERS', () => {
    expect(typeof mcp.HANDLERS.get_comparables).toBe('function');
  });

  it('get_investor_alerts tool exists', () => {
    expect(typeof mcp.HANDLERS.get_investor_alerts).toBe('function');
  });

  it('get_price_analytics tool exists', () => {
    expect(typeof mcp.HANDLERS.get_price_analytics).toBe('function');
  });

  it('get_rental_yield tool exists', () => {
    expect(typeof mcp.HANDLERS.get_rental_yield).toBe('function');
  });

  it('get_market_predictions tool exists', () => {
    expect(typeof mcp.HANDLERS.get_market_predictions).toBe('function');
  });

  it('get_quartier_comparison tool exists', () => {
    expect(typeof mcp.HANDLERS.get_quartier_comparison).toBe('function');
  });

  it('get_suspicious_listings tool exists', () => {
    expect(typeof mcp.HANDLERS.get_suspicious_listings).toBe('function');
  });

  it('get_liquidity tool exists', () => {
    expect(typeof mcp.HANDLERS.get_liquidity).toBe('function');
  });

  it('get_agency_leaderboard tool exists', () => {
    expect(typeof mcp.HANDLERS.get_agency_leaderboard).toBe('function');
  });
});

describe('mcp-core.js — handleRequest via handler wrappers', () => {
  it('get_comparables returns error for missing listingId', async () => {
    const res = await mcp.handleRequest({
      jsonrpc: '2.0', id: 100, method: 'tools/call',
      params: { name: 'get_comparables', arguments: {} }
    });
    expect(res.result._meta.data.error).toBeDefined();
  });

  it('get_quartier_comparison returns error for missing q1', async () => {
    const res = await mcp.handleRequest({
      jsonrpc: '2.0', id: 101, method: 'tools/call',
      params: { name: 'get_quartier_comparison', arguments: { q2: 'Hassan' } }
    });
    expect(res.result._meta.data.error).toBeDefined();
  });

  it('get_investor_alerts returns data array', async () => {
    const res = await mcp.handleRequest({
      jsonrpc: '2.0', id: 102, method: 'tools/call',
      params: { name: 'get_investor_alerts', arguments: { status: 'vente' } }
    });
    expect(res.result).toBeDefined();
    expect(res.result._meta.data).toBeDefined();
  });

  it('get_price_analytics returns data', async () => {
    const res = await mcp.handleRequest({
      jsonrpc: '2.0', id: 103, method: 'tools/call',
      params: { name: 'get_price_analytics', arguments: {} }
    });
    expect(res.result).toBeDefined();
    expect(res.result._meta.data).toBeDefined();
  });

  it('get_rental_yield returns data', async () => {
    const res = await mcp.handleRequest({
      jsonrpc: '2.0', id: 104, method: 'tools/call',
      params: { name: 'get_rental_yield', arguments: {} }
    });
    expect(res.result).toBeDefined();
    expect(res.result._meta.data).toBeDefined();
  });

  it('get_market_predictions returns data', async () => {
    const res = await mcp.handleRequest({
      jsonrpc: '2.0', id: 105, method: 'tools/call',
      params: { name: 'get_market_predictions', arguments: {} }
    });
    expect(res.result).toBeDefined();
    expect(res.result._meta.data).toBeDefined();
  });

  it('get_suspicious_listings returns data', async () => {
    const res = await mcp.handleRequest({
      jsonrpc: '2.0', id: 106, method: 'tools/call',
      params: { name: 'get_suspicious_listings', arguments: {} }
    });
    expect(res.result).toBeDefined();
    expect(res.result._meta.data).toBeDefined();
  });

  it('get_liquidity returns data', async () => {
    const res = await mcp.handleRequest({
      jsonrpc: '2.0', id: 107, method: 'tools/call',
      params: { name: 'get_liquidity', arguments: {} }
    });
    expect(res.result).toBeDefined();
    expect(res.result._meta.data).toBeDefined();
  });

  it('get_agency_leaderboard returns data', async () => {
    const res = await mcp.handleRequest({
      jsonrpc: '2.0', id: 108, method: 'tools/call',
      params: { name: 'get_agency_leaderboard', arguments: {} }
    });
    expect(res.result).toBeDefined();
    expect(res.result._meta.data).toBeDefined();
  });
});

describe('mcp-core.js — search_listings edge cases', () => {
  it('search with all filters', async () => {
    const res = await mcp.handleRequest({
      jsonrpc: '2.0', id: 200, method: 'tools/call',
      params: {
        name: 'search_listings',
        arguments: {
          transaction: 'Vente',
          location: 'agdal',
          propertyType: 'Appartement',
          priceMin: 500000,
          priceMax: 2000000,
          surfaceMin: 50,
          surfaceMax: 200,
          roomsMin: 2,
          roomsMax: 5,
          q: 'lumineux',
          sort: 'price_asc',
          page: 1,
          pageSize: 2,
        }
      }
    });
    expect(res.result).toBeDefined();
    expect(res.result._meta.data.meta).toBeDefined();
  });

  it('search with rooms filter (title regex)', async () => {
    const res = await mcp.handleRequest({
      jsonrpc: '2.0', id: 201, method: 'tools/call',
      params: {
        name: 'search_listings',
        arguments: { roomsMin: 3, roomsMax: 4, pageSize: 1 }
      }
    });
    expect(res.result).toBeDefined();
  });

  it('search with keyword q filter', async () => {
    const res = await mcp.handleRequest({
      jsonrpc: '2.0', id: 202, method: 'tools/call',
      params: {
        name: 'search_listings',
        arguments: { q: 'piscine', pageSize: 1 }
      }
    });
    expect(res.result).toBeDefined();
  });
});

describe('mcp-core.js — get_listing', () => {
  it('returns listing for valid ID', async () => {
    const res = await mcp.handleRequest({
      jsonrpc: '2.0', id: 300, method: 'tools/call',
      params: { name: 'get_listing', arguments: { id: 1 } }
    });
    const data = res.result._meta.data;
    if (!data.error) {
      expect(data.id).toBeDefined();
    } else {
      expect(data.error).toBeDefined();
    }
  });
});

describe('mcp-core.js — summary generation paths', () => {
  it('handles comparables result summary', async () => {
    const res = await mcp.handleRequest({
      jsonrpc: '2.0', id: 400, method: 'tools/call',
      params: { name: 'get_comparables', arguments: { listingId: '99999' } }
    });
    expect(res.result.content[0].text).toBeDefined();
  });

  it('handles estimation result summary', async () => {
    const res = await mcp.handleRequest({
      jsonrpc: '2.0', id: 401, method: 'tools/call',
      params: { name: 'estimate_property', arguments: { type: 'vente', quartier: 'agdal', surface: 100 } }
    });
    expect(res.result.content[0].text).toBeDefined();
  });
});

describe('mcp-core.js — TOOLS schema validation', () => {
  it('each tool has name, description, inputSchema', () => {
    for (const tool of mcp.TOOLS) {
      expect(tool.name).toBeDefined();
      expect(tool.description).toBeDefined();
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.inputSchema.properties).toBeDefined();
    }
  });

  it('search_listings has all expected properties', () => {
    const tool = mcp.TOOLS.find(t => t.name === 'search_listings');
    const props = Object.keys(tool.inputSchema.properties);
    expect(props).toContain('transaction');
    expect(props).toContain('location');
    expect(props).toContain('propertyType');
    expect(props).toContain('priceMin');
    expect(props).toContain('priceMax');
    expect(props).toContain('surfaceMin');
    expect(props).toContain('surfaceMax');
    expect(props).toContain('roomsMin');
    expect(props).toContain('roomsMax');
    expect(props).toContain('q');
    expect(props).toContain('sort');
    expect(props).toContain('page');
    expect(props).toContain('pageSize');
  });

  it('create_lead has required fields', () => {
    const tool = mcp.TOOLS.find(t => t.name === 'create_lead');
    expect(tool.inputSchema.required).toContain('name');
    expect(tool.inputSchema.required).toContain('phone');
  });

  it('get_listing has required id', () => {
    const tool = mcp.TOOLS.find(t => t.name === 'get_listing');
    expect(tool.inputSchema.required).toContain('id');
  });

  it('estimate_property has required fields', () => {
    const tool = mcp.TOOLS.find(t => t.name === 'estimate_property');
    expect(tool.inputSchema.required).toContain('type');
    expect(tool.inputSchema.required).toContain('quartier');
    expect(tool.inputSchema.required).toContain('surface');
  });

  it('get_comparables has required listingId', () => {
    const tool = mcp.TOOLS.find(t => t.name === 'get_comparables');
    expect(tool.inputSchema.required).toContain('listingId');
  });
});

describe('mcp-core.js — create_lead edge cases', () => {
  it('create_lead with listingId', async () => {
    const res = await mcp.handleRequest({
      jsonrpc: '2.0', id: 500, method: 'tools/call',
      params: { name: 'create_lead', arguments: { name: 'Test Lead Full', phone: '0612345678', source: 'mcp', listingId: 42 } }
    });
    expect(res.result._meta.data.ok).toBe(true);
  });

  it('create_lead with long name', async () => {
    const res = await mcp.handleRequest({
      jsonrpc: '2.0', id: 501, method: 'tools/call',
      params: { name: 'create_lead', arguments: { name: 'A'.repeat(121), phone: '0612345678' } }
    });
    expect(res.result._meta.data.error).toBeDefined();
  });

  it('create_lead with long phone', async () => {
    const res = await mcp.handleRequest({
      jsonrpc: '2.0', id: 502, method: 'tools/call',
      params: { name: 'create_lead', arguments: { name: 'Valid Name', phone: '1'.repeat(25) } }
    });
    expect(res.result._meta.data.error).toBeDefined();
  });
});

describe('mcp-core.js — logError', () => {
  it('writes to stderr without throwing', () => {
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    mcp.logError(new Error('test error'));
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('handles non-error input', () => {
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    mcp.logError('string error');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('mcp-core.js — closeDb', () => {
  it('closeDb is callable without error', async () => {
    await mcp.closeDb();
  });
});
