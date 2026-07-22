#!/usr/bin/env node
/**
 * mcp-server-http.js — Serveur MCP over HTTP/SSE pour Real Estate Capitale
 *
 * Implémente le transport HTTP+SSE du protocole MCP.
 * La logique partagée (tools, handlers, DB) est dans mcp-core.js.
 *
 * Endpoints :
 *   GET  /             → Server info (Streamable HTTP discovery)
 *   POST /             → Streamable HTTP : requête JSON-RPC synchrone
 *   GET  /sse          → SSE stream (connexion persistante)
 *   POST /messages     → Réception des requêtes JSON-RPC (SSE)
 *   GET  /health       → Healthcheck
 *
 * Usage:
 *   node mcp-server-http.js
 *
 * Variables d'environnement :
 *   PORT          (defaut: 3001)
 *   DATABASE_URL  (obligatoire)
 */

const http = require('http');
const crypto = require('crypto');
const { handleRequest, logError, closeDb } = require('../core/mcp-core');

const PORT = 3001;

// Gestion des sessions SSE : sessionId → { res, lastSeen }
const sessions = new Map();

// Cleanup périodique des sessions orphelines (toutes les 5 min)
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.lastSeen > 600000) { // 10 min sans activité
      try { session.res.end(); } catch {}
      sessions.delete(id);
    }
  }
}, 300000).unref();

function sendSSE(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk.toString(); });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (e) { reject(new Error('Parse error')); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  process.stderr.write(`[MCP] ${req.method} ${pathname} from ${req.headers.host || '-'} ${req.headers['cf-ray'] || ''}\n`);

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // GET / — Server info (Streamable HTTP discovery)
  if (req.method === 'GET' && pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      status: 'ok',
      protocol: 'streamable-http',
      version: '2025-03-26',
      supportedTransports: ['sse', 'streamable-http'],
      uptime: process.uptime(),
      sessions: sessions.size
    }));
    return;
  }

  // POST / — Streamable HTTP : requête JSON-RPC synchrone
  if (req.method === 'POST' && pathname === '/') {
    let msg;
    try {
      msg = await parseBody(req);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }));
      return;
    }

    try {
      const response = await handleRequest(msg);
      if (response) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(response));
      } else {
        // Notification sans réponse
        res.writeHead(202, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ accepted: true }));
      }
    } catch (err) {
      logError(err);
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        id: msg?.id || null,
        error: { code: -32603, message: err.message },
      }));
    }
    return;
  }

  // GET /health
  if (req.method === 'GET' && pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime(), sessions: sessions.size }));
    return;
  }

  // GET /sse — connexion SSE persistante
  if (req.method === 'GET' && pathname === '/sse') {
    const sessionId = crypto.randomUUID();

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // Envoyer l'endpoint au client
    sendSSE(res, 'endpoint', { endpoint: `/messages?sessionId=${sessionId}` });

    sessions.set(sessionId, { res, lastSeen: Date.now() });

    // Heartbeat toutes les 15s
    const heartbeat = setInterval(() => {
      try { res.write(': heartbeat\n\n'); } catch { clearInterval(heartbeat); }
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
      sessions.delete(sessionId);
    });

    return;
  }

  // POST /messages — requête JSON-RPC
  if (req.method === 'POST' && pathname === '/messages') {
    const sessionId = parsedUrl.searchParams.get('sessionId');
    if (!sessionId || !sessions.has(sessionId)) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Session not found' }));
      return;
    }

    const session = sessions.get(sessionId);
    session.lastSeen = Date.now();

    let msg;
    try {
      msg = await parseBody(req);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }));
      return;
    }

    // Réponse immédiate au POST pour les notifications
    res.writeHead(202, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ accepted: true }));

    // Traiter la requête et envoyer la réponse via SSE
    try {
      const response = await handleRequest(msg);
      if (response) {
        sendSSE(session.res, 'message', response);
      }
    } catch (err) {
      logError(err);
      sendSSE(session.res, 'message', {
        jsonrpc: '2.0',
        id: msg?.id || null,
        error: { code: -32603, message: err.message },
      });
    }
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.on('error', (err) => {
  logError(`Server error: ${err.message}`);
  process.exit(1);
});

server.listen(PORT, () => {
  process.stderr.write(`[MCP] HTTP/SSE server listening on port ${PORT}\n`);
});

// Clean shutdown
async function shutdown() {
  process.stderr.write('\n[MCP] Shutting down...\n');
  server.close();
  for (const [, session] of sessions) {
    try { session.res.end(); } catch {}
  }
  sessions.clear();
  await closeDb();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
