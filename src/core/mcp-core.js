/**
 * mcp-core.js — Logique partagée du serveur MCP Real Estate Capitale
 *
 * Exporte TOOLS, HANDLERS, getDb(), handleRequest() pour transport stdio ou SSE.
 */

const { Client } = require('pg');
const { pool } = require('../backend/database');
const config = require('../backend/config');
const makeMarket = require('../backend/market');
const makeGetPrices = require('../backend/prices');
const helpers = require('../backend/helpers');

const market = makeMarket({ pool, DB_TABLES: config.DB_TABLES });
const getPrices = makeGetPrices({ pool, DB_TABLES: config.DB_TABLES, normalize: helpers.normalize, expandLocationTerms: helpers.expandLocationTerms || ((v) => [v]) });

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://user:pass@localhost:5432/db';
const SUPPORTED_VERSIONS = ['2025-03-26', '2024-11-05'];
const MCP_VERSION = SUPPORTED_VERSIONS[0];

let db = null;

const DB = {
  annonces: 'annonces',
  localisations: 'localisations',
  caracteristiques: 'caracteristiques',
  contacts: 'contacts',
  historiquePrix: 'historique_prix',
  leads: 'leads',
};

function toSearchParams(args) {
  if (!args || typeof args !== 'object') args = {};
  return { get: (key) => args[key] ?? null };
}

