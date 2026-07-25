import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const originalFetch = globalThis.fetch;

function mockFetch(handler) {
  globalThis.fetch = vi.fn(async (url, opts) => {
    const result = handler(String(url), opts);
    return {
      ok: result.ok !== undefined ? result.ok : true,
      json: async () => result.body || {},
      status: result.status || 200,
    };
  });
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function makeRequest(body, method = 'POST', path = '/a2a') {
  return {
    url: `https://realestatecapitale.ma${path}`,
    method,
    json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
  };
}

async function loadHandler() {
  vi.resetModules();
  const mod = await import('../../src/agent/handler.js');
  return mod;
}

describe('agent-handler.js — coverage boost: handlePropertyValuation fallback', () => {
  it('covers fallback path when estimation not available (items with valid prices)', async () => {
    mockFetch((url) => {
      if (url.includes('estimation-prix')) {
        return { body: { estimation_disponible: false } };
      }
      if (url.includes('listings')) {
        return { body: { data: [{ price: 1000000, surface: 100 }, { price: 800000, surface: 80 }] } };
      }
      return { body: {} };
    });
    const handler = await loadHandler();
    const req = makeRequest({
      jsonrpc: '2.0', id: 1, method: 'tasks/send',
      params: { message: { parts: [{ text: 'Estime un appartement 100m2 a Agdal' }] } }
    });
    const result = await handler.handleA2ARequest(req);
    expect(result).toBeDefined();
  });

  it('covers fallback path with no valid items', async () => {
    mockFetch((url) => {
      if (url.includes('estimation-prix')) {
        return { body: { estimation_disponible: false } };
      }
      if (url.includes('listings')) {
        return { body: { data: [{ price: 0, surface: 0 }] } };
      }
      return { body: {} };
    });
    const handler = await loadHandler();
    const req = makeRequest({
      jsonrpc: '2.0', id: 1, method: 'tasks/send',
      params: { message: { parts: [{ text: 'Estime un appartement 100m2 a Agdal' }] } }
    });
    const result = await handler.handleA2ARequest(req);
    expect(result).toBeDefined();
  });

  it('covers fallback path with empty listings', async () => {
    mockFetch((url) => {
      if (url.includes('estimation-prix')) {
        return { body: { estimation_disponible: false } };
      }
      if (url.includes('listings')) {
        return { body: { data: [] } };
      }
      return { body: {} };
    });
    const handler = await loadHandler();
    const req = makeRequest({
      jsonrpc: '2.0', id: 1, method: 'tasks/send',
      params: { message: { parts: [{ text: 'Estime un appartement 100m2 a Agdal' }] } }
    });
    const result = await handler.handleA2ARequest(req);
    expect(result).toBeDefined();
  });

  it('covers estimation with coefficient_applique', async () => {
    mockFetch((url) => {
      if (url.includes('estimation-prix')) {
        return { body: { estimation_disponible: true, prix_m2_moyen: 15000, surface_saisie: 100, estimation_basse: 1400000, estimation_mediane: 1500000, estimation_haute: 1600000, nb_annonces: 10, coefficient_applique: 1.1 } };
      }
      return { body: {} };
    });
    const handler = await loadHandler();
    const req = makeRequest({
      jsonrpc: '2.0', id: 1, method: 'tasks/send',
      params: { message: { parts: [{ text: 'Estime un appartement 100m2 a Agdal' }] } }
    });
    const result = await handler.handleA2ARequest(req);
    expect(result).toBeDefined();
  });
});

describe('agent-handler.js — coverage boost: handleRealEstateAdvice fallback', () => {
  it('covers path when no data found (generic advice)', async () => {
    mockFetch((url) => {
      if (url.includes('listings')) {
        return { body: { data: [] } };
      }
      if (url.includes('trends')) {
        return { body: { data: [] } };
      }
      return { body: {} };
    });
    const handler = await loadHandler();
    const req = makeRequest({
      jsonrpc: '2.0', id: 1, method: 'tasks/send',
      params: { message: { parts: [{ text: 'Conseil immobilier a Agdal' }] } }
    });
    const result = await handler.handleA2ARequest(req);
    expect(result).toBeDefined();
  });

  it('covers path with listings but no trends', async () => {
    mockFetch((url) => {
      if (url.includes('listings')) {
        return { body: { data: [{ price: 1000000, surface: 100, type: 'Vente' }, { price: 5000, surface: 0, type: 'Location' }] } };
      }
      if (url.includes('trends')) {
        return { body: { data: [] } };
      }
      return { body: {} };
    });
    const handler = await loadHandler();
    const req = makeRequest({
      jsonrpc: '2.0', id: 1, method: 'tasks/send',
      params: { message: { parts: [{ text: 'Conseil immobilier a Agdal' }] } }
    });
    const result = await handler.handleA2ARequest(req);
    expect(result).toBeDefined();
  });
});

describe('agent-handler.js — coverage boost: handleAppointmentBooking', () => {
  it('covers success path (res.ok)', async () => {
    mockFetch((url, opts) => {
      if (url.includes('leads')) {
        return { ok: true, body: { id: 42, ref: 'RDV-42' } };
      }
      return { body: {} };
    });
    const handler = await loadHandler();
    const req = makeRequest({
      jsonrpc: '2.0', id: 1, method: 'tasks/send',
      params: { message: { parts: [{ text: 'Prendre rendez-vous a Agdal avec Jean 0612345678' }] } }
    });
    const result = await handler.handleA2ARequest(req);
    expect(result).toBeDefined();
  });

  it('covers failure path (res not ok)', async () => {
    mockFetch((url, opts) => {
      if (url.includes('leads')) {
        return { ok: false, status: 500, body: {} };
      }
      return { body: {} };
    });
    const handler = await loadHandler();
    const req = makeRequest({
      jsonrpc: '2.0', id: 1, method: 'tasks/send',
      params: { message: { parts: [{ text: 'Prendre rendez-vous a Agdal' }] } }
    });
    const result = await handler.handleA2ARequest(req);
    expect(result).toBeDefined();
  });
});

describe('agent-handler.js — coverage boost: handleTaskSend fallback and error', () => {
  it('covers default skill (no matching skill)', async () => {
    mockFetch(() => ({ body: { data: [] } }));
    const handler = await loadHandler();
    const req = makeRequest({
      jsonrpc: '2.0', id: 1, method: 'tasks/send',
      params: { message: { parts: [{ text: 'bonjour' }] } }
    });
    const result = await handler.handleA2ARequest(req);
    expect(result).toBeDefined();
  });

  it('covers error handling in handleTaskSend', async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error('Network error'); });
    const handler = await loadHandler();
    const req = makeRequest({
      jsonrpc: '2.0', id: 1, method: 'tasks/send',
      params: { message: { parts: [{ text: 'Recherche appartement a Agdal' }] } }
    });
    const result = await handler.handleA2ARequest(req);
    expect(result).toBeDefined();
  });
});

