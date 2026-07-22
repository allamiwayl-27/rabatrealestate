import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://scraper:admin@localhost:5432/mubawab';
process.env.PORT = '0';

const { handleRequest, logError, closeDb } = await import('../../src/core/mcp-core.js');

function createTestServer() {
  const sessions = new Map();
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost`);
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    if (req.method === 'GET' && url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', protocol: 'streamable-http' }));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/') {
      let body = '';
      for await (const chunk of req) body += chunk;
      try {
        const msg = JSON.parse(body);
        const response = await handleRequest(msg);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Parse error' }));
      }
      return;
    }

    if (req.method === 'GET' && url.pathname === '/sse') {
      const sessionId = crypto.randomUUID();
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
      res.write(`event: endpoint\ndata: {"endpoint":"/messages?sessionId=${sessionId}"}\n\n`);
      sessions.set(sessionId, res);
      req.on('close', () => sessions.delete(sessionId));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/messages') {
      const sessionId = url.searchParams.get('sessionId');
      if (!sessionId || !sessions.has(sessionId)) {
        res.writeHead(404); res.end('Session not found'); return;
      }
      let body = '';
      for await (const chunk of req) body += chunk;
      res.writeHead(202); res.end('accepted');
      try {
        const msg = JSON.parse(body);
        const response = await handleRequest(msg);
        if (response) {
          const s = sessions.get(sessionId);
          s.write(`event: message\ndata: ${JSON.stringify(response)}\n\n`);
        }
      } catch {}
      return;
    }

    res.writeHead(404); res.end('Not found');
  });
}

let server;
let baseUrl;

beforeAll(async () => {
  server = createTestServer();
  await new Promise(resolve => server.listen(0, resolve));
  const { port } = server.address();
  baseUrl = `http://localhost:${port}`;
});

afterAll(async () => {
  server.close();
  await closeDb();
});

function fetchJSON(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const payload = body ? JSON.stringify(body) : null;
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: { 'Content-Type': 'application/json' },
    };
    if (payload) opts.headers['Content-Length'] = Buffer.byteLength(payload);
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

describe('HTTP server — real', () => {
  it('GET / should return server info', async () => {
    const res = await fetchJSON('GET', '/');
    expect(res.status).toBe(200);
    expect(res.body.protocol).toBe('streamable-http');
  });

  it('GET /health should return ok', async () => {
    const res = await fetchJSON('GET', '/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('POST / with initialize should return server info', async () => {
    const res = await fetchJSON('POST', '/', {
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2025-03-26' }
    });
    expect(res.status).toBe(200);
    expect(res.body.result.serverInfo).toBeDefined();
  });

  it('POST / with tools/list should return tools', async () => {
    const res = await fetchJSON('POST', '/', {
      jsonrpc: '2.0', id: 2, method: 'tools/list', params: {}
    });
    expect(res.status).toBe(200);
    expect(res.body.result.tools.length).toBe(17);
  });

  it('POST / with tools/call list_villes should work', async () => {
    const res = await fetchJSON('POST', '/', {
      jsonrpc: '2.0', id: 3, method: 'tools/call',
      params: { name: 'list_villes', arguments: {} }
    });
    expect(res.status).toBe(200);
    expect(res.body.result._meta.data.data).toBeDefined();
  });

  it('GET /unknown should return 404', async () => {
    const url = new URL('/unknown', baseUrl);
    const res = await new Promise((resolve, reject) => {
      const req = http.get(url, r => {
        let data = '';
        r.on('data', c => data += c);
        r.on('end', () => resolve({ status: r.statusCode, body: data }));
      });
      req.on('error', reject);
    });
    expect(res.status).toBe(404);
  });

  it('POST / with bad JSON should return 400', async () => {
    const url = new URL('/', baseUrl);
    const res = await new Promise((resolve, reject) => {
      const req = http.request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, r => {
        let data = '';
        r.on('data', c => data += c);
        r.on('end', () => resolve({ status: r.statusCode, body: data }));
      });
      req.on('error', reject);
      req.write('not json');
      req.end();
    });
    expect(res.status).toBe(400);
  });
});

describe('SSE transport — real', () => {
  it('GET /sse should return SSE stream', async () => {
    const res = await new Promise((resolve, reject) => {
      const req = http.get(`${baseUrl}/sse`, res => {
        let data = '';
        res.on('data', c => {
          data += c.toString();
          if (data.includes('event: endpoint')) {
            resolve({ status: res.statusCode, body: data });
            req.destroy();
          }
        });
      });
      req.on('error', reject);
      setTimeout(() => { req.destroy(); reject(new Error('timeout')); }, 3000);
    });
    expect(res.status).toBe(200);
    expect(res.body).toContain('event: endpoint');
    expect(res.body).toContain('sessionId');
  });
});