function cleanHtml(str) {
  if (!str) return '';
  return String(str).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function defaultImage(id) {
  return id ? `https://images.realestatecapitale.ma/annonces/${id}/main.webp` : 'https://images.realestatecapitale.ma/rabat-cover.webp';
}

async function getDb() {
  if (!db) {
    db = new Client({ connectionString: DATABASE_URL });
    await db.connect();
    await db.query("SET client_encoding TO 'UTF8'");
  }
  return db;
}

function logError(err) {
  process.stderr.write(`[MCP] ${err?.message || err}\n`);
}

const TOOLS = [
  {
    name: 'search_listings',
    description: 'Rechercher des biens immobiliers avec filtres (transaction, location, budget, surface, pieces, type de bien, mot-cle)',
    inputSchema: {
      type: 'object',
      properties: {
        transaction: { type: 'string', enum: ['Vente', 'Location'], description: 'Type de transaction' },
        location: { type: 'string', description: 'Quartier ou ville (ex: Agdal, Hay Riad, Salé)' },
        propertyType: { type: 'string', enum: ['Appartement', 'Maison', 'Villa', 'Studio', 'Terrain', 'Bureau', 'Commerce', 'Riad'], description: 'Type de bien' },
        priceMin: { type: 'number', description: 'Prix minimum en MAD' },
        priceMax: { type: 'number', description: 'Prix maximum en MAD' },
        surfaceMin: { type: 'number', description: 'Surface minimum en m²' },
        surfaceMax: { type: 'number', description: 'Surface maximum en m²' },
        roomsMin: { type: 'number', description: 'Nombre minimum de pieces' },
        roomsMax: { type: 'number', description: 'Nombre maximum de pieces' },
        q: { type: 'string', description: 'Mot-cle dans le titre ou la description' },
        sort: { type: 'string', enum: ['price_asc', 'price_desc', 'date_desc', 'date_asc'], description: 'Tri' },
        page: { type: 'number', description: 'Page (defaut: 1)' },
        pageSize: { type: 'number', description: 'Resultats par page (defaut: 12, max: 60)' },
      },
    },
  },
  {
    name: 'get_listing',
    description: 'Obtenir le détail complet d\'un bien immobilier par son ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'ID du bien immobilier' },
      },
      required: ['id'],
    },
  },
  {
    name: 'estimate_property',
    description: 'Estimer la valeur d\'un bien immobilier (prix au m², fourchette basse/haute)',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['vente', 'location'], description: 'Type de transaction' },
        quartier: { type: 'string', description: 'Quartier (ex: Agdal, Hay Riad)' },
        surface: { type: 'number', description: 'Surface en m²' },
        ville: { type: 'string', description: 'Ville (optionnel, defaut: Rabat)' },
        pieces: { type: 'number', description: 'Nombre de pieces (optionnel)' },
        etage: { type: 'string', enum: ['rdc', 'bas', 'milieu', 'haut', 'dernier'], description: 'Type d\'etage (optionnel)' },
        etat: { type: 'string', enum: ['renover', 'bon', 'neuf'], description: 'Etat du bien (optionnel)' },
        standing: { type: 'string', enum: ['economique', 'standard', 'standing', 'luxe'], description: 'Standing (optionnel)' },
      },
      required: ['type', 'quartier', 'surface'],
    },
  },
  {
    name: 'get_market_trends',
    description: 'Obtenir les tendances du marche immobilier par quartier (variation de prix sur N mois)',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['vente', 'location', 'all'], description: 'Filtrer par type (defaut: all)' },
        months: { type: 'number', description: 'Periode en mois (3-36, defaut: 12)' },
      },
    },
  },
  {
    name: 'get_quartier_stats',
    description: 'Obtenir les statistiques agregees par quartier (prix m² moyen, nombre d\'annonces)',
    inputSchema: {
      type: 'object',
      properties: {
        transaction: { type: 'string', enum: ['Vente', 'Location'], description: 'Filtrer par transaction' },
      },
    },
  },
  {
    name: 'list_quartiers',
    description: 'Lister tous les quartiers disponibles avec leur ville',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'list_villes',
    description: 'Lister toutes les villes disponibles',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'create_lead',
    description: 'Creer un lead (contact client) pour prise de rendez-vous ou demande d\'information',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nom du contact (2-120 caracteres)' },
        phone: { type: 'string', description: 'Telephone (8-24 caracteres, ex: 0612345678)' },
        source: { type: 'string', enum: ['website', 'whatsapp_click', 'facebook', 'phone', 'other', 'mcp'], description: 'Source du lead (defaut: mcp)' },
        listingId: { type: 'number', description: 'ID du bien concerne (optionnel)' },
      },
      required: ['name', 'phone'],
    },
  },
  {
    name: 'get_comparables',
    description: 'Trouver les annonces les plus similaires a un bien donne (pour evaluation ou estimation)',
    inputSchema: {
      type: 'object',
      properties: {
        listingId: { type: 'number', description: 'ID du bien de reference' },
      },
      required: ['listingId'],
    },
  },
  {
    name: 'get_investor_alerts',
    description: 'Identifier les biens sous-evalues (opportunites d\'investissement avec discount)',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['vente', 'location', 'all'], description: 'Filtrer par type (defaut: vente)' },
        minDiscountPct: { type: 'number', description: 'Discount minimum en pourcentage (10-70, defaut: 15)' },
        minSample: { type: 'number', description: 'Echantillon minimum par segment (12-300, defaut: 20)' },
        page: { type: 'number', description: 'Page (defaut: 1)' },
        pageSize: { type: 'number', description: 'Resultats par page (defaut: 20, max: 100)' },
      },
    },
  },
  {
    name: 'get_price_analytics',
    description: 'Analyser les prix au m² par quartier avec tendances et distribution',
    inputSchema: {
      type: 'object',
      properties: {
        transaction: { type: 'string', enum: ['Vente', 'Location', 'Achat'], description: 'Type de transaction (defaut: Vente)' },
        location: { type: 'string', description: 'Quartier ou ville specifique (optionnel)' },
        propertyType: { type: 'string', description: 'Type de bien (optionnel, ex: Appartement, Villa)' },
        priceMin: { type: 'number', description: 'Prix minimum (optionnel)' },
        priceMax: { type: 'number', description: 'Prix maximum (optionnel)' },
        page: { type: 'number', description: 'Page (defaut: 1)' },
        pageSize: { type: 'number', description: 'Resultats par page (defaut: 20, max: 100)' },
      },
    },
  },
  {
    name: 'get_rental_yield',
    description: 'Obtenir le rendement locatif brut par quartier (comparatif achat vs location)',
    inputSchema: {
      type: 'object',
      properties: {
        quartier: { type: 'string', description: 'Quartier specifique (optionnel, tous si omis)' },
      },
    },
  },
  {
    name: 'get_market_predictions',
    description: 'Previsions de prix a 90 jours par quartier (regression lineaire)',
    inputSchema: {
      type: 'object',
      properties: {
        quartier: { type: 'string', description: 'Quartier specifique (optionnel, tous si omis)' },
        status: { type: 'string', enum: ['vente', 'location', 'all'], description: 'Filtrer par type (defaut: all)' },
        months: { type: 'number', description: 'Periode d\'analyse en mois (3-36, defaut: 12)' },
      },
    },
  },
  {
    name: 'get_quartier_comparison',
    description: 'Comparer deux quartiers cote-a-cote (prix m², nombre d\'annonces, volatilite)',
    inputSchema: {
      type: 'object',
      properties: {
        q1: { type: 'string', description: 'Premier quartier (ex: Agdal)' },
        q2: { type: 'string', description: 'Second quartier (ex: Hay Riad)' },
        status: { type: 'string', enum: ['vente', 'location', 'all'], description: 'Filtrer par type (defaut: all)' },
      },
      required: ['q1', 'q2'],
    },
  },
  {
    name: 'get_suspicious_listings',
    description: 'Detecter les annonces avec des prix anormaux (IQR outliers, scores de severite)',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['vente', 'location', 'all'], description: 'Filtrer par type (defaut: all)' },
        minSample: { type: 'number', description: 'Echantillon minimum (12-300, defaut: 20)' },
        iqrMultiplier: { type: 'number', description: 'Multiplicateur IQR (1.5-3.0, defaut: 2.0)' },
        minDeviationPct: { type: 'number', description: 'Deviation minimum (10-90%, defaut: 30)' },
        page: { type: 'number', description: 'Page (defaut: 1)' },
        pageSize: { type: 'number', description: 'Resultats par page (defaut: 20, max: 100)' },
      },
    },
  },
  {
    name: 'get_liquidity',
    description: 'Indice de liquidite du marche par quartier (taux de rotation, stock, delai de vente)',
    inputSchema: {
      type: 'object',
      properties: {
        quartier: { type: 'string', description: 'Quartier specifique (optionnel, tous si omis)' },
        status: { type: 'string', enum: ['vente', 'location', 'all'], description: 'Filtrer par type (defaut: all)' },
      },
    },
  },
  {
    name: 'get_agency_leaderboard',
    description: 'Classement des agences immobilieres par volume d\'annonces',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Nombre d\'agences (5-100, defaut: 20)' },
      },
    },
  },
];