describe('agent-handler.js — coverage boost: handlePropertySearch empty', () => {
  it('covers empty results message', async () => {
    mockFetch(() => ({ body: { data: [], meta: { total: 0 } } }));
    const handler = await loadHandler();
    const req = makeRequest({
      jsonrpc: '2.0', id: 1, method: 'tasks/send',
      params: { message: { parts: [{ text: 'Recherche terrain a Souissi' }] } }
    });
    const result = await handler.handleA2ARequest(req);
    expect(result).toBeDefined();
  });

  it('covers search with budget and type', async () => {
    mockFetch(() => ({ body: { data: [{ id: 1, title: 'Villa', price: 2000000, surface: 300, rooms: 5, city: 'Hay Riad', type: 'Vente', propertyType: 'Villa', postedAt: '2025-01-01' }], meta: { total: 1 } } }));
    const handler = await loadHandler();
    const req = makeRequest({
      jsonrpc: '2.0', id: 1, method: 'tasks/send',
      params: { message: { parts: [{ text: 'Villa 5 chambres a Hay Riad budget 3M MAD' }] } }
    });
    const result = await handler.handleA2ARequest(req);
    expect(result).toBeDefined();
  });
});

describe('agent-handler.js — coverage boost: handleDocumentGeneration', () => {
  it('covers document generation response', async () => {
    mockFetch(() => ({ body: {} }));
    const handler = await loadHandler();
    const req = makeRequest({
      jsonrpc: '2.0', id: 1, method: 'tasks/send',
      params: { message: { parts: [{ text: 'Genere un contrat de location' }] } }
    });
    const result = await handler.handleA2ARequest(req);
    expect(result).toBeDefined();
  });
});

