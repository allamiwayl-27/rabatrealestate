import { describe, it, expect } from 'vitest';

const agent = await import('../../src/agent/handler.js');

describe('agent-handler.js — NLP detection', () => {
  it('detects property-valuation skill', async () => {
    const req = new Request('https://example.com/a2a', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'tasks/send',
        params: {
          message: { role: 'user', parts: [{ type: 'text', text: 'Combien vaut cet appartement?' }] }
        }
      })
    });
    const res = await agent.handleA2ARequest(req);
    const json = await res.json();
    expect(json.result).toBeDefined();
    expect(json.result.messages[0].parts[0].text).toContain('Estimation');
  });

  it('detects appointment-booking skill', async () => {
    const req = new Request('https://example.com/a2a', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 2, method: 'tasks/send',
        params: {
          message: { role: 'user', parts: [{ type: 'text', text: 'Je veux un rendez-vous pour visiter' }] }
        }
      })
    });
    const res = await agent.handleA2ARequest(req);
    const json = await res.json();
    expect(json.result.messages[0].parts[0].text).toContain('rendez-vous');
  });

  it('detects document-generation skill', async () => {
    const req = new Request('https://example.com/a2a', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 3, method: 'tasks/send',
        params: {
          message: { role: 'user', parts: [{ type: 'text', text: 'Generez un contrat de location' }] }
        }
      })
    });
    const res = await agent.handleA2ARequest(req);
    const json = await res.json();
    expect(json.result.messages[0].parts[0].text).toContain('documents');
  });

  it('detects real-estate-advice skill', async () => {
    const req = new Request('https://example.com/a2a', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 4, method: 'tasks/send',
        params: {
          message: { role: 'user', parts: [{ type: 'text', text: 'Donnez des conseils investissement immobilier' }] }
        }
      })
    });
    const res = await agent.handleA2ARequest(req);
    const json = await res.json();
    expect(json.result.messages[0].parts[0].text).toContain('Conseil');
  });

  it('defaults to property-search for unrecognized', async () => {
    const req = new Request('https://example.com/a2a', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 5, method: 'tasks/send',
        params: {
          message: { role: 'user', parts: [{ type: 'text', text: 'hello world' }] }
        }
      })
    });
    const res = await agent.handleA2ARequest(req);
    const json = await res.json();
    expect(json.result).toBeDefined();
  });
});

describe('agent-handler.js — location extraction', () => {
  it('extracts quartier from text', async () => {
    const req = new Request('https://example.com/a2a', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 10, method: 'tasks/send',
        params: {
          message: { role: 'user', parts: [{ type: 'text', text: 'Rechercher appartement Agdal 100m2' }] }
        }
      })
    });
    const res = await agent.handleA2ARequest(req);
    const json = await res.json();
    expect(json.result).toBeDefined();
  });

  it('extracts ville from text', async () => {
    const req = new Request('https://example.com/a2a', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 11, method: 'tasks/send',
        params: {
          message: { role: 'user', parts: [{ type: 'text', text: 'Maisons a vendre a Sale' }] }
        }
      })
    });
    const res = await agent.handleA2ARequest(req);
    const json = await res.json();
    expect(json.result).toBeDefined();
  });
});

describe('agent-handler.js — property search with no results', () => {
  it('handles empty results gracefully', async () => {
    const req = new Request('https://example.com/a2a', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 20, method: 'tasks/send',
        params: {
          message: { role: 'user', parts: [{ type: 'text', text: 'Studio 10m2 a Temara sous 100000 MAD' }] }
        }
      })
    });
    const res = await agent.handleA2ARequest(req);
    const json = await res.json();
    expect(json.result).toBeDefined();
  });
});

describe('agent-handler.js — valuation without quartier', () => {
  it('returns message asking for quartier', async () => {
    const req = new Request('https://example.com/a2a', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 30, method: 'tasks/send',
        params: {
          message: { role: 'user', parts: [{ type: 'text', text: 'Estimez un appartement 100m2' }] }
        }
      })
    });
    const res = await agent.handleA2ARequest(req);
    const json = await res.json();
    expect(json.result.messages[0].parts[0].text).toContain('quartier');
  });

  it('returns message asking for surface', async () => {
    const req = new Request('https://example.com/a2a', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 31, method: 'tasks/send',
        params: {
          message: { role: 'user', parts: [{ type: 'text', text: 'Estimez un appartement Agdal' }] }
        }
      })
    });
    const res = await agent.handleA2ARequest(req);
    const json = await res.json();
    expect(json.result.messages[0].parts[0].text).toContain('surface');
  });
});

