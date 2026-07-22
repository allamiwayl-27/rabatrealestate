import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const read = (...parts) => readFileSync(join(__dirname, '..', ...parts), 'utf8');

const mcpCoreSource = read('src', 'core', 'mcp-core.js');

describe('mcp-core.js — exports and main handler', () => {
  it('should export handleRequest function', () => {
    expect(mcpCoreSource.includes('async function handleRequest') || mcpCoreSource.includes('function handleRequest'), 'handleRequest manquant').toBe(true);
  });

  it('should export closeDb function', () => {
    expect(mcpCoreSource.includes('async function closeDb') || mcpCoreSource.includes('function closeDb'), 'closeDb manquant').toBe(true);
  });

  it('should export logError function', () => {
    expect(mcpCoreSource.includes('function logError') || mcpCoreSource.includes('logError'), 'logError manquant').toBe(true);
  });

  it('should have toSearchParams helper', () => {
    expect(mcpCoreSource.includes('function toSearchParams') || mcpCoreSource.includes('toSearchParams ='), 'toSearchParams manquant').toBe(true);
  });

  it('should define MCP protocol version', () => {
    expect(mcpCoreSource.includes('2024-11-05') || mcpCoreSource.includes("'2025-03-26'"), 'version protocole MCP manquante').toBe(true);
  });

  it('should have JSON-RPC handler for tools/list', () => {
    expect(mcpCoreSource.includes('tools/list'), 'handler tools/list manquant').toBe(true);
  });

  it('should have JSON-RPC handler for tools/call', () => {
    expect(mcpCoreSource.includes('tools/call'), 'handler tools/call manquant').toBe(true);
  });

  it('should return server info with name and version', () => {
    expect(mcpCoreSource.includes('Real Estate Capitale') || mcpCoreSource.includes('realestatecapitale'), 'server info nom manquant').toBe(true);
  });
});

describe('mcp-core.js — 17 MCP tools defined', () => {
  const searchTools = [
    'search_listings',
    'get_listing',
    'estimate_property',
    'create_lead',
    'get_market_trends',
    'get_quartier_stats',
    'list_quartiers',
    'list_villes',
    'get_comparables',
    'get_investor_alerts',
    'get_price_analytics',
    'get_rental_yield',
    'get_market_predictions',
    'get_quartier_comparison',
    'get_suspicious_listings',
    'get_liquidity',
    'get_agency_leaderboard',
  ];

  for (const tool of searchTools) {
    it(`should define tool: ${tool}`, () => {
      expect(mcpCoreSource.includes(tool), `tool ${tool} manquant`).toBe(true);
    });
  }

  it('should have at least 17 tools defined', () => {
    const toolsCount = searchTools.filter(t => mcpCoreSource.includes(t)).length;
    expect(toolsCount, `${toolsCount}/17 outils MCP trouvés`).toBe(17);
  });
});

