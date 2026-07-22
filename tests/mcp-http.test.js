/**
 * test-mcp-http.js — Test du serveur MCP over HTTP/SSE
 *
 * Usage: node tests/test-mcp-http.js
 * Prérequis : le serveur mcp-server-http.js doit tourner sur le port 3001
 */

const http = require('http');

const BASE = 'http://localhost:3001';
let passed = 0;
let failed = 0;

function assert(label, cond) {
  if (cond) { passed++; process.stdout.write(`  ${label} ... OK\n`); }
  else { failed++; process.stdout.write(`  ${label} ... FAIL\n`); }
}

function fetch(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = { method, hostname: url.hostname, port: url.port, path: url.pathname + url.search };
    if (body) opts.headers = { 'Content-Type': 'application/json' };

    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function sseConnect() {
  return new Promise((resolve, reject) => {
    const req = http.get(`${BASE}/sse`, (res) => {
      let buffer = '';
      let resolved = false;

      res.on('data', (chunk) => {
        if (resolved) return;
        buffer += chunk.toString();
        // Chercher event: endpoint et data: {endpoint: "..."}
        const epMatch = buffer.match(/event: endpoint\s*\n\s*data:\s*({[^}]+})/);
        if (epMatch) {
          resolved = true;
          const payload = JSON.parse(epMatch[1]);
          resolve({ close: () => req.destroy(), endpoint: payload.endpoint });
        }
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    setTimeout(() => reject(new Error('SSE connection timeout')), 5000);
  });
}

async function main() {
  console.log('Testing MCP HTTP/SSE server...\n');

  // 1. Health check
  const health = await fetch('GET', '/health');
  assert('GET /health returns 200', health.status === 200);
  assert('health.status === "ok"', health.body?.status === 'ok');

  // 2. 404 on unknown path
  const nf = await fetch('GET', '/unknown');
  assert('GET /unknown returns 404', nf.status === 404);

  // 3. SSE endpoint
  const sse1 = await sseConnect();
  assert('SSE endpoint returned', !!sse1.endpoint);
  assert('SSE endpoint contains sessionId', sse1.endpoint.includes('sessionId='));

  // 4. POST tools/list via SSE session
  const sessionId = new URLSearchParams(sse1.endpoint.split('?')[1]).get('sessionId');
  const msg = { jsonrpc: '2.0', id: 1, method: 'tools/list' };
  const postRes = await fetch('POST', `/messages?sessionId=${sessionId}`, msg);
  assert('POST /messages returns 202', postRes.status === 202);

  // Wait a bit for SSE response then close
  await new Promise(r => setTimeout(r, 500));
  sse1.close();

  // 5. POST without sessionId
  const noSession = await fetch('POST', '/messages', msg);
  assert('POST /messages without sessionId returns 404', noSession.status === 404);

  // 6. Multiple SSE connections
  const sse2 = await sseConnect();
  assert('Second SSE connection works', !!sse2.endpoint);
  sse2.close();

  // 7. Health check after sessions
  const health2 = await fetch('GET', '/health');
  assert('Health reports sessions', typeof health2.body?.sessions === 'number');

  console.log(`\n${passed}/${passed + failed} tests passed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error(`Fatal: ${e.message}`);
  process.exit(1);
});
