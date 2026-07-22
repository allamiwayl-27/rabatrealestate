/**
 * query-mcp.js — Interroger le serveur MCP over SSE
 *
 * Usage:
 *   node query-mcp.js "tools/list"
 *   node query-mcp.js 'tools/call {"name":"list_villes","arguments":{}}'
 *   node query-mcp.js 'tools/call {"name":"search_listings","arguments":{"location":"Agdal","transaction":"Vente","pageSize":3}}'
 */

const http = require('http');
const https = require('https');

const SERVER = process.env.MCP_URL || 'http://localhost:3001';
const args = process.argv.slice(2);

// Si le premier argument est une URL, l'utiliser comme serveur
let query;
if (args.length > 0 && (args[0].startsWith('http://') || args[0].startsWith('https://'))) {
  query = args.slice(1).join(' ');
} else {
  query = args.join(' ');
}

if (!query) {
  console.error('Usage: node query-mcp.js [URL] "<method>"');
  console.error('  URL optionnelle (defaut: http://localhost:3001, ou via MCP_URL)');
  console.error('Exemples :');
  console.error('  node query-mcp.js "tools/list"');
  console.error("  node query-mcp.js 'tools/call {\"name\":\"list_villes\",\"arguments\":{}}'");
  console.error("  node query-mcp.js 'tools/call {\"name\":\"search_listings\",\"arguments\":{\"location\":\"Agdal\",\"transaction\":\"Vente\",\"pageSize\":2}}'");
  console.error("  node query-mcp.js https://realestatecapitale.ma/mcp 'tools/call {\"name\":\"list_villes\",\"arguments\":{}}'");
  console.error('  MCP_URL=https://realestatecapitale.ma/mcp node query-mcp.js "tools/list"');
  process.exit(1);
}

// Parser la commande
let method, params;
if (query.startsWith('tools/call ')) {
  method = 'tools/call';
  try {
    params = JSON.parse(query.slice(11));
  } catch {
    console.error('Erreur : arguments JSON invalides pour tools/call');
    process.exit(1);
  }
} else {
  method = query.trim();
  params = {};
}

function getTransport(url) {
  return url.startsWith('https://') ? https : http;
}

function sseConnect() {
  return new Promise((resolve, reject) => {
    const transport = getTransport(SERVER);
    const req = transport.get(`${SERVER}/sse`, (res) => {
      let buf = '';
      let msgBuffer = '';
      let resolved = false;

      res.on('data', (chunk) => {
        buf += chunk.toString();
        msgBuffer += chunk.toString();

        // Capturer l'event endpoint
        if (!resolved) {
          const m = buf.match(/event:\s*endpoint\s*\n\s*data:\s*({[^}]+})/);
          if (m) {
            resolved = true;
            const ep = JSON.parse(m[1]).endpoint;
            resolve({ res, endpoint: ep, close: () => req.destroy() });
          }
        }

        // Afficher les events message
        const lines = msgBuffer.split('\n');
        msgBuffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const msg = JSON.parse(line.slice(6));
              if (msg.result || msg.error) {
                console.log(JSON.stringify(msg, null, 2));
              }
            } catch {}
          }
        }
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    setTimeout(() => reject(new Error('Timeout connexion SSE (5s)')), 5000);
  });
}

async function main() {
  console.error('Connexion SSE...');
  const sse = await sseConnect();

  const sessionId = new URLSearchParams(sse.endpoint.split('?')[1]).get('sessionId');
  console.error(`Session: ${sessionId}`);
  console.error(`Requête: ${method}\n`);

  // Construire le message JSON-RPC
  const msg = { jsonrpc: '2.0', id: 1, method };
  if (method === 'tools/call' && params) {
    msg.params = params;
  }

  // Envoyer via POST
  await new Promise((resolve, reject) => {
    const data = JSON.stringify(msg);
    const transport = getTransport(SERVER);
    const req = transport.request(`${SERVER}/messages?sessionId=${sessionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        console.error(`POST /messages → ${res.statusCode} ${body}`);
        resolve();
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });

  // Attendre la réponse SSE
  await new Promise(r => setTimeout(r, 1500));
  sse.close();
  console.error('\nFait.');
}

main().catch(e => { console.error(`Erreur: ${e.message}`); process.exit(1); });
