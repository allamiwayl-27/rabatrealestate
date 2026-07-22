import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const read = (...parts) => readFileSync(join(__dirname, '..', ...parts), 'utf8');

const agentsWorkerSource = read('src', 'agent', 'worker.js');

describe('agents/worker.js — API Catalog (RFC 9727)', () => {
  it('should export default fetch handler', () => {
    expect(agentsWorkerSource.includes('export default'), 'export default manquant').toBe(true);
    expect(agentsWorkerSource.includes('async fetch(request)'), 'fetch handler manquant').toBe(true);
  });

  it('should have handleApiCatalog function', () => {
    expect(agentsWorkerSource.includes('function handleApiCatalog()'), 'handleApiCatalog() manquant').toBe(true);
  });

  it('should return application/linkset+json with profile header', () => {
    expect(agentsWorkerSource.includes("'Content-Type': 'application/linkset+json; profile=\"' + CATALOG_PROFILE + '\"'"), 'Content-Type linkset+json manquant').toBe(true);
  });

  it('should define CATALOG_PROFILE pointing to RFC 9727', () => {
    expect(agentsWorkerSource.includes("https://www.rfc-editor.org/info/rfc9727"), 'URL RFC 9727 manquante').toBe(true);
  });

  it('should catalog 3 APIs (REST, MCP, A2A)', () => {
    const apiMatches = agentsWorkerSource.match(/anchor:/g);
    expect(apiMatches ? apiMatches.length : 0, 'nombre d\'API dans le catalog != 3').toBe(3);
  });

  it('should route /.well-known/api-catalog', () => {
    expect(agentsWorkerSource.includes('/.well-known/api-catalog'), 'route /.well-known/api-catalog manquante').toBe(true);
  });

  it('should set Cache-Control public max-age=3600', () => {
    expect(agentsWorkerSource.includes("'Cache-Control': 'public, max-age=3600'"), 'Cache-Control manquant').toBe(true);
  });

  it('should set Vary: Accept header', () => {
    expect(agentsWorkerSource.includes("'Vary': 'Accept'"), 'Vary Accept manquant').toBe(true);
  });
});

describe('agents/worker.js — Auth.md OAuth metadata endpoints', () => {
  it('should have handleOAuthProtectedResource function', () => {
    expect(agentsWorkerSource.includes('function handleOAuthProtectedResource('), 'handleOAuthProtectedResource manquant').toBe(true);
  });

  it('should have handleOAuthAuthorizationServer function', () => {
    expect(agentsWorkerSource.includes('function handleOAuthAuthorizationServer()'), 'handleOAuthAuthorizationServer manquant').toBe(true);
  });

  it('should serve /.well-known/oauth-protected-resource', () => {
    expect(agentsWorkerSource.includes('/.well-known/oauth-protected-resource'), 'route oauth-protected-resource manquante').toBe(true);
  });

  it('should serve /.well-known/oauth-authorization-server', () => {
    expect(agentsWorkerSource.includes('/.well-known/oauth-authorization-server'), 'route oauth-authorization-server manquante').toBe(true);
  });

  it('should define agent_auth block in AS metadata', () => {
    expect(agentsWorkerSource.includes('agent_auth'), 'agent_auth block manquant').toBe(true);
  });

  it('should define identity_types_supported in agent_auth', () => {
    expect(agentsWorkerSource.includes('identity_types_supported'), 'identity_types_supported manquant').toBe(true);
  });

  it('should have authorization_servers in PRM', () => {
    expect(agentsWorkerSource.includes('authorization_servers'), 'authorization_servers manquant').toBe(true);
  });

  it('should have scopes_supported in PRM', () => {
    expect(agentsWorkerSource.includes('scopes_supported'), 'scopes_supported manquant').toBe(true);
  });

  it('should have bearer_methods_supported in PRM', () => {
    expect(agentsWorkerSource.includes('bearer_methods_supported'), 'bearer_methods_supported manquant').toBe(true);
  });
});

