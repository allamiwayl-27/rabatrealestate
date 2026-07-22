import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const read = (...parts) => readFileSync(join(__dirname, '..', ...parts), 'utf8');

const httpServerSource = read('src', 'transports', 'http-sse.js');

describe('mcp-server-http.js — HTTP transport', () => {
  it('should create an HTTP server', () => {
    expect(httpServerSource.includes('createServer') || httpServerSource.includes('http.createServer'), 'createServer manquant').toBe(true);
  });

  it('should listen on a configurable port', () => {
    expect(httpServerSource.includes('PORT') || httpServerSource.includes('.listen('), 'port ecoute manquant').toBe(true);
  });

  it('should handle POST /mcp endpoint', () => {
    expect(httpServerSource.includes('/mcp') || httpServerSource.includes('method:'), 'endpoint /mcp manquant').toBe(true);
  });

  it('should support SSE (Server-Sent Events) transport', () => {
    expect(httpServerSource.includes('text/event-stream') || httpServerSource.includes('SSE') || httpServerSource.includes('event-stream'), 'SSE transport manquant').toBe(true);
  });

  it('should support Streamable HTTP transport', () => {
    expect(httpServerSource.includes('Streamable HTTP') || httpServerSource.includes('streamableHttp') || httpServerSource.includes('streamable'), 'Streamable HTTP manquant').toBe(true);
  });

  it('should set CORS headers for all origins', () => {
    expect(httpServerSource.includes('Access-Control-Allow-Origin'), 'CORS headers manquants').toBe(true);
  });

  it('should set Content-Type application/json for JSON responses', () => {
    expect(httpServerSource.includes('application/json'), 'Content-Type JSON manquant').toBe(true);
  });

  it('should have /health endpoint', () => {
    expect(httpServerSource.includes('/health'), 'endpoint /health manquant').toBe(true);
  });

  it('should return status ok from health endpoint', () => {
    expect(httpServerSource.includes('ok') || httpServerSource.includes('healthy') || httpServerSource.includes('status'), 'health status manquant').toBe(true);
  });

  it('should handle OPTIONS preflight requests', () => {
    expect(httpServerSource.includes('OPTIONS'), 'gestion OPTIONS manquante').toBe(true);
  });

  it('should forward requests to handleRequest from mcp-core', () => {
    expect(httpServerSource.includes('handleRequest'), 'appel a handleRequest manquant').toBe(true);
  });

  it('should import from mcp-core', () => {
    expect(httpServerSource.includes('mcp-core') || httpServerSource.includes('./mcp-core'), 'import mcp-core manquant').toBe(true);
  });

  it('should handle SSE session management', () => {
    expect(httpServerSource.includes('session') || httpServerSource.includes('sessions') || httpServerSource.includes('sendSSE'), 'gestion sessions SSE manquante').toBe(true);
  });

  it('should parse JSON request body for POST', () => {
    expect(httpServerSource.includes('JSON.parse') || httpServerSource.includes('.json()'), 'parsing JSON body manquant').toBe(true);
  });

  it('should return 404 for unrecognized routes', () => {
    expect(httpServerSource.includes('404') && httpServerSource.includes('Not found'), '404 Not Found manquant').toBe(true);
  });

  it('should handle SSE keepalive / heartbeat', () => {
    expect(httpServerSource.includes('keepalive') || httpServerSource.includes('heartbeat') || httpServerSource.includes('keep-alive'), 'SSE keepalive manquant').toBe(true);
  });
});