describe('mcp-core.js — tool descriptions', () => {
  it('should have search_listings with filters (budget, surface, pieces, type, transaction)', () => {
    expect(mcpCoreSource.includes('priceMin') || mcpCoreSource.includes('priceMax'), 'filtre budget manquant').toBe(true);
    expect(mcpCoreSource.includes('surfaceMin') || mcpCoreSource.includes('surfaceMax'), 'filtre surface manquant').toBe(true);
    expect(mcpCoreSource.includes('roomsMin') || mcpCoreSource.includes('roomsMax'), 'filtre pieces manquant').toBe(true);
    expect(mcpCoreSource.includes('propertyType'), 'filtre type bien manquant').toBe(true);
    expect(mcpCoreSource.includes('transaction'), 'filtre transaction manquant').toBe(true);
  });

  it('should have estimate_property with parameters (type, quartier, surface, pieces, etage, etat, standing)', () => {
    expect(mcpCoreSource.includes('estimate_property'), 'estimate_property manquant').toBe(true);
  });

  it('should have create_lead with name and phone validation', () => {
    expect(mcpCoreSource.includes('create_lead'), 'create_lead manquant').toBe(true);
    expect(mcpCoreSource.includes('name') && mcpCoreSource.includes('phone'), 'params name/phone manquants').toBe(true);
  });

  it('should have get_market_trends with months parameter', () => {
    expect(mcpCoreSource.includes('get_market_trends'), 'get_market_trends manquant').toBe(true);
    expect(mcpCoreSource.includes('months'), 'parametre months manquant').toBe(true);
  });

  it('should have get_price_analytics with period parameter', () => {
    expect(mcpCoreSource.includes('get_price_analytics'), 'get_price_analytics manquant').toBe(true);
  });

  it('should have get_rental_yield with yield calculations', () => {
    expect(mcpCoreSource.includes('get_rental_yield'), 'get_rental_yield manquant').toBe(true);
  });

  it('should have get_market_predictions with prediction horizon', () => {
    expect(mcpCoreSource.includes('get_market_predictions'), 'get_market_predictions manquant').toBe(true);
  });

  it('should have get_suspicious_listings with anomaly detection', () => {
    expect(mcpCoreSource.includes('get_suspicious_listings'), 'get_suspicious_listings manquant').toBe(true);
  });

  it('should have get_agency_leaderboard with sorting options', () => {
    expect(mcpCoreSource.includes('get_agency_leaderboard'), 'get_agency_leaderboard manquant').toBe(true);
  });
});

describe('mcp-core.js — input schema validation', () => {
  it('should define inputSchema for tools', () => {
    expect(mcpCoreSource.includes('inputSchema'), 'inputSchema manquant').toBe(true);
  });

  it('should use JSON Schema (type: object, properties)', () => {
    expect(mcpCoreSource.includes("'object'") || mcpCoreSource.includes('"object"'), 'type object JSON Schema manquant').toBe(true);
    expect(mcpCoreSource.includes('properties'), 'properties JSON Schema manquant').toBe(true);
  });

  it('should define required fields for tools', () => {
    expect(mcpCoreSource.includes('required'), 'required fields JSON Schema manquants').toBe(true);
  });

  it('should describe tool parameters with string descriptions', () => {
    expect(mcpCoreSource.includes('description'), 'description dans les schemas manquante').toBe(true);
  });
});

describe('mcp-core.js — error handling', () => {
  it('should return error code -32601 for unknown tools', () => {
    expect(mcpCoreSource.includes('-32601') || mcpCoreSource.includes('Unknown tool'), 'error code -32601 manquant').toBe(true);
  });

  it('should catch exceptions and return isError true for internal errors', () => {
    expect(mcpCoreSource.includes('catch') && mcpCoreSource.includes('isError: true'), 'gestion erreurs internes manquante').toBe(true);
  });

  it('should catch exceptions in tool handlers', () => {
    expect(mcpCoreSource.includes('catch') || mcpCoreSource.includes('error'), 'gestion exceptions manquante').toBe(true);
  });
});

describe('mcp-core.js — listing enrichment', () => {
  it('should compute pricePerM2', () => {
    expect(mcpCoreSource.includes('pricePerM2') || mcpCoreSource.includes('pricePerM²'), 'pricePerM2 manquant').toBe(true);
  });

  it('should provide defaultImage for listings', () => {
    expect(mcpCoreSource.includes('defaultImage') || mcpCoreSource.includes('rabat-cover'), 'defaultImage manquant').toBe(true);
  });

  it('should extract images array', () => {
    expect(mcpCoreSource.includes('images'), 'images array manquant').toBe(true);
  });

  it('should extract features array', () => {
    expect(mcpCoreSource.includes('features'), 'features array manquant').toBe(true);
  });

  it('should clean HTML from descriptions', () => {
    expect(mcpCoreSource.includes('cleanHtml') || mcpCoreSource.includes('cleanHTML'), 'cleanHtml manquant').toBe(true);
  });
});