// --- Handler functions ---

async function handleSearchListings(args) {
  const clauses = ['a.prix IS NOT NULL', 'a.prix > 0', 'a.est_active = true'];
  const values = [];
  let i = 1;

  const roomsSql = `COALESCE(
    (SELECT NULLIF(MAX(c2.pieces), 0) FROM ${DB.caracteristiques} c2 WHERE c2.annonce_id = a.id),
    (SELECT NULLIF(MAX(c3.chambres), 0) FROM ${DB.caracteristiques} c3 WHERE c3.annonce_id = a.id),
    NULLIF((regexp_match(LOWER(COALESCE(a.titre,'')), '([0-9]+)\\s*(piece|pieces|chambre|chambres)'))[1]::int, 0)
  )`;

  if (args.transaction) {
    const t = args.transaction === 'Vente' ? 'vente' : 'location';
    clauses.push(`a.statut = $${i++}`);
    values.push(t);
  }
  if (args.location) {
    const loc = String(args.location).trim().toLowerCase();
    clauses.push(`LOWER(COALESCE(NULLIF(TRIM(l.quartier),''), NULLIF(TRIM(l.ville),''))) = $${i++}`);
    values.push(loc);
  }
  if (args.propertyType) {
    clauses.push(`LOWER(COALESCE(a.type_bien,'')) = $${i++}`);
    values.push(String(args.propertyType).toLowerCase());
  }
  if (args.priceMin > 0) { clauses.push(`a.prix >= $${i++}`); values.push(args.priceMin); }
  if (args.priceMax > 0) { clauses.push(`a.prix <= $${i++}`); values.push(args.priceMax); }
  if (args.surfaceMin > 0) { clauses.push(`a.surface >= $${i++}`); values.push(args.surfaceMin); }
  if (args.surfaceMax > 0) { clauses.push(`a.surface <= $${i++}`); values.push(args.surfaceMax); }
  if (args.roomsMin > 0) { clauses.push(`${roomsSql} >= $${i++}`); values.push(args.roomsMin); }
  if (args.roomsMax > 0) { clauses.push(`${roomsSql} <= $${i++}`); values.push(args.roomsMax); }
  if (args.q) {
    clauses.push(`(LOWER(COALESCE(a.titre,'')) LIKE $${i} OR LOWER(COALESCE(a.description,'')) LIKE $${i})`);
    values.push(`%${String(args.q).toLowerCase()}%`);
    i++;
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const page = Math.max(1, args.page || 1);
  const pageSize = Math.min(60, Math.max(1, args.pageSize || 12));
  const sortMap = {
    price_asc: 'a.prix ASC NULLS LAST, a.id DESC',
    price_desc: 'a.prix DESC NULLS LAST, a.id DESC',
    date_asc: 'COALESCE(a.date_publication, TO_TIMESTAMP(0)) ASC, a.id ASC',
    date_desc: 'COALESCE(a.date_publication, TO_TIMESTAMP(0)) DESC, a.id DESC',
  };
  const orderBy = sortMap[args.sort] || sortMap.date_desc;

  const countSql = `SELECT COUNT(DISTINCT a.id)::int AS total FROM ${DB.annonces} a LEFT JOIN ${DB.localisations} l ON l.annonce_id = a.id ${where}`;
  const countRes = await (await getDb()).query(countSql, values);
  const total = Number(countRes.rows[0]?.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * pageSize;

  values.push(pageSize, offset);
  const dataSql = `
    SELECT a.id, COALESCE(NULLIF(a.titre,''), CONCAT('Annonce #', a.id)) AS title,
      COALESCE(a.prix, 0) AS price, NULLIF(a.surface, 0) AS surface,
      ${roomsSql} AS rooms,
      COALESCE(NULLIF(NULLIF(TRIM(l.quartier),''), 'N/A'), NULLIF(TRIM(l.ville),'')) AS city,
      CASE WHEN a.statut='vente' THEN 'Vente' WHEN a.statut='location' THEN 'Location' ELSE 'Vente' END AS type,
      INITCAP(COALESCE(NULLIF(a.type_bien,''), 'Bien')) AS propertyType,
      a.description AS description, a.date_publication AS posted_at,
      l.latitude::float8 AS lat, l.longitude::float8 AS lng,
      (SELECT NULLIF(img.url_image,'') FROM images img
        WHERE img.annonce_id = a.id AND NULLIF(img.url_image,'') IS NOT NULL
        ORDER BY COALESCE(img.est_principale,false) DESC, img.id ASC LIMIT 1
      ) AS image
    FROM ${DB.annonces} a
    LEFT JOIN ${DB.localisations} l ON l.annonce_id = a.id
    ${where}
    ORDER BY ${orderBy}
    LIMIT $${i++} OFFSET $${i}
  `;
  const res = await (await getDb()).query(dataSql, values);

  return {
    data: res.rows.map(r => {
      let type = r.type;
      const title = r.title || '';
      const price = Number(r.price);
      const surface = r.surface == null ? null : Number(r.surface);
      // Heuristic: override Vente→Location if title contains rental keywords and price is monthly-range
      if (type === 'Vente' && (/\b(louer|loyer|location|mensuel|mois)\b/i).test(title) && price < 50000) {
        type = 'Location';
      }
      return {
        id: r.id, title, price,
        surface,
        pricePerM2: surface && surface > 0 && price > 0 ? Math.round(price / surface) : null,
        rooms: r.rooms == null ? null : Number(r.rooms),
        city: r.city || null, type,
        propertyType: r.propertytype,
        description: cleanHtml(r.description),
        image: r.image || defaultImage(r.id),
        postedAt: r.posted_at,
        lat: r.lat == null ? null : Number(r.lat),
        lng: r.lng == null ? null : Number(r.lng),
      };
    }),
    meta: { page: safePage, pageSize, total, totalPages, sort: args.sort || 'date_desc' },
  };
}

async function handleGetListing(args) {
  const id = Number(args.id);
  if (!Number.isFinite(id) || id <= 0) return { error: 'ID invalide' };

  const baseSql = `
    SELECT a.id, COALESCE(NULLIF(a.titre,''), CONCAT('Annonce #', a.id)) AS title,
      COALESCE(a.prix, 0) AS price, NULLIF(a.surface, 0) AS surface,
      COALESCE(NULLIF(c.pieces, 0), NULLIF(c.chambres, 0),
        NULLIF((regexp_match(LOWER(COALESCE(a.titre,'')), '([0-9]+)\\s*(piece|pieces|chambre|chambres)'))[1]::int, 0)
      ) AS rooms, NULLIF(c.chambres, 0) AS bedrooms,
      NULLIF(c.salles_de_bain, 0) AS bathrooms,
      COALESCE(NULLIF(NULLIF(TRIM(l.quartier),''), 'N/A'), NULLIF(TRIM(l.ville),'')) AS city,
      CASE WHEN a.statut='vente' THEN 'Vente' WHEN a.statut='location' THEN 'Location' ELSE 'Vente' END AS type,
      INITCAP(COALESCE(NULLIF(a.type_bien,''), 'Bien')) AS propertyType,
      NULLIF(TRIM(COALESCE(ct.agence_nom,'')), '') AS agency_name,
      COALESCE(NULLIF(ct.telephone_principal,''), NULLIF(ct.telephone,''), '212600000000') AS phone,
      a.description AS description, a.date_publication AS posted_at,
      l.latitude::float8 AS lat, l.longitude::float8 AS lng
    FROM ${DB.annonces} a
    LEFT JOIN ${DB.localisations} l ON l.annonce_id = a.id
    LEFT JOIN ${DB.caracteristiques} c ON c.annonce_id = a.id
    LEFT JOIN ${DB.contacts} ct ON ct.annonce_id = a.id
    WHERE a.id = $1 LIMIT 1
  `;
  const res = await (await getDb()).query(baseSql, [id]);
  if (!res.rows.length) return { error: 'Annonce introuvable' };

  const [imgRes, eqRes] = await Promise.all([
    (await getDb()).query(`SELECT url_image FROM images WHERE annonce_id = $1 AND NULLIF(url_image,'') IS NOT NULL ORDER BY COALESCE(est_principale,false) DESC, id ASC LIMIT 12`, [id]).catch(() => null),
    (await getDb()).query(`SELECT e.nom FROM annonce_equipements ae JOIN equipements e ON e.id = ae.equipement_id WHERE ae.annonce_id = $1 ORDER BY e.nom ASC`, [id]).catch(() => null),
  ]);

  const r = res.rows[0];
  let type = r.type;
  const title = r.title || '';
  if (type === 'Vente' && (/\b(louer|loyer|location|mensuel|mois)\b/i).test(title) && Number(r.price) < 50000) {
    type = 'Location';
  }

  const images = (imgRes?.rows || []).map(r => r.url_image).filter(Boolean);
  if (!images.length) images.push(defaultImage(r.id));

  const features = [];
  if ((r.title || '').toLowerCase().includes('exclusiv')) features.push('exclusive');
  if ((r.description || '').toLowerCase().includes('tram') || (r.title || '').toLowerCase().includes('tram')) features.push('tram');
  if (eqRes?.rows?.some(r => String(r.nom).toLowerCase().includes('terrasse'))) features.push('terrace');
  if (eqRes?.rows?.some(r => String(r.nom).toLowerCase().includes('piscine'))) features.push('pool');

  const price = Number(r.price);
  const surface = r.surface == null ? null : Number(r.surface);
  return {
    id: r.id, title, price,
    pricePerM2: surface && surface > 0 && price > 0 ? Math.round(price / surface) : null,
    surface,
    rooms: r.rooms == null ? null : Number(r.rooms),
    bedrooms: r.bedrooms == null ? null : Number(r.bedrooms),
    bathrooms: r.bathrooms == null ? null : Number(r.bathrooms),
    city: r.city || null, type,
    propertyType: r.propertytype,
    agencyName: r.agency_name || null,
    phone: r.phone,
    description: cleanHtml(r.description),
    postedAt: r.posted_at,
    lat: r.lat == null ? null : Number(r.lat),
    lng: r.lng == null ? null : Number(r.lng),
    images, features,
    equipments: (eqRes?.rows || []).map(r => r.nom),
  };
}

async function handleEstimateProperty(args) {
  const type = String(args.type || '').trim();
  const quartier = String(args.quartier || '').trim();
  const surface = Number(args.surface);
  const ville = String(args.ville || '').trim() || 'Rabat';
  const coeffs = {
    standing: String(args.standing || '').trim() || null,
    etat: String(args.etat || '').trim() || null,
    etage: String(args.etage || '').trim() || null,
    exposition: null,
  };

  if (!type || !['vente', 'location'].includes(type)) return { error: 'Type invalide (vente ou location)' };
  if (!quartier) return { error: 'Quartier requis' };
  if (!Number.isFinite(surface) || surface <= 0) return { error: 'Surface invalide' };

  const res = await (await getDb()).query('SELECT sp_estimation_prix($1, $2, $3, $4, $5) AS result', [
    type, quartier, ville, surface, JSON.stringify(coeffs),
  ]);
  const raw = res.rows?.[0]?.result;
  const r = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!r) return { error: 'Estimation non disponible' };

  return {
    estimation_disponible: r.estimation_disponible || false,
    quartier: r.quartier || quartier,
    type: r.type || type,
    surface_saisie: r.surface_saisie || Math.round(surface),
    prix_m2_moyen: r.prix_m2_moyen || null,
    estimation_basse: r.estimation_basse || null,
    estimation_mediane: r.estimation_mediane || null,
    estimation_haute: r.estimation_haute || null,
    nb_annonces: r.nb_annonces || 0,
    coefficient_applique: r.coefficient_applique || null,
  };
}

async function handleMarketTrends(args) {
  const status = String(args.status || 'all').trim();
  const months = Math.min(36, Math.max(3, Number(args.months) || 12));
  const values = [months];
  let statusSql = '';
  if (status !== 'all') { values.push(status); statusSql = 'AND a.statut = $2'; }

  const sql = `
    WITH monthly AS (
      SELECT DATE_TRUNC('month', h.date_releve) AS mois,
        CASE
          WHEN LOWER(COALESCE(NULLIF(TRIM(l.quartier),''),'')) LIKE '%riyad%' OR LOWER(COALESCE(NULLIF(TRIM(l.quartier),''),'')) LIKE '%hay riad%' THEN 'Hay Riad'
          WHEN LOWER(COALESCE(NULLIF(TRIM(l.quartier),''),'')) LIKE '%hassan%' THEN 'Hassan'
          WHEN LOWER(COALESCE(NULLIF(TRIM(l.quartier),''),'')) LIKE '%souissi%' THEN 'Souissi'
          WHEN LOWER(COALESCE(NULLIF(TRIM(l.quartier),''),'')) LIKE '%agdal%' THEN 'Agdal'
          ELSE COALESCE(NULLIF(NULLIF(TRIM(l.quartier),''), 'N/A'), NULLIF(TRIM(l.ville),''))
        END AS district,
        CASE
          WHEN LOWER(COALESCE(NULLIF(TRIM(l.ville),''), 'Rabat')) IN ('sale','sale') THEN 'Sale'
          WHEN LOWER(COALESCE(NULLIF(TRIM(l.ville),''), 'Rabat')) IN ('temara','temara') THEN 'Temara'
          ELSE 'Rabat'
        END AS ville,
        a.statut, AVG(h.prix / NULLIF(a.surface, 0)) AS prix_m2_moyen,
        COUNT(DISTINCT a.id)::int AS nb_annonces
      FROM ${DB.historiquePrix} h
      JOIN ${DB.annonces} a ON a.id = h.annonce_id
      JOIN ${DB.localisations} l ON l.annonce_id = a.id
      WHERE a.prix IS NOT NULL AND a.surface IS NOT NULL AND a.surface > 0 AND a.est_active = true
        AND l.quartier IS NOT NULL AND l.quartier != 'N/A'
        AND DATE_TRUNC('month', h.date_releve) >= DATE_TRUNC('month', NOW()) - ($1::int || ' months')::interval
        ${statusSql}
      GROUP BY DATE_TRUNC('month', h.date_releve), district, ville, a.statut
      HAVING COUNT(DISTINCT a.id) >= 3
    ),
    ranked AS (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY district, statut ORDER BY mois DESC) AS rn
      FROM monthly
    ),
    agg AS (
      SELECT district, ville, statut AS status,
        MAX(CASE WHEN rn = 1 THEN prix_m2_moyen END) AS latest_price_m2,
        MAX(CASE WHEN rn = 2 THEN prix_m2_moyen END) AS previous_price_m2,
        MAX(CASE WHEN rn = 1 THEN nb_annonces END)::int AS latest_samples,
        MAX(CASE WHEN rn = 2 THEN nb_annonces END)::int AS previous_samples
      FROM ranked WHERE rn <= 2
      GROUP BY district, ville, statut
      HAVING MAX(CASE WHEN rn = 2 THEN prix_m2_moyen END) IS NOT NULL
    )
    SELECT district, ville, status,
      ROUND(latest_price_m2, 0) AS latest_price_m2,
      ROUND(previous_price_m2, 0) AS previous_price_m2,
      latest_samples, previous_samples,
      ROUND(((latest_price_m2 - previous_price_m2) / NULLIF(previous_price_m2, 0))::numeric * 100, 1) AS variation_pct
    FROM agg
    ORDER BY ABS((latest_price_m2 - previous_price_m2) / NULLIF(previous_price_m2, 0) * 100) DESC NULLS LAST
  `;
  const res = await (await getDb()).query(sql, values);
  return {
    data: res.rows.map(r => ({
      district: r.district, ville: r.ville, status: r.status,
      latestPriceM2: Number(r.latest_price_m2 || 0),
      previousPriceM2: Number(r.previous_price_m2 || 0),
      latestSamples: Number(r.latest_samples || 0),
      previousSamples: Number(r.previous_samples || 0),
      variationPct: Number(r.variation_pct || 0),
    })),
  };
}

async function handleQuartierStats(args) {
  const values = [];
  let where = 'WHERE a.prix IS NOT NULL AND a.prix > 0 AND a.est_active = true AND a.surface IS NOT NULL AND a.surface > 0';
  if (args.transaction) {
    const t = args.transaction === 'Vente' ? 'vente' : 'location';
    where += ' AND a.statut = $1';
    values.push(t);
  }
  const sql = `
    SELECT COALESCE(NULLIF(NULLIF(TRIM(l.quartier),''), 'N/A'), NULLIF(TRIM(l.ville),'')) AS quartier,
      CASE
        WHEN LOWER(COALESCE(NULLIF(TRIM(l.ville),''), 'Rabat')) IN ('sale','sale') THEN 'Sale'
        WHEN LOWER(COALESCE(NULLIF(TRIM(l.ville),''), 'Rabat')) IN ('temara','temara') THEN 'Temara'
        ELSE 'Rabat'
      END AS ville,
      ROUND(AVG(a.prix / NULLIF(a.surface, 0))::numeric, 0) AS prix_m2_moyen,
      ROUND(AVG(a.prix)::numeric, 0) AS prix_moyen,
      COUNT(*)::int AS nb_annonces,
      MIN(a.prix)::int AS prix_min,
      MAX(a.prix)::int AS prix_max
    FROM ${DB.annonces} a
    JOIN ${DB.localisations} l ON l.annonce_id = a.id
    ${where}
    GROUP BY quartier, ville
    HAVING COUNT(*) >= 3
    ORDER BY quartier
  `;
  const res = await (await getDb()).query(sql, values);
  return { data: res.rows.map(r => ({
    quartier: r.quartier, ville: r.ville,
    prixM2Moyen: Number(r.prix_m2_moyen || 0),
    prixMoyen: Number(r.prix_moyen || 0),
    nbAnnonces: r.nb_annonces,
    prixMin: Number(r.prix_min || 0),
    prixMax: Number(r.prix_max || 0),
  })) };
}

async function handleListQuartiers() {
  const sql = `SELECT DISTINCT COALESCE(NULLIF(NULLIF(TRIM(quartier),''), 'N/A'), NULLIF(TRIM(ville),'')) AS quartier,
    CASE
      WHEN LOWER(COALESCE(NULLIF(TRIM(ville),''), 'Rabat')) IN ('sale','sale') THEN 'Sale'
      WHEN LOWER(COALESCE(NULLIF(TRIM(ville),''), 'Rabat')) IN ('temara','temara') THEN 'Temara'
      ELSE 'Rabat'
    END AS ville
    FROM ${DB.localisations}
    WHERE quartier IS NOT NULL AND quartier != '' AND quartier != 'N/A'
    ORDER BY quartier`;
  const res = await (await getDb()).query(sql);
  return { data: res.rows };
}

async function handleListVilles() {
  const sql = `SELECT DISTINCT
    CASE
      WHEN LOWER(COALESCE(NULLIF(TRIM(ville),''), 'Rabat')) IN ('sale','sale') THEN 'Sale'
      WHEN LOWER(COALESCE(NULLIF(TRIM(ville),''), 'Rabat')) IN ('temara','temara') THEN 'Temara'
      ELSE 'Rabat'
    END AS ville
    FROM ${DB.localisations}
    ORDER BY ville`;
  const res = await (await getDb()).query(sql);
  return { data: res.rows.map(r => r.ville) };
}

async function handleCreateLead(args) {
  const name = String(args.name || '').trim();
  const phone = String(args.phone || '').trim();
  if (name.length < 2 || name.length > 120) return { error: 'Nom invalide (2-120 caracteres)' };
  if (phone.length < 8 || phone.length > 24) return { error: 'Telephone invalide (8-24 caracteres)' };

  const source = String(args.source || 'mcp').trim();
  const listingId = Number(args.listingId) > 0 ? Number(args.listingId) : null;

  const res = await (await getDb()).query(
    `INSERT INTO ${DB.leads} (name, phone, source, listing_id) VALUES ($1, $2, $3, $4) RETURNING id`,
    [name, phone, source, listingId]
  );
  return { ok: true, id: res.rows[0].id, message: 'Lead enregistre' };
}

// --- New handler functions ---

async function handleGetComparables(args) {
  try {
    const result = await market.getComparables(toSearchParams(args));
    return result;
  } catch (err) {
    return { error: err.message };
  }
}

async function handleGetInvestorAlerts(args) {
  try {
    const result = await market.getInvestorAlerts(toSearchParams(args));
    return result;
  } catch (err) {
    return { error: err.message };
  }
}

async function handleGetPriceAnalytics(args) {
  try {
    const result = await getPrices(toSearchParams(args));
    return result;
  } catch (err) {
    return { error: err.message };
  }
}

async function handleGetRentalYield(args) {
  try {
    const result = await market.getRentalYield(toSearchParams(args));
    return result;
  } catch (err) {
    return { error: err.message };
  }
}

async function handleGetMarketPredictions(args) {
  try {
    const result = await market.getPredictions(toSearchParams(args));
    return result;
  } catch (err) {
    return { error: err.message };
  }
}

async function handleGetQuartierComparison(args) {
  try {
    const result = await market.getQuartierComparison(toSearchParams(args));
    return result;
  } catch (err) {
    return { error: err.message };
  }
}

async function handleGetSuspiciousListings(args) {
  try {
    const result = await market.getSuspiciousListings(toSearchParams(args));
    return result;
  } catch (err) {
    return { error: err.message };
  }
}

async function handleGetLiquidity(args) {
  try {
    const result = await market.getLiquidity(toSearchParams(args));
    return result;
  } catch (err) {
    return { error: err.message };
  }
}

async function handleGetAgencyLeaderboard(args) {
  try {
    const result = await market.getAgencyLeaderboard(toSearchParams(args));
    return result;
  } catch (err) {
    return { error: err.message };
  }
}

// --- MCP request handler ---

const HANDLERS = {
  search_listings: handleSearchListings,
  get_listing: handleGetListing,
  estimate_property: handleEstimateProperty,
  get_market_trends: handleMarketTrends,
  get_quartier_stats: handleQuartierStats,
  list_quartiers: handleListQuartiers,
  list_villes: handleListVilles,
  create_lead: handleCreateLead,
  get_comparables: handleGetComparables,
  get_investor_alerts: handleGetInvestorAlerts,
  get_price_analytics: handleGetPriceAnalytics,
  get_rental_yield: handleGetRentalYield,
  get_market_predictions: handleGetMarketPredictions,
  get_quartier_comparison: handleGetQuartierComparison,
  get_suspicious_listings: handleGetSuspiciousListings,
  get_liquidity: handleGetLiquidity,
  get_agency_leaderboard: handleGetAgencyLeaderboard,
};

async function handleRequest(msg) {
  const { id, method, params } = msg;

  if (method === 'initialize') {
    const clientVersion = params?.protocolVersion;
    const version = SUPPORTED_VERSIONS.includes(clientVersion) ? clientVersion : MCP_VERSION;
    return {
      jsonrpc: '2.0', id,
      result: {
        protocolVersion: version,
        capabilities: { tools: {} },
        serverInfo: { name: 'realestatecapitale-mcp', version: '1.0.0' },
      },
    };
  }

  if (method === 'notifications/initialized') return null;

  if (method === 'tools/list') {
    return { jsonrpc: '2.0', id, result: { tools: TOOLS } };
  }

  if (method === 'tools/call') {
    const toolName = params?.name;
    const args = params?.arguments || {};
    const handler = HANDLERS[toolName];

    if (!handler) {
      return {
        jsonrpc: '2.0', id,
        error: { code: -32601, message: `Tool not found: ${toolName}` },
      };
    }

    try {
      const result = await handler(args);
      const hasError = !!result.error;
      let summary = '';
      if (hasError) {
        summary = result.error;
      } else if (result.comparables && Array.isArray(result.comparables)) {
        summary = `${result.comparables.length} comparable(s) pour #${result.target?.id || '?'} (${result.target?.district || '?'}, ${Number(result.target?.priceM2 || 0).toLocaleString('fr-FR')} DH/m²)`;
      } else if (result.data && Array.isArray(result.data)) {
        summary = `${result.data.length} resultat(s) trouve(s)`;
        if (result.meta) summary += ` (page ${result.meta.page}/${result.meta.totalPages}, ${result.meta.total} total)`;
      } else if (result.data && !Array.isArray(result.data)) {
        summary = typeof result.data === 'object' ? 'Donnees disponibles' : String(result.data);
      } else if (result.estimation_disponible) {
        summary = `Estimation ${result.type} ${result.quartier}: ${Number(result.estimation_mediane || 0).toLocaleString('fr-FR')} DH pour ${result.surface_saisie} m²`;
      } else if (result.ok) {
        summary = result.message || 'Operation reussie';
      } else if (result.id) {
        summary = `Annonce #${result.id}: ${result.title || ''}`.trim();
      } else {
        summary = 'Donnees disponibles';
      }
      return {
        jsonrpc: '2.0', id,
        result: {
          content: [{ type: 'text', text: summary }],
          _meta: { data: result },
          isError: hasError,
        },
      };
    } catch (err) {
      logError(err);
      return {
        jsonrpc: '2.0', id,
        result: {
          content: [{ type: 'text', text: `Erreur: ${err.message}` }],
          isError: true,
        },
      };
    }
  }

  return {
    jsonrpc: '2.0', id,
    error: { code: -32601, message: `Method not found: ${method}` },
  };
}

async function closeDb() {
  if (db) { try { await db.end(); } catch {} }
}

module.exports = {
  MCP_VERSION,
  TOOLS,
  HANDLERS,
  getDb,
  handleRequest,
  logError,
  closeDb,
};