describe('agents/worker.js — agent.json and a2a.json endpoints', () => {
  it('should define agent.json with name, description, url', () => {
    expect(agentsWorkerSource.includes('Real Estate Capitale Agent'), 'agent.json: name manquant').toBe(true);
    expect(agentsWorkerSource.includes('Agent IA spécialisé'), 'agent.json: description manquante').toBe(true);
    expect(agentsWorkerSource.includes('realestatecapitale.ma/a2a'), 'agent.json: url manquante').toBe(true);
  });

  it('should define agent.json capabilities (streaming, pushNotifications)', () => {
    expect(agentsWorkerSource.includes('streaming'), 'capability streaming manquante').toBe(true);
    expect(agentsWorkerSource.includes('pushNotifications'), 'capability pushNotifications manquante').toBe(true);
  });

  it('should route /.well-known/agent.json', () => {
    expect(agentsWorkerSource.includes('/.well-known/agent.json'), 'route /.well-known/agent.json manquante').toBe(true);
  });

  it('should route /.well-known/a2a.json', () => {
    expect(agentsWorkerSource.includes('/.well-known/a2a.json'), 'route /.well-known/a2a.json manquante').toBe(true);
  });

  it('should define a2a.json with agent name', () => {
    expect(agentsWorkerSource.includes('Real Estate Capitale A2A'), 'a2a.json: name manquant').toBe(true);
  });

  it('should reuse agent skills in a2a.json', () => {
    expect(agentsWorkerSource.includes('a2aJson') && agentsWorkerSource.includes('agentJson.skills'), 'a2a.json: skills reuse manquant').toBe(true);
  });

  it('should set authentication schemes to none', () => {
    expect(agentsWorkerSource.includes('"none"') || agentsWorkerSource.includes("'none'"), 'auth none manquant').toBe(true);
  });
});

describe('agents/worker.js — JSON-RPC /a2a handler', () => {
  it('should route POST /a2a endpoint', () => {
    expect(agentsWorkerSource.includes('/a2a') && agentsWorkerSource.includes('POST'), 'endpoint POST /a2a manquant').toBe(true);
  });

  it('should handle tasks/send method', () => {
    expect(agentsWorkerSource.includes('tasks/send'), 'methode tasks/send manquante').toBe(true);
  });

  it('should handle tasks/get method', () => {
    expect(agentsWorkerSource.includes('tasks/get'), 'methode tasks/get manquante').toBe(true);
  });

  it('should handle tasks/cancel method', () => {
    expect(agentsWorkerSource.includes('tasks/cancel'), 'methode tasks/cancel manquante').toBe(true);
  });

  it('should return JSON-RPC error for unknown methods', () => {
    expect(agentsWorkerSource.includes('-32601'), 'error -32601 manquant').toBe(true);
  });

  it('should return JSON-RPC parse error for invalid JSON', () => {
    expect(agentsWorkerSource.includes('-32700'), 'error -32700 manquant').toBe(true);
  });

  it('should handle OPTIONS preflight requests', () => {
    expect(agentsWorkerSource.includes('OPTIONS'), 'gestion OPTIONS manquante').toBe(true);
  });

  it('should set CORS headers for all endpoints', () => {
    expect(agentsWorkerSource.includes('Access-Control-Allow-Origin'), 'CORS headers manquants').toBe(true);
  });
});

describe('agents/worker.js — NLP skills and extraction', () => {
  it('should detect skills (property-search, property-valuation, appointment-booking, document-generation, real-estate-advice)', () => {
    expect(agentsWorkerSource.includes('property-search'), 'detectSkill: property-search manquant').toBe(true);
    expect(agentsWorkerSource.includes('property-valuation'), 'detectSkill: property-valuation manquant').toBe(true);
    expect(agentsWorkerSource.includes('appointment-booking'), 'detectSkill: appointment-booking manquant').toBe(true);
    expect(agentsWorkerSource.includes('document-generation'), 'detectSkill: document-generation manquant').toBe(true);
    expect(agentsWorkerSource.includes('real-estate-advice'), 'detectSkill: real-estate-advice manquant').toBe(true);
  });

  it('should support multiple cities (Rabat, Salé, Témara)', () => {
    expect(agentsWorkerSource.includes('"rabat"'), 'ville rabat manquante').toBe(true);
    expect(agentsWorkerSource.includes('"salé"') || agentsWorkerSource.includes('"sale"'), 'ville salé manquante').toBe(true);
    expect(agentsWorkerSource.includes('"témara"') || agentsWorkerSource.includes('"temara"'), 'ville témara manquante').toBe(true);
  });

  it('should support quartiers for each city', () => {
    expect(agentsWorkerSource.includes('agdal'), 'quartier agdal manquant').toBe(true);
    expect(agentsWorkerSource.includes('hay riad'), 'quartier hay riad manquant').toBe(true);
  });

  it('should extractLocation from text', () => {
    expect(agentsWorkerSource.includes('extractLocation'), 'extractLocation manquant').toBe(true);
  });

  it('should extractBudget from text with MAD/million support', () => {
    expect(agentsWorkerSource.includes('extractBudget'), 'extractBudget manquant').toBe(true);
    expect(agentsWorkerSource.includes('MAD') || agentsWorkerSource.includes('million'), 'support MAD/million manquant').toBe(true);
  });

  it('should extractPropertyType (Appartement, Maison, Villa, Studio, Terrain, Bureau, Commerce, Riad)', () => {
    expect(agentsWorkerSource.includes('extractPropertyType'), 'extractPropertyType manquant').toBe(true);
    expect(agentsWorkerSource.includes('Appartement') && agentsWorkerSource.includes('Villa'), 'types bien manquants').toBe(true);
  });

  it('should extractTransaction (Vente, Location)', () => {
    expect(agentsWorkerSource.includes('extractTransaction'), 'extractTransaction manquant').toBe(true);
    expect(agentsWorkerSource.includes('Vente') && agentsWorkerSource.includes('Location'), 'transactions manquantes').toBe(true);
  });

  it('should extractSurface in m²', () => {
    expect(agentsWorkerSource.includes('extractSurface'), 'extractSurface manquant').toBe(true);
  });

  it('should extractRooms (chambre, pièce)', () => {
    expect(agentsWorkerSource.includes('extractRooms'), 'extractRooms manquant').toBe(true);
  });

  it('should extractName and extractPhone', () => {
    expect(agentsWorkerSource.includes('extractName'), 'extractName manquant').toBe(true);
    expect(agentsWorkerSource.includes('extractPhone'), 'extractPhone manquant').toBe(true);
    expect(agentsWorkerSource.includes('+212'), 'support +212 manquant').toBe(true);
  });
});

