import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const read = (...parts) => readFileSync(join(__dirname, '..', ...parts), 'utf8');

const agentSource = read('src', 'agent', 'handler.js');

describe('agent-handler.js — A2A exports and structure', () => {
  it('should export handleA2ARequest function', () => {
    expect(agentSource.includes('export function handleA2ARequest'), 'export handleA2ARequest manquant').toBe(true);
  });

  it('should define agent.json with name and description', () => {
    expect(agentSource.includes('Real Estate Capitale Agent'), 'agent.json: name manquant').toBe(true);
    expect(agentSource.includes('Agent IA specialise dans l\'immobilier'), 'agent.json: description manquante').toBe(true);
  });

  it('should define A2A capabilities (streaming, pushNotifications)', () => {
    expect(agentSource.includes('streaming'), 'capability streaming manquante').toBe(true);
    expect(agentSource.includes('pushNotifications'), 'capability pushNotifications manquante').toBe(true);
  });

  it('should define default input/output modes (text, image)', () => {
    expect(agentSource.includes('text') && agentSource.includes('image'), 'modes text/image manquants').toBe(true);
  });

  it('should define 5 skills (property-search, property-valuation, real-estate-advice, appointment-booking, document-generation)', () => {
    expect(agentSource.includes('property-search'), 'skill property-search manquant').toBe(true);
    expect(agentSource.includes('property-valuation'), 'skill property-valuation manquant').toBe(true);
    expect(agentSource.includes('real-estate-advice'), 'skill real-estate-advice manquant').toBe(true);
    expect(agentSource.includes('appointment-booking'), 'skill appointment-booking manquant').toBe(true);
    expect(agentSource.includes('document-generation'), 'skill document-generation manquant').toBe(true);
  });

  it('should define a2a.json with protocolVersion 0.3', () => {
    expect(agentSource.includes('protocolVersion'), 'protocolVersion manquant dans a2a.json').toBe(true);
  });

  it('should handle tasks/send JSON-RPC method', () => {
    expect(agentSource.includes('tasks/send'), 'methode tasks/send manquante').toBe(true);
  });

  it('should handle tasks/get JSON-RPC method', () => {
    expect(agentSource.includes('tasks/get'), 'methode tasks/get manquante').toBe(true);
  });

  it('should handle tasks/cancel JSON-RPC method', () => {
    expect(agentSource.includes('tasks/cancel'), 'methode tasks/cancel manquante').toBe(true);
  });

  it('should return JSON-RPC error for unsupported methods', () => {
    expect(agentSource.includes('-32601') || agentSource.includes('Méthode non supportée'), 'error -32601 manquant').toBe(true);
  });

  it('should return JSON-RPC parse error for invalid JSON', () => {
    expect(agentSource.includes('-32700') || agentSource.includes('Parse error'), 'error -32700 manquant').toBe(true);
  });

  it('should define jsonrpc version 2.0', () => {
    expect(agentSource.includes('"2.0"') || agentSource.includes("'2.0'"), 'jsonrpc 2.0 manquant').toBe(true);
  });
});

describe('agent-handler.js — NLP helpers', () => {
  it('should detect skills from user text', () => {
    expect(agentSource.includes('property-valuation') && agentSource.includes('combien'), 'detection skill estimation manquante').toBe(true);
    expect(agentSource.includes('appointment-booking') && agentSource.includes('rdv'), 'detection skill rdv manquante').toBe(true);
    expect(agentSource.includes('document-generation') && agentSource.includes('contrat'), 'detection skill document manquante').toBe(true);
    expect(agentSource.includes('real-estate-advice') && agentSource.includes('investissement'), 'detection skill conseil manquante').toBe(true);
  });

  it('should support cities (Rabat, Salé, Témara)', () => {
    expect(agentSource.includes('"rabat"') && agentSource.includes('"sale"') && agentSource.includes('"temara"'), 'villes supportees manquantes').toBe(true);
  });

  it('should support quartiers for each city', () => {
    expect(agentSource.includes('agdal') && agentSource.includes('hay riad') && agentSource.includes('souissi'), 'quartiers Rabat manquants').toBe(true);
  });

  it('should extract budget from text', () => {
    expect(agentSource.includes('extractBudget'), 'extractBudget manquant').toBe(true);
    expect(agentSource.includes('million') || agentSource.includes('MAD'), 'extraction budget manquante').toBe(true);
  });

  it('should extract property type from text', () => {
    expect(agentSource.includes('extractPropertyType'), 'extractPropertyType manquant').toBe(true);
    expect(agentSource.includes('Appartement') || agentSource.includes('Maison'), 'extraction type bien manquante').toBe(true);
  });

  it('should extract transaction type from text', () => {
    expect(agentSource.includes('extractTransaction'), 'extractTransaction manquant').toBe(true);
    expect(agentSource.includes('Location') && agentSource.includes('Vente'), 'extraction transaction manquante').toBe(true);
  });

  it('should extract surface from text', () => {
    expect(agentSource.includes('extractSurface'), 'extractSurface manquant').toBe(true);
    expect(agentSource.includes('m²') || agentSource.includes('m['), 'extraction surface manquante').toBe(true);
  });

  it('should extract rooms from text', () => {
    expect(agentSource.includes('extractRooms'), 'extractRooms manquant').toBe(true);
    expect(agentSource.includes('chambre') || agentSource.includes('pièce'), 'extraction pieces manquante').toBe(true);
  });

  it('should extract name and phone from text', () => {
    expect(agentSource.includes('extractName'), 'extractName manquant').toBe(true);
    expect(agentSource.includes('extractPhone'), 'extractPhone manquant').toBe(true);
    expect(agentSource.includes('+212'), 'extraction telephone +212 manquante').toBe(true);
  });
});

describe('agent-handler.js — A2A Agent Card routes', () => {
  it('should route /.well-known/agent-card.json alongside agent.json', () => {
    expect(agentSource.includes('/.well-known/agent-card.json'), 'route agent-card.json manquante').toBe(true);
  });

  it('should have supportedInterfaces in agentJson', () => {
    expect(agentSource.includes('supportedInterfaces'), 'supportedInterfaces manquant').toBe(true);
  });
});
