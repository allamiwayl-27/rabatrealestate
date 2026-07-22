const BACKEND_URL = "https://api.realestatecapitale.ma";

const agentJson = {
  "name": "Real Estate Capitale Agent",
  "description": "Agent IA spécialisé dans l'immobilier — recherche de biens, estimation, conseil, prise de rendez-vous et génération de documents",
  "url": "https://realestatecapitale.ma/a2a",
  "version": "1.0.0",
  "protocolVersion": "0.3",
  "supportedInterfaces": [
    {
      "url": "https://realestatecapitale.ma/a2a",
      "transport": "http"
    }
  ],
  "capabilities": {
    "streaming": true,
    "pushNotifications": true,
    "stateTransition": false
  },
  "defaultInputModes": ["text", "image"],
  "defaultOutputModes": ["text", "image"],
  "skills": [
    {
      "id": "property-search",
      "name": "Recherche de biens immobiliers",
      "description": "Rechercher des biens immobiliers à Rabat, Salé et Témara selon des critères (quartier, budget, type, surface, chambres)",
      "tags": ["immobilier", "recherche", "achat", "location"],
      "examples": ["Trouvez un appartement à Agdal sous 1M MAD", "Maisons à vendre à Salé", "Studios en location à Témara"]
    },
    {
      "id": "property-valuation",
      "name": "Estimation immobilière",
      "description": "Estimer la valeur d'un bien immobilier à partir de photos et de critères",
      "tags": ["estimation", "valorisation", "prix"],
      "examples": ["Estimez un appartement de 120m² à Agdal", "Évaluez cette maison à partir de photos"]
    },
    {
      "id": "real-estate-advice",
      "name": "Conseil immobilier",
      "description": "Fournir des conseils en investissement immobilier, fiscalité et financement",
      "tags": ["conseil", "investissement", "fiscalité", "financement"],
      "examples": ["Conseils pour investir à Rabat", "Quelle fiscalité pour un bien locatif ?"]
    },
    {
      "id": "appointment-booking",
      "name": "Prise de rendez-vous",
      "description": "Planifier des visites de biens et des rendez-vous avec un agent immobilier",
      "tags": ["rendez-vous", "visite", "agenda"],
      "examples": ["Réservez une visite pour l'appartement à Agdal", "Planifiez un rendez-vous avec un conseiller"]
    },
    {
      "id": "document-generation",
      "name": "Génération de documents",
      "description": "Générer des documents immobiliers (offres d'achat, contrats de location, devis)",
      "tags": ["documents", "contrat", "offre", "devis"],
      "examples": ["Générez une offre d'achat pour un appartement", "Créez un contrat de location"]
    }
  ],
  "authentication": {
    "schemes": ["none"]
  }
};

const a2aJson = {
  "name": "Real Estate Capitale A2A",
  "description": "Endpoint Agent-to-Agent pour la découverte et la communication inter-agents",
  "url": "https://realestatecapitale.ma/a2a",
  "version": "1.0.0",
  "protocolVersion": "0.3",
  "capabilities": {
    "streaming": true,
    "pushNotifications": true
  },
  "defaultInputModes": ["text", "image"],
  "defaultOutputModes": ["text", "image"],
  "skills": agentJson.skills,
  "authentication": {
    "schemes": ["none"]
  }
};

// --- API Catalog (RFC 9727) ---

const CATALOG_PROFILE = 'https://www.rfc-editor.org/info/rfc9727';