describe('agents/worker.js — skill handlers', () => {
  it('should handle property search with API call to backend', () => {
    expect(agentsWorkerSource.includes('handlePropertySearch'), 'handlePropertySearch manquant').toBe(true);
    expect(agentsWorkerSource.includes('/api/listings'), 'appel API listings manquant').toBe(true);
  });

  it('should handle property valuation with estimation', () => {
    expect(agentsWorkerSource.includes('handlePropertyValuation'), 'handlePropertyValuation manquant').toBe(true);
    expect(agentsWorkerSource.includes('/api/estimation-prix'), 'appel API estimation manquant').toBe(true);
  });

  it('should handle real estate advice with market trends', () => {
    expect(agentsWorkerSource.includes('handleRealEstateAdvice'), 'handleRealEstateAdvice manquant').toBe(true);
    expect(agentsWorkerSource.includes('/api/market/trends'), 'appel API trends manquant').toBe(true);
  });

  it('should handle appointment booking with lead creation', () => {
    expect(agentsWorkerSource.includes('handleAppointmentBooking'), 'handleAppointmentBooking manquant').toBe(true);
    expect(agentsWorkerSource.includes('/api/leads'), 'appel API leads manquant').toBe(true);
  });

  it('should handle document generation', () => {
    expect(agentsWorkerSource.includes('handleDocumentGeneration'), 'handleDocumentGeneration manquant').toBe(true);
  });

  it('should format response with task ID and completed status', () => {
    expect(agentsWorkerSource.includes('completed'), 'etat completed manquant dans reponse').toBe(true);
    expect(agentsWorkerSource.includes('task-'), 'task ID prefix manquant').toBe(true);
  });

  it('should include agent role in response messages', () => {
    expect(agentsWorkerSource.includes('"agent"') || agentsWorkerSource.includes("'agent'"), 'role agent manquant dans message').toBe(true);
  });
});

describe('agents/worker.js — MCP Server Card (SEP-2127)', () => {
  it('should have handleMcpServerCard function', () => {
    expect(agentsWorkerSource.includes('function handleMcpServerCard()'), 'handleMcpServerCard() manquant').toBe(true);
  });

  it('should use reverse-DNS name with single slash', () => {
    expect(agentsWorkerSource.includes("name: 'ma.realestatecapitale/mcp'"), 'reverse-DNS name manquant').toBe(true);
  });

  it('should have $schema pointing to static.modelcontextprotocol.io', () => {
    expect(agentsWorkerSource.includes('static.modelcontextprotocol.io/schemas/v1/server-card.schema.json'), 'schema URL manquante').toBe(true);
  });

  it('should return Content-Type application/mcp-server-card+json', () => {
    expect(agentsWorkerSource.includes("'Content-Type': 'application/mcp-server-card+json'"), 'Content-Type mcp-server-card+json manquant').toBe(true);
  });

  it('should have CORS headers', () => {
    expect(agentsWorkerSource.includes("'Access-Control-Allow-Origin': '*'"), 'CORS header manquant').toBe(true);
    expect(agentsWorkerSource.includes("'Access-Control-Allow-Methods': 'GET'"), 'CORS methods manquant').toBe(true);
  });

  it('should define remotes with streamable-http transport', () => {
    expect(agentsWorkerSource.includes("type: 'streamable-http'"), 'streamable-http transport manquant').toBe(true);
  });

  it('should route /mcp/server-card endpoint', () => {
    expect(agentsWorkerSource.includes("/mcp/server-card"), 'route /mcp/server-card manquante').toBe(true);
  });

  it('should also route /.well-known/mcp/server-card.json for scanner compatibility', () => {
    expect(agentsWorkerSource.includes('/.well-known/mcp/server-card.json'), 'route /.well-known/mcp/server-card.json manquante').toBe(true);
  });

  it('should have Cache-Control public max-age=3600', () => {
    expect(agentsWorkerSource.includes("'Cache-Control': 'public, max-age=3600'"), 'Cache-Control manquant').toBe(true);
  });
});

