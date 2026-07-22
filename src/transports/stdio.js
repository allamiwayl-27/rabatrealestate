#!/usr/bin/env node
/**
 * mcp-server.js — Serveur MCP stdio pour Real Estate Capitale
 *
 * Transport stdio, log sur stderr, messages JSON-RPC sur stdin/stdout.
 * La logique partagée (tools, handlers, DB) est dans mcp-core.js.
 *
 * Usage:
 *   node mcp-server.js
 *
 * Variables d'environnement :
 *   DATABASE_URL  (obligatoire) — ex: postgresql://scraper:admin@127.0.0.1:5432/mubawab
 */

const { handleRequest, logError, closeDb } = require('../core/mcp-core');

function sendMessage(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

async function main() {
  let buffer = '';

  process.stdin.on('data', async (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const msg = JSON.parse(trimmed);
        const response = await handleRequest(msg);
        if (response) sendMessage(response);
      } catch (err) {
        logError(err);
        sendMessage({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32700, message: 'Parse error' },
        });
      }
    }
  });

  process.stdin.on('end', async () => {
    await closeDb();
    process.exit(0);
  });
}

main().catch((err) => {
  logError(err);
  process.exit(1);
});
