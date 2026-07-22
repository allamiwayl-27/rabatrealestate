/**
 * agent-handler.js — Handler A2A pour Real Estate Capitale
 *
 * Importe par worker-proxy.js pour exposer /a2a, /.well-known/agent.json,
 * /.well-known/a2a.json sur le meme worker.
 *
 * Utilise l'API REST du backend (BACKEND_URL) pour toutes les operations.
 */

const BACKEND_URL = "https://api.realestatecapitale.ma";

const agentJson = {
  "name": "Real Estate Capitale Agent",
  "description": "Agent IA specialise dans l'immobilier — recherche de biens, estimation, conseil, prise de rendez-vous et generation de documents",
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
      "description": "Rechercher des biens immobiliers a Rabat, Sale et Temara selon des criteres (quartier, budget, type, surface, chambres)",
      "tags": ["immobilier", "recherche", "achat", "location"],
      "examples": ["Trouvez un appartement a Agdal sous 1M MAD", "Maisons a vendre a Sale", "Studios en location a Temara"]
    },
    {
      "id": "property-valuation",
      "name": "Estimation immobiliere",
      "description": "Estimer la valeur d'un bien immobilier a partir de photos et de criteres",
      "tags": ["estimation", "valorisation", "prix"],
      "examples": ["Estimez un appartement de 120m2 a Agdal", "Evaluez cette maison a partir de photos"]
    },
    {
      "id": "real-estate-advice",
      "name": "Conseil immobilier",
      "description": "Fournir des conseils en investissement immobilier, fiscalite et financement",
      "tags": ["conseil", "investissement", "fiscalite", "financement"],
      "examples": ["Conseils pour investir a Rabat", "Quelle fiscalite pour un bien locatif ?"]
    },
    {
      "id": "appointment-booking",
      "name": "Prise de rendez-vous",
      "description": "Planifier des visites de biens et des rendez-vous avec un agent immobilier",
      "tags": ["rendez-vous", "visite", "agenda"],
      "examples": ["Reservez une visite pour l'appartement a Agdal", "Planifiez un rendez-vous avec un conseiller"]
    },
    {
      "id": "document-generation",
      "name": "Generation de documents",
      "description": "Generer des documents immobiliers (offres d'achat, contrats de location, devis)",
      "tags": ["documents", "contrat", "offre", "devis"],
      "examples": ["Generez une offre d'achat pour un appartement", "Creez un contrat de location"]
    }
  ],
  "authentication": {
    "schemes": ["none"]
  }
};