describe('agents/worker.js — AI Catalog (Agent Card / SEP-2127)', () => {
  it('should have handleAiCatalog function', () => {
    expect(agentsWorkerSource.includes('function handleAiCatalog()'), 'handleAiCatalog() manquant').toBe(true);
  });

  it('should have AI_CATALOG constant with specVersion', () => {
    expect(agentsWorkerSource.includes("specVersion: '1.0'"), 'specVersion 1.0 manquant').toBe(true);
  });

  it('should return Content-Type application/ai-catalog+json', () => {
    expect(agentsWorkerSource.includes("'Content-Type': 'application/ai-catalog+json'"), 'Content-Type ai-catalog+json manquant').toBe(true);
  });

  it('should define an entry with mcp-server-card type', () => {
    expect(agentsWorkerSource.includes("type: 'application/mcp-server-card+json'"), 'entry type mcp-server-card+json manquant').toBe(true);
  });

  it('should have entry URL pointing to /mcp/server-card', () => {
    expect(agentsWorkerSource.includes("url: 'https://realestatecapitale.ma/mcp/server-card'"), 'entry url manquant').toBe(true);
  });

  it('should include alternativeUrls with well-known path', () => {
    expect(agentsWorkerSource.includes('alternativeUrls'), 'alternativeUrls manquant').toBe(true);
    expect(agentsWorkerSource.includes('/.well-known/mcp/server-card.json'), 'well-known alternative URL manquante').toBe(true);
  });

  it('should have identifier in AIR format', () => {
    expect(agentsWorkerSource.includes('urn:air:'), 'AIR identifier manquant').toBe(true);
  });

  it('should route /.well-known/ai-catalog.json', () => {
    expect(agentsWorkerSource.includes('/.well-known/ai-catalog.json'), 'route /.well-known/ai-catalog.json manquante').toBe(true);
  });
});

describe('agents/worker.js — OAuth Protected Resource Metadata (RFC 9728)', () => {
  it('should have handleOAuthProtectedResource function', () => {
    expect(agentsWorkerSource.includes('function handleOAuthProtectedResource('), 'handleOAuthProtectedResource manquant').toBe(true);
  });

  it('should accept requestUrl parameter for dynamic resource', () => {
    expect(agentsWorkerSource.includes('function handleOAuthProtectedResource(requestUrl)'), 'requestUrl param manquant').toBe(true);
  });

  it('should derive resource from request origin', () => {
    expect(agentsWorkerSource.includes("new URL(requestUrl).origin"), 'origin extraction manquante').toBe(true);
  });

  it('should route /.well-known/oauth-protected-resource', () => {
    expect(agentsWorkerSource.includes('/.well-known/oauth-protected-resource'), 'route PRM manquante').toBe(true);
  });
});

describe('agents/worker.js — A2A Agent Card', () => {
  it('should route /.well-known/agent-card.json', () => {
    expect(agentsWorkerSource.includes('/.well-known/agent-card.json'), 'route agent-card.json manquante').toBe(true);
  });

  it('should have supportedInterfaces in agentJson', () => {
    expect(agentsWorkerSource.includes('supportedInterfaces'), 'supportedInterfaces manquant').toBe(true);
  });
});

describe('agents/worker.js — Agent Skills Discovery Index', () => {
  it('should have handleAgentSkillsIndex function', () => {
    expect(agentsWorkerSource.includes('function handleAgentSkillsIndex()'), 'handleAgentSkillsIndex manquant').toBe(true);
  });

  it('should have AGENT_SKILLS_INDEX constant', () => {
    expect(agentsWorkerSource.includes('AGENT_SKILLS_INDEX'), 'AGENT_SKILLS_INDEX manquant').toBe(true);
  });

  it('should include $schema for agent skills discovery', () => {
    expect(agentsWorkerSource.includes('schemas.agentskills.io/discovery/0.2.0/schema.json'), 'schema URL agent skills manquant').toBe(true);
  });

  it('should route /.well-known/agent-skills/index.json', () => {
    expect(agentsWorkerSource.includes('/.well-known/agent-skills/index.json'), 'route agent-skills/index.json manquante').toBe(true);
  });

  it('should have skills array with at least 3 entries', () => {
    expect(agentsWorkerSource.includes("name: 'mcp-server'"), 'skill mcp-server manquante').toBe(true);
    expect(agentsWorkerSource.includes("name: 'a2a-agent'"), 'skill a2a-agent manquante').toBe(true);
    expect(agentsWorkerSource.includes("name: 'oauth-auth'"), 'skill oauth-auth manquante').toBe(true);
  });
});
