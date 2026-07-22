import { describe, it, expect } from 'vitest';

const agent = await import('../../src/agent/handler.js');

describe('agent-handler.js — real imports', () => {
  it('should export handleA2ARequest', () => {
    expect(typeof agent.handleA2ARequest).toBe('function');
  });

  it('should have agent card data', async () => {
    const req = new Request('https://example.com/.well-known/agent.json');
    const res = await agent.handleA2ARequest(req);
    const json = await res.json();
    expect(json.name).toContain('Real Estate Capitale');
    expect(json.version).toBe('1.0.0');
    expect(json.skills).toBeDefined();
    expect(json.skills.length).toBe(5);
    expect(json.supportedInterfaces).toBeDefined();
  });

  it('should have a2a.json descriptor', async () => {
    const req = new Request('https://example.com/.well-known/a2a.json');
    const res = await agent.handleA2ARequest(req);
    const json = await res.json();
    expect(json.protocolVersion).toBeDefined();
    expect(json.name).toContain('A2A');
  });

  it('should return 404 for unknown paths', async () => {
    const req = new Request('https://example.com/unknown');
    const res = await agent.handleA2ARequest(req);
    expect(res.status).toBe(404);
  });

  it('should handle tasks/send with property-search', async () => {
    const req = new Request('https://example.com/a2a', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'tasks/send',
        params: {
          message: { role: 'user', parts: [{ type: 'text', text: 'Appartement Agdal' }] }
        }
      })
    });
    const res = await agent.handleA2ARequest(req);
    const json = await res.json();
    expect(json.result).toBeDefined();
  });

  it('should handle tasks/send with valuation', async () => {
    const req = new Request('https://example.com/a2a', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 2, method: 'tasks/send',
        params: {
          message: { role: 'user', parts: [{ type: 'text', text: 'Estimez un appartement 100m2 Agdal' }] }
        }
      })
    });
    const res = await agent.handleA2ARequest(req);
    const json = await res.json();
    expect(json.result).toBeDefined();
  });

  it('should handle tasks/send with advice', async () => {
    const req = new Request('https://example.com/a2a', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 3, method: 'tasks/send',
        params: {
          message: { role: 'user', parts: [{ type: 'text', text: 'Conseil investissement immobilier' }] }
        }
      })
    });
    const res = await agent.handleA2ARequest(req);
    const json = await res.json();
    expect(json.result).toBeDefined();
  });

  it('should handle tasks/send with booking', async () => {
    const req = new Request('https://example.com/a2a', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 4, method: 'tasks/send',
        params: {
          message: { role: 'user', parts: [{ type: 'text', text: 'Prendre rendez-vous visite' }] }
        }
      })
    });
    const res = await agent.handleA2ARequest(req);
    const json = await res.json();
    expect(json.result).toBeDefined();
  });

  it('should return error for unknown JSON-RPC method', async () => {
    const req = new Request('https://example.com/a2a', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 5, method: 'unknown/method', params: {}
      })
    });
    const res = await agent.handleA2ARequest(req);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });
});