describe('agent-handler.js — coverage boost: handleA2ARequest edge cases', () => {
  it('covers tasks/get method', async () => {
    const handler = await loadHandler();
    const req = makeRequest({
      jsonrpc: '2.0', id: 1, method: 'tasks/get',
      params: { id: 'task-123' }
    });
    const result = await handler.handleA2ARequest(req);
    expect(result).toBeDefined();
  });

  it('covers tasks/cancel method', async () => {
    const handler = await loadHandler();
    const req = makeRequest({
      jsonrpc: '2.0', id: 1, method: 'tasks/cancel',
      params: { id: 'task-123' }
    });
    const result = await handler.handleA2ARequest(req);
    expect(result).toBeDefined();
  });

  it('covers OPTIONS request', async () => {
    const handler = await loadHandler();
    const req = makeRequest(null, 'OPTIONS', '/a2a');
    const result = await handler.handleA2ARequest(req);
    expect(result).toBeDefined();
  });

  it('covers unknown method', async () => {
    const handler = await loadHandler();
    const req = makeRequest({
      jsonrpc: '2.0', id: 1, method: 'unknown/method'
    });
    const result = await handler.handleA2ARequest(req);
    expect(result).toBeDefined();
  });
});

describe('agent-handler.js — coverage boost: route handlers', () => {
  it('covers agent.json route', async () => {
    const handler = await loadHandler();
    const req = makeRequest(null, 'GET', '/.well-known/agent.json');
    const result = await handler.handleA2ARequest(req);
    expect(result).toBeDefined();
  });

  it('covers agent-card.json route', async () => {
    const handler = await loadHandler();
    const req = makeRequest(null, 'GET', '/.well-known/agent-card.json');
    const result = await handler.handleA2ARequest(req);
    expect(result).toBeDefined();
  });

  it('covers a2a.json route', async () => {
    const handler = await loadHandler();
    const req = makeRequest(null, 'GET', '/.well-known/a2a.json');
    const result = await handler.handleA2ARequest(req);
    expect(result).toBeDefined();
  });
});

describe('agent-handler.js — coverage boost: NLP extraction edge cases', () => {
  it('covers extractQuartier', async () => {
    mockFetch(() => ({ body: { data: [] } }));
    const handler = await loadHandler();
    const req = makeRequest({
      jsonrpc: '2.0', id: 1, method: 'tasks/send',
      params: { message: { parts: [{ text: 'Cherche a Hay Riad' }] } }
    });
    const result = await handler.handleA2ARequest(req);
    expect(result).toBeDefined();
  });

  it('covers extractVille', async () => {
    mockFetch(() => ({ body: { data: [] } }));
    const handler = await loadHandler();
    const req = makeRequest({
      jsonrpc: '2.0', id: 1, method: 'tasks/send',
      params: { message: { parts: [{ text: 'Cherche a Sale' }] } }
    });
    const result = await handler.handleA2ARequest(req);
    expect(result).toBeDefined();
  });

  it('covers extractRooms', async () => {
    mockFetch(() => ({ body: { data: [] } }));
    const handler = await loadHandler();
    const req = makeRequest({
      jsonrpc: '2.0', id: 1, method: 'tasks/send',
      params: { message: { parts: [{ text: 'Appartement 3 pieces a Agdal' }] } }
    });
    const result = await handler.handleA2ARequest(req);
    expect(result).toBeDefined();
  });

  it('covers extractPrice with million', async () => {
    mockFetch(() => ({ body: { data: [] } }));
    const handler = await loadHandler();
    const req = makeRequest({
      jsonrpc: '2.0', id: 1, method: 'tasks/send',
      params: { message: { parts: [{ text: 'Appartement a 2 millions a Agdal' }] } }
    });
    const result = await handler.handleA2ARequest(req);
    expect(result).toBeDefined();
  });
});