function handleApiCatalog() {
  const linkset = [
    {
      anchor: 'https://api.realestatecapitale.ma',
      'service-desc': [
        { href: 'https://api.realestatecapitale.ma/docs/openapi.json', type: 'application/vnd.oai.openapi+json' },
      ],
      'service-doc': [
        { href: 'https://realestatecapitale.ma/docs/api', type: 'text/html' },
      ],
      status: [
        { href: 'https://api.realestatecapitale.ma/api/health', type: 'application/json' },
      ],
    },
    {
      anchor: 'https://realestatecapitale.ma/mcp',
      'service-desc': [
        { href: 'https://realestatecapitale.ma/mcp/schema.json', type: 'application/json' },
      ],
      'service-doc': [
        { href: 'https://realestatecapitale.ma/docs/mcp', type: 'text/html' },
      ],
      status: [
        { href: 'https://origin.realestatecapitale.ma/health', type: 'application/json' },
      ],
    },
    {
      anchor: 'https://realestatecapitale.ma/a2a',
      'service-desc': [
        { href: 'https://realestatecapitale.ma/.well-known/agent.json', type: 'application/json' },
      ],
      'service-doc': [
        { href: 'https://realestatecapitale.ma/docs/a2a', type: 'text/html' },
      ],
    },
  ];

  const body = JSON.stringify({ linkset }, null, 2);
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/linkset+json; profile="' + CATALOG_PROFILE + '"',
      'Cache-Control': 'public, max-age=3600',
      'Vary': 'Accept',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

// --- OAuth Protected Resource Metadata (auth.md discovery) ---

function handleOAuthProtectedResource(requestUrl) {
  const origin = new URL(requestUrl).origin;
  const body = {
    resource: origin + '/',
    resource_name: "Rabat Immobilier",
    resource_logo_uri: "https://realestatecapitale.ma/logo.png",
    authorization_servers: ["https://realestatecapitale.ma/"],
    scopes_supported: ["api.read", "api.write"],
    bearer_methods_supported: ["header"],
  };
  return new Response(JSON.stringify(body, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function handleOAuthAuthorizationServer() {
  const body = {
    resource: "https://api.realestatecapitale.ma/",
    authorization_servers: ["https://realestatecapitale.ma/"],
    scopes_supported: ["api.read", "api.write"],
    bearer_methods_supported: ["header"],
    issuer: "https://realestatecapitale.ma",
    token_endpoint: "https://realestatecapitale.ma/oauth2/token",
    revocation_endpoint: "https://realestatecapitale.ma/oauth2/revoke",
    grant_types_supported: [
      "urn:ietf:params:oauth:grant-type:jwt-bearer",
      "urn:workos:agent-auth:grant-type:claim",
    ],
    agent_auth: {
      skill: "https://realestatecapitale.ma/auth.md",
      identity_endpoint: "https://realestatecapitale.ma/agent/identity",
      claim_endpoint: "https://realestatecapitale.ma/agent/identity/claim",
      events_endpoint: "https://realestatecapitale.ma/agent/event/notify",
      identity_types_supported: ["anonymous", "service_auth"],
      service_auth: {
        credential_types_supported: ["access_token"],
        claim_uri: "https://realestatecapitale.ma/agent/identity/claim",
      },
      anonymous: {
        credential_types_supported: ["access_token"],
        claim_uri: "https://realestatecapitale.ma/agent/identity/claim",
      },
    },
  };
  return new Response(JSON.stringify(body, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

// --- Helpers NLP ---

function detectSkill(text) {
  const lower = text.toLowerCase();
  if (/(estim|valoris|prix|évalu|combien|vaut)/.test(lower)) return "property-valuation";
  if (/(rendez-vous|rdv|visite|rencontrer|appointment)/.test(lower)) return "appointment-booking";
  if (/(document|contrat|offre d'achat|devis|génération)/.test(lower)) return "document-generation";
  if (/(conseil|investissement|fiscalité|financement|rentabilité)/.test(lower)) return "real-estate-advice";
  return "property-search";
}

// Villes et quartiers supportés
const CITIES = ["rabat", "salé", "sale", "témara", "temara"];
const QUARTIERS = {
  "rabat": ["agdal", "hassan", "hay riad", "riyad", "souissi", "l'orangeraie", "orangeraie", "medina", "médina", "akkari", "youssoufia", "océan", "ocean", "matmata", "kamoa", "mabella", "aviation", "val fleuri", "cyber park", "riad", "hassan centre", "centre ville"],
  "salé": ["sala el jadida", "salé el jadida", "marina", "marina salé", "medina", "médina", "tabriquet", "bettana", "hay karima", "hay riyad", "salé tabriquet"],
  "témara": ["harhoura", "skhirate", "skhirat", "val fleuri", "côte d'azur", "cote d'azur", "nation", "plage", "temara centre", "témara centre", "gharbya", "wifaq", "nahda", "nakhil", "fors"]
};

function extractLocation(text) {
  const lower = text.toLowerCase();

  for (const [city, quartiers] of Object.entries(QUARTIERS)) {
    for (const q of quartiers) {
      if (lower.includes(q)) {
        return { quartier: q, ville: city };
      }
    }
  }

  for (const city of CITIES) {
    if (lower.includes(city)) {
      return { quartier: null, ville: city === "sale" ? "salé" : city === "temara" ? "témara" : city };
    }
  }

  return { quartier: null, ville: null };
}

function extractBudget(text) {
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*(?:m|million|mmd|MAD|dh|dirham)/i);
  if (match) {
    let value = parseFloat(match[1].replace(",", "."));
    if (/million|mmd/i.test(text)) value *= 1000000;
    else if (value < 1000) value *= 1000000;
    return value;
  }
  return null;
}

function extractPropertyType(text) {
  const lower = text.toLowerCase();
  if (/appartement/.test(lower)) return "Appartement";
  if (/maison/.test(lower)) return "Maison";
  if (/villa/.test(lower)) return "Villa";
  if (/studio/.test(lower)) return "Studio";
  if (/terrain/.test(lower)) return "Terrain";
  if (/bureau/.test(lower)) return "Bureau";
  if (/commerce|local/.test(lower)) return "Commerce";
  if (/riad/.test(lower)) return "Riad";
  return null;
}

function extractTransaction(text) {
  const lower = text.toLowerCase();
  if (/location|louer|loyer/.test(lower)) return "Location";
  if (/achat|acheter|vendre|vente/.test(lower)) return "Vente";
  return null;
}

function extractSurface(text) {
  const match = text.match(/(\d+)\s*m[²2]/);
  return match ? parseInt(match[1]) : null;
}

function extractRooms(text) {
  const match = text.match(/(\d+)\s*(?:chambre|pièce|piece|room)/i);
  return match ? parseInt(match[1]) : null;
}

function extractName(text) {
  const match = text.match(/(?:je suis|je m'appelle|nom\s*:?)\s*(\w+(?:\s+\w+){0,3})/i);
  return match ? match[1].trim() : null;
}

function extractPhone(text) {
  const match = text.match(/(?:\+212|0)[5-7]\d[\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{2}/);
  return match ? match[0].replace(/[\s-]/g, "") : null;
}

// --- Handlers ---

async function handlePropertySearch(text) {
  const params = new URLSearchParams();
  const loc = extractLocation(text);
  const budget = extractBudget(text);
  const type = extractPropertyType(text);
  const transaction = extractTransaction(text);
  const surface = extractSurface(text);
  const rooms = extractRooms(text);

  if (loc.quartier) params.set("location", loc.quartier);
  if (type) params.set("propertyType", type);
  if (transaction) params.set("transaction", transaction);
  if (budget) params.set("priceMax", budget);
  if (surface) params.set("surfaceMin", surface);
  if (rooms) params.set("roomsMin", rooms);
  params.set("page", "1");
  params.set("pageSize", "20");

  const url = `${BACKEND_URL}/api/listings?${params.toString()}`;
  const res = await fetch(url);
  const data = await res.json();

  let listings = data.data || [];
  const total = data.meta?.total || listings.length;

  let responseText = `🔍 Recherche${loc.quartier ? ` — ${loc.quartier}` : loc.ville ? ` — ${loc.ville}` : ""}${type ? ` — ${type}` : ""}${transaction ? ` (${transaction})` : ""}${budget ? ` — budget max: ${budget.toLocaleString()} MAD` : ""}\n\n`;
  responseText += `${total} résultat(s) trouvé(s).\n\n`;

  for (const item of listings.slice(0, 5)) {
    responseText += `📍 ${item.title}\n`;
    responseText += `   Prix: ${item.price.toLocaleString()} MAD\n`;
    responseText += `   Surface: ${item.surface || "N/A"} m²\n`;
    responseText += `   Pièces: ${item.rooms || "N/A"}\n`;
    responseText += `   Quartier: ${item.city || "N/A"}\n`;
    responseText += `   Type: ${item.type} — ${item.propertyType}\n`;
    responseText += `   ID: ${item.id}\n\n`;
  }

  if (listings.length === 0) {
    responseText += "Aucun bien ne correspond à vos critères. Essayez d'élargir votre recherche (augmenter le budget, changer le quartier).";
  }

  return responseText;
}

async function handlePropertyValuation(text) {
  const loc = extractLocation(text);
  const type = extractPropertyType(text) || "Appartement";
  const surface = extractSurface(text);
  const transaction = extractTransaction(text) || "vente";

  if (!loc.quartier) {
    return "📊 Estimation immobilière\n\nVeuillez préciser un quartier (ex: Agdal, Hay Riad, Souissi…).";
  }
  if (!surface) {
    return "📊 Estimation immobilière\n\nVeuillez préciser une surface (ex: 120 m²).";
  }

  const params = new URLSearchParams();
  params.set("type", transaction.toLowerCase());
  params.set("quartier", loc.quartier);
  params.set("surface", String(surface));
  if (loc.ville) params.set("ville", loc.ville);

  const url = `${BACKEND_URL}/api/estimation-prix?${params.toString()}`;
  const res = await fetch(url);
  const data = await res.json();

  let responseText = `📊 Estimation immobilière — ${loc.quartier}${loc.ville ? ` (${loc.ville})` : ""}\n\n`;

  if (data.estimation_disponible) {
    responseText += `Prix au m² moyen: ${Number(data.prix_m2_moyen || 0).toLocaleString()} MAD/m²\n`;
    responseText += `Surface: ${data.surface_saisie} m²\n\n`;
    responseText += `Estimation:\n`;
    responseText += `  Basse:   ${Number(data.estimation_basse || 0).toLocaleString()} MAD\n`;
    responseText += `  Médiane: ${Number(data.estimation_mediane || 0).toLocaleString()} MAD\n`;
    responseText += `  Haute:   ${Number(data.estimation_haute || 0).toLocaleString()} MAD\n`;
    responseText += `\nBasé sur ${data.nb_annonces} annonce(s)`;
    if (data.coefficient_applique) {
      responseText += ` | Coefficient appliqué: ${data.coefficient_applique}`;
    }
  } else {
    responseText += "Estimation directe indisponible. Calcul basé sur les annonces récentes:\n\n";
    const listingParams = new URLSearchParams();
    listingParams.set("location", loc.quartier);
    if (type) listingParams.set("propertyType", type);
    listingParams.set("pageSize", "20");

    const listingRes = await fetch(`${BACKEND_URL}/api/listings?${listingParams.toString()}`);
    const listingData = await listingRes.json();
    const items = listingData.data || [];

    if (items.length > 0) {
      const validItems = items.filter(i => i.price > 0 && i.surface > 0);
      if (validItems.length > 0) {
        const pricesPerM2 = validItems.map(i => i.price / i.surface);
        const avgPrixM2 = pricesPerM2.reduce((a, b) => a + b, 0) / pricesPerM2.length;
        const minPrix = Math.min(...validItems.map(i => i.price));
        const maxPrix = Math.max(...validItems.map(i => i.price));

        responseText += `Basé sur ${validItems.length} annonce(s):\n`;
        responseText += `Prix au m² moyen: ${Math.round(avgPrixM2).toLocaleString()} MAD/m²\n`;
        responseText += `Prix min: ${minPrix.toLocaleString()} MAD\n`;
        responseText += `Prix max: ${maxPrix.toLocaleString()} MAD\n`;
        if (surface) {
          responseText += `Estimation pour ${surface} m²: ${Math.round(avgPrixM2 * surface).toLocaleString()} MAD\n`;
        }
      } else {
        responseText += "Aucune donnée exploitable pour cette zone.";
      }
    } else {
      responseText += "Aucune donnée disponible pour cette zone.";
    }
  }

  return responseText;
}

async function handleRealEstateAdvice(text) {
  const loc = extractLocation(text);

  let responseText = `💡 Conseil immobilier${loc.quartier ? ` — ${loc.quartier}` : loc.ville ? ` — ${loc.ville}` : ""}\n\n`;

  try {
    const params = new URLSearchParams();
    params.set("pageSize", "10");
    params.set("months", "12");
    const res = await fetch(`${BACKEND_URL}/api/market/trends?${params.toString()}`);
    const body = await res.json();
    const trends = body.data || [];

    if (trends.length > 0) {
      responseText += `Tendances du marché (12 mois):\n`;
      for (const t of trends.slice(0, 5)) {
        const dir = t.variationPct > 0 ? "📈" : t.variationPct < 0 ? "📉" : "➡️";
        responseText += `  ${dir} ${t.district} (${t.ville}) — ${t.status}: ${Number(t.latestPriceM2 || 0).toLocaleString()} MAD/m²`;
        if (t.variationPct != null) {
          responseText += ` (${t.variationPct > 0 ? "+" : ""}${t.variationPct}%)`;
        }
        responseText += `\n`;
      }
      responseText += `\n`;
    }
  } catch (e) {
  }

  const listingParams = new URLSearchParams();
  if (loc.quartier) listingParams.set("location", loc.quartier);
  listingParams.set("pageSize", "20");

  const listingRes = await fetch(`${BACKEND_URL}/api/listings?${listingParams.toString()}`);
  const listingData = await listingRes.json();
  const items = listingData.data || [];

  if (items.length > 0) {
    const ventes = items.filter(i => i.type === "Vente" && i.price > 0);
    const locations = items.filter(i => i.type === "Location" && i.price > 0);

    responseText += `Marché actuel (${items.length} annonces récentes):\n`;
    if (ventes.length > 0) {
      const avgVente = ventes.reduce((a, i) => a + i.price, 0) / ventes.length;
      const surfaces = ventes.map(i => i.surface).filter(Boolean);
      const avgSurf = surfaces.length > 0 ? surfaces.reduce((a, s) => a + s, 0) / surfaces.length : 0;
      responseText += `  • Vente — prix moyen: ${Math.round(avgVente).toLocaleString()} MAD`;
      if (avgSurf > 0) responseText += ` (surface moy. ${Math.round(avgSurf)} m²)`;
      responseText += ` — ${ventes.length} annonces\n`;
    }
    if (locations.length > 0) {
      const avgLoc = locations.reduce((a, i) => a + i.price, 0) / locations.length;
      responseText += `  • Location — loyer moyen: ${Math.round(avgLoc).toLocaleString()} MAD/mois — ${locations.length} annonces\n`;
    }
  }

  if (responseText.trim() === `💡 Conseil immobilier${loc.quartier ? ` — ${loc.quartier}` : loc.ville ? ` — ${loc.ville}` : ""}`) {
    responseText += "Pour un conseil personnalisé, précisez votre budget, la ville/quartier et votre objectif (investissement, résidence principale, location).";
  }

  return responseText;
}

async function handleAppointmentBooking(text) {
  const loc = extractLocation(text);
  const name = extractName(text) || "Visiteur Agent";
  const phone = extractPhone(text) || "0000000000";

  const body = {
    name: name,
    phone: phone,
    source: "agent-a2a",
    message: text + (loc.quartier ? ` (Quartier: ${loc.quartier})` : "") + (loc.ville ? ` (Ville: ${loc.ville})` : "")
  };

  const res = await fetch(`${BACKEND_URL}/api/leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  let responseText = `📅 Prise de rendez-vous\n\n`;

  if (res.ok) {
    const data = await res.json();
    responseText += `Votre demande de rendez-vous a été enregistrée avec succès.\n`;
    responseText += `Référence: ${data.id || data.ref || "RDV-" + Date.now()}\n`;
    if (loc.quartier || loc.ville) responseText += `Secteur: ${loc.quartier || loc.ville}\n`;
    responseText += `Un conseiller vous contactera prochainement.`;
  } else {
    responseText += `Une erreur est survenue lors de l'enregistrement. Veuillez réessayer ou nous contacter directement via https://realestatecapitale.ma.`;
  }

  return responseText;
}

async function handleDocumentGeneration(text) {
  return `📄 Génération de documents\n\nCette fonctionnalité nécessite une authentification.\nConnectez-vous à votre compte sur https://realestatecapitale.ma pour générer des documents (offres d'achat, contrats de location, devis).`;
}

// --- Router ---

async function handleTaskSend(body) {
  const userMessage = body.params?.message?.parts?.[0]?.text || "";
  const skill = detectSkill(userMessage);

  let responseText;

  try {
    switch (skill) {
      case "property-search":
        responseText = await handlePropertySearch(userMessage);
        break;
      case "property-valuation":
        responseText = await handlePropertyValuation(userMessage);
        break;
      case "real-estate-advice":
        responseText = await handleRealEstateAdvice(userMessage);
        break;
      case "appointment-booking":
        responseText = await handleAppointmentBooking(userMessage);
        break;
      case "document-generation":
        responseText = await handleDocumentGeneration(userMessage);
        break;
      default:
        responseText = `Je n'ai pas compris votre demande. Voici ce que je peux faire:\n- Recherche de biens immobiliers\n- Estimation immobilière\n- Conseil immobilier\n- Prise de rendez-vous\n- Génération de documents`;
    }
  } catch (error) {
    responseText = `Une erreur est survenue lors du traitement de votre demande.\n\nDétail: ${error.message}`;
  }

  return {
    id: "task-" + Date.now(),
    status: { state: "completed" },
    artifacts: [],
    messages: [
      {
        role: "agent",
        parts: [{ type: "text", text: responseText }]
      }
    ]
  };
}

// --- MCP Server Card (SEP-2127) ---

const MCP_SERVER_CARD = {
  $schema: 'https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json',
  name: 'ma.realestatecapitale/mcp',
  description: 'MCP server for real estate search, property valuation, and agent services in Rabat, Sal\u00e9, and T\u00e9mara.',
  version: '1.0.0',
  title: 'Rabat Immobilier MCP',
  websiteUrl: 'https://realestatecapitale.ma',
  remotes: [
    {
      type: 'streamable-http',
      url: 'https://realestatecapitale.ma/mcp',
      supportedProtocolVersions: ['2025-03-26'],
    },
  ],
};

function handleMcpServerCard() {
  return new Response(JSON.stringify(MCP_SERVER_CARD, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/mcp-server-card+json',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

// --- AI Catalog (Agent Card / SEP-2127) ---

const AI_CATALOG = {
  specVersion: '1.0',
  entries: [
    {
      identifier: 'urn:air:realestatecapitale.ma:mcp:mcp',
      type: 'application/mcp-server-card+json',
      url: 'https://realestatecapitale.ma/mcp/server-card',
      alternativeUrls: [
        'https://realestatecapitale.ma/.well-known/mcp/server-card.json',
      ],
    },
  ],
};

function handleAiCatalog() {
  return new Response(JSON.stringify(AI_CATALOG, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/ai-catalog+json',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

// --- Agent Skills Discovery Index (RFC) ---

const AGENT_SKILLS_INDEX = {
  $schema: 'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
  skills: [
    {
      name: 'mcp-server',
      type: 'skill-md',
      description: 'Discover and use the Real Estate Capitale MCP server for property search, valuation, and market data',
      url: 'https://realestatecapitale.ma/.well-known/agent-skills/mcp-server/SKILL.md',
      digest: 'sha256:7e8810e98aac901fcf46b4a094f7241ec7bc467358596688792764b3f1b8c226',
    },
    {
      name: 'a2a-agent',
      type: 'skill-md',
      description: 'A2A agent for real estate search, estimation, advice, appointments, and document generation',
      url: 'https://realestatecapitale.ma/.well-known/agent-skills/a2a-agent/SKILL.md',
      digest: 'sha256:f2c59d7cff8ddba6a35cc44ce812e195036e28211a625b2bff9ec74690cd1776',
    },
    {
      name: 'oauth-auth',
      type: 'skill-md',
      description: 'How agents obtain access tokens for the Rabat Immobilier API via OAuth',
      url: 'https://realestatecapitale.ma/.well-known/agent-skills/oauth-auth/SKILL.md',
      digest: 'sha256:52f6e19970da7aa56f4fa251519650734a7aff850f831317cf3ac8acaa9fba02',
    },
  ],
};

function handleAgentSkillsIndex() {
  return new Response(JSON.stringify(AGENT_SKILLS_INDEX, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

// --- Worker entry ---

export default {
  async fetch(request) {
    const url = new URL(request.url);

    const jsonHeaders = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: jsonHeaders });
    }

    // API Catalog (RFC 9727)
    if (url.pathname === "/.well-known/api-catalog") {
      return handleApiCatalog();
    }

    if (url.pathname === "/.well-known/oauth-protected-resource") {
      return handleOAuthProtectedResource(request.url);
    }

    if (url.pathname === "/.well-known/oauth-authorization-server") {
      return handleOAuthAuthorizationServer();
    }

    if (url.pathname === "/mcp/server-card" || url.pathname === "/.well-known/mcp/server-card.json") {
      return handleMcpServerCard();
    }

    if (url.pathname === "/.well-known/ai-catalog.json") {
      return handleAiCatalog();
    }

    if (url.pathname === "/.well-known/agent-skills/index.json") {
      return handleAgentSkillsIndex();
    }

    if (url.pathname === "/.well-known/agent.json" || url.pathname === "/.well-known/agent-card.json") {
      return new Response(JSON.stringify(agentJson, null, 2), { headers: jsonHeaders });
    }

    if (url.pathname === "/.well-known/a2a.json") {
      return new Response(JSON.stringify(a2aJson, null, 2), { headers: jsonHeaders });
    }

    if (url.pathname === "/a2a" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: "Parse error" }
        }), { status: 400, headers: jsonHeaders });
      }

      if (body.method === "tasks/send") {
        const result = await handleTaskSend(body);
        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          id: body.id,
          result
        }, null, 2), { headers: jsonHeaders });
      }

      if (body.method === "tasks/get") {
        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          id: body.id,
          result: {
            id: body.params?.id || "unknown",
            status: { state: "completed" }
          }
        }, null, 2), { headers: jsonHeaders });
      }

      if (body.method === "tasks/cancel") {
        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          id: body.id,
          result: {
            id: body.params?.id || "unknown",
            status: { state: "canceled" }
          }
        }, null, 2), { headers: jsonHeaders });
      }

      return new Response(JSON.stringify({
        jsonrpc: "2.0",
        id: body.id,
        error: { code: -32601, message: "Méthode non supportée" }
      }), { status: 400, headers: jsonHeaders });
    }

    return new Response("Not Found", { status: 404 });
  }
};
