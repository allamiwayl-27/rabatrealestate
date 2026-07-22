const { spawn } = require('child_process');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://scraper:admin@127.0.0.1:5432/mubawab';

const scenarios = [
  { name: 'list_quartiers', msg: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'list_quartiers', arguments: {} } } },
  { name: 'list_villes', msg: { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'list_villes', arguments: {} } } },
  { name: 'search_listings (Agdal)', msg: { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'search_listings', arguments: { location: 'agdal', pageSize: 3 } } } },
  { name: 'estimate_property', msg: { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'estimate_property', arguments: { type: 'vente', quartier: 'agdal', surface: 120 } } } },
  { name: 'get_market_trends', msg: { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'get_market_trends', arguments: { months: 6 } } } },
  { name: 'get_quartier_stats', msg: { jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'get_quartier_stats', arguments: { transaction: 'Vente' } } } },
  { name: 'create_lead', msg: { jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'create_lead', arguments: { name: 'Test MCP', phone: '0612345678' } } } },
  { name: 'create_lead (validation error - expected)', msg: { jsonrpc: '2.0', id: 8, method: 'tools/call', params: { name: 'create_lead', arguments: { name: 'X', phone: '0612345678' } } } },
];

async function callMcp(scenario) {
  return new Promise((resolve, reject) => {
    const mcp = spawn('node', [path.join(__dirname, '..', 'bin', 'mcp-server')], {
      env: { ...process.env, DATABASE_URL },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let output = '';
    let errOutput = '';
    mcp.stdout.on('data', (data) => { output += data.toString(); });
    mcp.stderr.on('data', (data) => { errOutput += data.toString(); });

    const timer = setTimeout(() => {
      mcp.kill();
      const lines = output.trim().split('\n').filter(Boolean);
      const last = lines[lines.length - 1];
      try {
        resolve({ result: JSON.parse(last), stderr: errOutput });
      } catch (e) {
        reject(new Error('Pas de reponse JSON. stdout: ' + output.substring(0, 200)));
      }
    }, 5000);

    mcp.on('error', (e) => { clearTimeout(timer); reject(e); });

    // Initialize handshake
    mcp.stdin.write(JSON.stringify({
      jsonrpc: '2.0', id: 0, method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } },
    }) + '\n');

    setTimeout(() => {
      mcp.stdin.write(JSON.stringify(scenario.msg) + '\n');
    }, 200);
  });
}

async function main() {
  let passed = 0;
  let failed = 0;

  for (const s of scenarios) {
    process.stdout.write(`\n  ${s.name} ... `);
    try {
      const { result } = await callMcp(s);
      if (result.result?.isError) {
        const txt = result.result?.content?.[0]?.text || '';
        if (s.name.includes('validation error')) {
          console.log(`OK (expected error: ${txt.substring(0, 60)})`);
          passed++;
        } else {
          console.log(`ERROR: ${txt.substring(0, 100)}`);
          failed++;
        }
      } else {
        console.log('OK');
        passed++;
      }
    } catch (e) {
      console.log(`FAIL: ${e.message}`);
      failed++;
    }
  }

  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