const a2aJson = {
  "name": "Real Estate Capitale A2A",
  "description": "Endpoint Agent-to-Agent pour la decouverte et la communication inter-agents",
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

// --- Helpers NLP ---

function detectSkill(text) {
  const lower = text.toLowerCase();
  if (/(estim|valoris|prix|evalu|combien|vaut)/.test(lower)) return "property-valuation";
  if (/(rendez-vous|rdv|visite|rencontrer|appointment)/.test(lower)) return "appointment-booking";
  if (/(document|contrat|offre d'achat|devis|generation)/.test(lower)) return "document-generation";
  if (/(conseil|investissement|fiscalite|financement|rentabilite)/.test(lower)) return "real-estate-advice";
  return "property-search";
}

// Villes et quartiers supportes
const CITIES = ["rabat", "sale", "sale", "temara", "temara"];
const QUARTIERS = {
  "rabat": ["agdal", "hassan", "hay riad", "riyad", "souissi", "l'orangeraie", "orangeraie", "medina", "medina", "akkari", "youssoufia", "ocean", "ocean", "matmata", "kamoa", "mabella", "aviation", "val fleuri", "cyber park", "riad", "hassan centre", "centre ville"],
  "sale": ["sala el jadida", "sale el jadida", "marina", "marina sale", "medina", "medina", "tabriquet", "bettana", "hay karima", "hay riyad", "sale tabriquet"],
  "temara": ["harhoura", "skhirate", "skhirat", "val fleuri", "cote d'azur", "cote d'azur", "nation", "plage", "temara centre", "temara centre", "gharbya", "wifaq", "nahda", "nakhil", "fors"]
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
      return { quartier: null, ville: city === "sale" ? "sale" : city === "temara" ? "temara" : city };
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
  const match = text.match(/(\d+)\s*m[22]/);
  return match ? parseInt(match[1]) : null;
}

function extractRooms(text) {
  const match = text.match(/(\d+)\s*(?:chambre|piece|piece|room)/i);
  return match ? parseInt(match[1]) : null;
}

function extractName(text) {
  const match = text.match(/(?:je suis|je m'appelle|je m appelle|nom\s*:?)\s*(\w+(?:\s+\w+){0,3})/i);
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

  let responseText = `\u{1F50D} Recherche${loc.quartier ? ` -- ${loc.quartier}` : loc.ville ? ` -- ${loc.ville}` : ""}${type ? ` -- ${type}` : ""}${transaction ? ` (${transaction})` : ""}${budget ? ` -- budget max: ${budget.toLocaleString()} MAD` : ""}\n\n`;
  responseText += `${total} resultat(s) trouve(s).\n\n`;

  for (const item of listings.slice(0, 5)) {
    responseText += `\u{1F4CD} ${item.title}\n`;
    responseText += `   Prix: ${item.price.toLocaleString()} MAD\n`;
    responseText += `   Surface: ${item.surface || "N/A"} m2\n`;
    responseText += `   Pieces: ${item.rooms || "N/A"}\n`;
    responseText += `   Quartier: ${item.city || "N/A"}\n`;
    responseText += `   Type: ${item.type} -- ${item.propertyType}\n`;
    responseText += `   ID: ${item.id}\n\n`;
  }

  if (listings.length === 0) {
    responseText += "Aucun bien ne correspond a vos criteres. Essayez d'elargir votre recherche (augmenter le budget, changer le quartier).";
  }

  return responseText;
}

async function handlePropertyValuation(text) {
  const loc = extractLocation(text);
  const type = extractPropertyType(text) || "Appartement";
  const surface = extractSurface(text);
  const transaction = extractTransaction(text) || "vente";

  if (!loc.quartier) {
    return "\u{1F4CA} Estimation immobiliere\n\nVeuillez preciser un quartier (ex: Agdal, Hay Riad, Souissi...).";
  }
  if (!surface) {
    return "\u{1F4CA} Estimation immobiliere\n\nVeuillez preciser une surface (ex: 120 m2).";
  }

  const params = new URLSearchParams();
  params.set("type", transaction.toLowerCase());
  params.set("quartier", loc.quartier);
  params.set("surface", String(surface));
  if (loc.ville) params.set("ville", loc.ville);

  const url = `${BACKEND_URL}/api/estimation-prix?${params.toString()}`;
  const res = await fetch(url);
  const data = await res.json();

  let responseText = `\u{1F4CA} Estimation immobiliere -- ${loc.quartier}${loc.ville ? ` (${loc.ville})` : ""}\n\n`;

  if (data.estimation_disponible) {
    responseText += `Prix au m2 moyen: ${Number(data.prix_m2_moyen || 0).toLocaleString()} MAD/m2\n`;
    responseText += `Surface: ${data.surface_saisie} m2\n\n`;
    responseText += `Estimation:\n`;
    responseText += `  Basse:   ${Number(data.estimation_basse || 0).toLocaleString()} MAD\n`;
    responseText += `  Mediane: ${Number(data.estimation_mediane || 0).toLocaleString()} MAD\n`;
    responseText += `  Haute:   ${Number(data.estimation_haute || 0).toLocaleString()} MAD\n`;
    responseText += `\nBase sur ${data.nb_annonces} annonce(s)`;
    if (data.coefficient_applique) {
      responseText += ` | Coefficient applique: ${data.coefficient_applique}`;
    }
  } else {
    responseText += "Estimation directe indisponible. Calcul base sur les annonces recentes:\n\n";
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

        responseText += `Base sur ${validItems.length} annonce(s):\n`;
        responseText += `Prix au m2 moyen: ${Math.round(avgPrixM2).toLocaleString()} MAD/m2\n`;
        responseText += `Prix min: ${minPrix.toLocaleString()} MAD\n`;
        responseText += `Prix max: ${maxPrix.toLocaleString()} MAD\n`;
        if (surface) {
          responseText += `Estimation pour ${surface} m2: ${Math.round(avgPrixM2 * surface).toLocaleString()} MAD\n`;
        }
      } else {
        responseText += "Aucune donnee exploitable pour cette zone.";
      }
    } else {
      responseText += "Aucune donnee disponible pour cette zone.";
    }
  }

  return responseText;
}

async function handleRealEstateAdvice(text) {
  const loc = extractLocation(text);

  let responseText = `\u{1F4A1} Conseil immobilier${loc.quartier ? ` -- ${loc.quartier}` : loc.ville ? ` -- ${loc.ville}` : ""}\n\n`;

  try {
    const params = new URLSearchParams();
    params.set("pageSize", "10");
    params.set("months", "12");
    const res = await fetch(`${BACKEND_URL}/api/market/trends?${params.toString()}`);
    const body = await res.json();
    const trends = body.data || [];

    if (trends.length > 0) {
      responseText += `Tendances du marche (12 mois):\n`;
      for (const t of trends.slice(0, 5)) {
        const dir = t.variationPct > 0 ? "\u{1F4C8}" : t.variationPct < 0 ? "\u{1F4C9}" : "\u27A1\uFE0F";
        responseText += `  ${dir} ${t.district} (${t.ville}) -- ${t.status}: ${Number(t.latestPriceM2 || 0).toLocaleString()} MAD/m2`;
        if (t.variationPct != null) {
          responseText += ` (${t.variationPct > 0 ? "+" : ""}${t.variationPct}%)`;
        }
        responseText += `\n`;
      }
      responseText += `\n`;
    }
  } catch (e) {
    // Fallback silencieux
  }

  // Completer avec des listings recents
  const listingParams = new URLSearchParams();
  if (loc.quartier) listingParams.set("location", loc.quartier);
  listingParams.set("pageSize", "20");

  const listingRes = await fetch(`${BACKEND_URL}/api/listings?${listingParams.toString()}`);
  const listingData = await listingRes.json();
  const items = listingData.data || [];

  if (items.length > 0) {
    const ventes = items.filter(i => i.type === "Vente" && i.price > 0);
    const locations = items.filter(i => i.type === "Location" && i.price > 0);

    responseText += `Marche actuel (${items.length} annonces recentes):\n`;
    if (ventes.length > 0) {
      const avgVente = ventes.reduce((a, i) => a + i.price, 0) / ventes.length;
      const surfaces = ventes.map(i => i.surface).filter(Boolean);
      const avgSurf = surfaces.length > 0 ? surfaces.reduce((a, s) => a + s, 0) / surfaces.length : 0;
      responseText += `  \u2022 Vente -- prix moyen: ${Math.round(avgVente).toLocaleString()} MAD`;
      if (avgSurf > 0) responseText += ` (surface moy. ${Math.round(avgSurf)} m2)`;
      responseText += ` -- ${ventes.length} annonces\n`;
    }
    if (locations.length > 0) {
      const avgLoc = locations.reduce((a, i) => a + i.price, 0) / locations.length;
      responseText += `  \u2022 Location -- loyer moyen: ${Math.round(avgLoc).toLocaleString()} MAD/mois -- ${locations.length} annonces\n`;
    }
  }

  if (responseText.trim() === `\u{1F4A1} Conseil immobilier${loc.quartier ? ` -- ${loc.quartier}` : loc.ville ? ` -- ${loc.ville}` : ""}`) {
    responseText += "Pour un conseil personnalise, precisez votre budget, la ville/quartier et votre objectif (investissement, residence principale, location).";
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

  let responseText = `\u{1F4C5} Prise de rendez-vous\n\n`;

  if (res.ok) {
    const data = await res.json();
    responseText += `Votre demande de rendez-vous a ete enregistree avec succes.\n`;
    responseText += `Reference: ${data.id || data.ref || "RDV-" + Date.now()}\n`;
    if (loc.quartier || loc.ville) responseText += `Secteur: ${loc.quartier || loc.ville}\n`;
    responseText += `Un conseiller vous contactera prochainement.`;
  } else {
    responseText += `Une erreur est survenue lors de l'enregistrement. Veuillez reessayer ou nous contacter directement via https://realestatecapitale.ma.`;
  }

  return responseText;
}

async function handleDocumentGeneration(text) {
  return `\u{1F4C4} Generation de documents\n\nCette fonctionnalite necessite une authentification.\nConnectez-vous a votre compte sur https://realestatecapitale.ma pour generer des documents (offres d'achat, contrats de location, devis).`;
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
        responseText = `Je n'ai pas compris votre demande. Voici ce que je peux faire:\n- Recherche de biens immobiliers\n- Estimation immobiliere\n- Conseil immobilier\n- Prise de rendez-vous\n- Generation de documents`;
    }
  } catch (error) {
    responseText = `Une erreur est survenue lors du traitement de votre demande.\n\nDetail: ${error.message}`;
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

// --- Entry point exporte pour worker-proxy.js ---

export function handleA2ARequest(request) {
  const url = new URL(request.url);

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (url.pathname === "/.well-known/agent.json" || url.pathname === "/.well-known/agent-card.json") {
    return new Response(JSON.stringify(agentJson, null, 2), { headers });
  }

  if (url.pathname === "/.well-known/a2a.json") {
    return new Response(JSON.stringify(a2aJson, null, 2), { headers });
  }

  if (url.pathname === "/a2a" && request.method === "POST") {
    return request.json().then((body) => {
      if (body.method === "tasks/send") {
        return handleTaskSend(body).then((result) => {
          return new Response(JSON.stringify({
            jsonrpc: "2.0",
            id: body.id,
            result
          }, null, 2), { headers });
        });
      }

      if (body.method === "tasks/get") {
        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          id: body.id,
          result: {
            id: body.params?.id || "unknown",
            status: { state: "completed" }
          }
        }, null, 2), { headers });
      }

      if (body.method === "tasks/cancel") {
        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          id: body.id,
          result: {
            id: body.params?.id || "unknown",
            status: { state: "canceled" }
          }
        }, null, 2), { headers });
      }

      return new Response(JSON.stringify({
        jsonrpc: "2.0",
        id: body.id,
        error: { code: -32601, message: "Methode non supportee" }
      }), { status: 400, headers });
    }).catch(() => {
      return new Response(JSON.stringify({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error" }
      }), { status: 400, headers });
    });
  }

  return new Response("Not Found", { status: 404 });
}