describe('agent-handler.js — appointment booking', () => {
  it('creates a lead with name and phone', async () => {
    const req = new Request('https://example.com/a2a', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 40, method: 'tasks/send',
        params: {
          message: { role: 'user', parts: [{ type: 'text', text: 'Je suis Ahmed, rendez-vous visite Agdal,电话0612345678' }] }
        }
      })
    });
    const res = await agent.handleA2ARequest(req);
    const json = await res.json();
    expect(json.result.messages[0].parts[0].text).toContain('rendez-vous');
  });
});

describe('agent-handler.js — tasks/get and tasks/cancel', () => {
  it('returns task status for tasks/get', async () => {
    const req = new Request('https://example.com/a2a', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 50, method: 'tasks/get',
        params: { id: 'task-123' }
      })
    });
    const res = await agent.handleA2ARequest(req);
    const json = await res.json();
    expect(json.result.status.state).toBe('completed');
  });

  it('returns canceled for tasks/cancel', async () => {
    const req = new Request('https://example.com/a2a', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 51, method: 'tasks/cancel',
        params: { id: 'task-123' }
      })
    });
    const res = await agent.handleA2ARequest(req);
    const json = await res.json();
    expect(json.result.status.state).toBe('canceled');
  });
});

describe('agent-handler.js — CORS and OPTIONS', () => {
  it('handles OPTIONS request', async () => {
    const req = new Request('https://example.com/a2a', { method: 'OPTIONS' });
    const res = await agent.handleA2ARequest(req);
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});

describe('agent-handler.js — agent.json and agent-card.json', () => {
  it('returns agent card for /.well-known/agent.json', async () => {
    const req = new Request('https://example.com/.well-known/agent.json');
    const res = await agent.handleA2ARequest(req);
    const json = await res.json();
    expect(json.supportedInterfaces).toBeDefined();
    expect(json.capabilities).toBeDefined();
    expect(json.authentication).toBeDefined();
    expect(json.authentication.schemes).toContain('none');
  });

  it('returns agent card for /.well-known/agent-card.json', async () => {
    const req = new Request('https://example.com/.well-known/agent-card.json');
    const res = await agent.handleA2ARequest(req);
    expect(res.status).toBe(200);
  });
});

describe('agent-handler.js — a2a.json descriptor', () => {
  it('has all required fields', async () => {
    const req = new Request('https://example.com/.well-known/a2a.json');
    const res = await agent.handleA2ARequest(req);
    const json = await res.json();
    expect(json.name).toBeDefined();
    expect(json.description).toBeDefined();
    expect(json.url).toBeDefined();
    expect(json.version).toBe('1.0.0');
    expect(json.protocolVersion).toBe('0.3');
    expect(json.capabilities.streaming).toBe(true);
    expect(json.capabilities.pushNotifications).toBe(true);
    expect(json.defaultInputModes).toContain('text');
    expect(json.defaultOutputModes).toContain('text');
    expect(json.skills.length).toBe(5);
  });
});

describe('agent-handler.js — bad JSON body', () => {
  it('returns parse error for invalid JSON', async () => {
    const req = new Request('https://example.com/a2a', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json'
    });
    const res = await agent.handleA2ARequest(req);
    const json = await res.json();
    expect(json.error).toBeDefined();
    expect(json.error.code).toBe(-32700);
  });
});

describe('agent-handler.js — empty message', () => {
  it('handles empty text in message parts', async () => {
    const req = new Request('https://example.com/a2a', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 60, method: 'tasks/send',
        params: {
          message: { role: 'user', parts: [{ type: 'text', text: '' }] }
        }
      })
    });
    const res = await agent.handleA2ARequest(req);
    const json = await res.json();
    expect(json.result).toBeDefined();
  });
});

describe('agent-handler.js — task response structure', () => {
  it('returns proper A2A task response', async () => {
    const req = new Request('https://example.com/a2a', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 70, method: 'tasks/send',
        params: {
          message: { role: 'user', parts: [{ type: 'text', text: 'Recherche Appartement' }] }
        }
      })
    });
    const res = await agent.handleA2ARequest(req);
    const json = await res.json();
    expect(json.id).toBeDefined();
    expect(json.result.id).toContain('task-');
    expect(json.result.status.state).toBe('completed');
    expect(Array.isArray(json.result.messages)).toBe(true);
    expect(json.result.messages[0].role).toBe('agent');
    expect(json.result.messages[0].parts[0].type).toBe('text');
    expect(json.result.artifacts).toEqual([]);
  });
});
