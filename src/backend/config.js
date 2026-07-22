const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');

const loadDotEnv = () => {
  const files = [];
  if (process.env.NODE_ENV === 'production') files.push('.env.prod');
  files.push('.env');
  for (const name of files) {
    const envFile = path.join(ROOT, name);
    if (!fs.existsSync(envFile)) continue;
    const lines = fs.readFileSync(envFile, 'utf8').split('\n');
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const idx = line.indexOf('=');
      if (idx < 1) continue;
      const key = line.slice(0, idx).trim();
      let value = line.slice(idx + 1).trim();
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (!(key in process.env)) process.env[key] = value;
    }
  }
};

loadDotEnv();

const SITE_DOMAIN = String(process.env.SITE_DOMAIN || 'realestatecapitale.ma').toLowerCase().trim();
const SITE_PROTOCOL = String(process.env.SITE_PROTOCOL || 'https').toLowerCase().trim();
const SITE_URL = `${SITE_PROTOCOL}://${SITE_DOMAIN}`;

const DB_TABLES = {
  annonces: process.env.DB_TABLE_ANNONCES || 'annonces',
  localisations: process.env.DB_TABLE_LOCALISATIONS || 'localisations',
  caracteristiques: process.env.DB_TABLE_CARACTERISTIQUES || 'caracteristiques',
  contacts: process.env.DB_TABLE_CONTACTS || 'contacts',
  images: process.env.DB_TABLE_IMAGES || 'images',
  annonceEquipements: process.env.DB_TABLE_ANNONCE_EQUIPEMENTS || 'annonce_equipements',
  equipements: process.env.DB_TABLE_EQUIPEMENTS || 'equipements',
  historiquePrix: process.env.DB_TABLE_HISTORIQUE_PRIX || 'historique_prix',
  quartiers: process.env.DB_TABLE_QUARTIERS || 'quartiers',
  users: process.env.DB_TABLE_USERS || 'users',
  leads: process.env.DB_TABLE_LEADS || 'leads',
  publicUsers: process.env.DB_TABLE_PUBLIC_USERS || 'public_users',
  savedListings: process.env.DB_TABLE_SAVED_LISTINGS || 'saved_listings',
  savedSearches: process.env.DB_TABLE_SAVED_SEARCHES || 'saved_searches',
  savedEstimations: process.env.DB_TABLE_SAVED_ESTIMATIONS || 'saved_estimations',
  articlesBlog: process.env.DB_TABLE_ARTICLES_BLOG || 'articles_blog',
  agencies: process.env.DB_TABLE_AGENCIES || 'agencies',
  newsletterSubscribers: process.env.DB_TABLE_NEWSLETTER_SUBSCRIBERS || 'newsletter_subscribers',
  contactMessages: process.env.DB_TABLE_CONTACT_MESSAGES || 'contact_messages'
};

module.exports = {
  loadDotEnv,
  ROOT, SITE_DOMAIN, SITE_PROTOCOL, SITE_URL,
  DB_TABLES,
};
