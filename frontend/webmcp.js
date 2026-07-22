(function () {
  var mc = document.modelContext || navigator.modelContext;
  if (!mc || typeof mc.registerTool !== 'function') return;

  function init() {
    var API_BASE = (window.RI_CONFIG && window.RI_CONFIG.API_BASE_URL) || 'https://api.realestatecapitale.ma';

    var ac = new AbortController();

    var tools = [
      {
        name: 'search_listings',
        title: 'Rechercher des biens immobiliers',
        description: 'Rechercher et filtrer les annonces immobilières à Rabat, Salé et Témara par transaction, emplacement, type de bien, budget, surface, nombre de pièces et mot-clé.',
        inputSchema: {
          type: 'object',
          properties: {
            transaction: { type: 'string', enum: ['Vente', 'Location'], description: 'Type de transaction (Vente ou Location)' },
            location: { type: 'string', description: 'Quartier ou ville (ex: Agdal, Hay Riad, Salé)' },
            propertyType: { type: 'string', enum: ['Appartement', 'Maison', 'Villa', 'Studio', 'Terrain', 'Bureau', 'Commerce', 'Riad'], description: 'Type de bien' },
            priceMin: { type: 'number', description: 'Prix minimum en MAD' },
            priceMax: { type: 'number', description: 'Prix maximum en MAD' },
            surfaceMin: { type: 'number', description: 'Surface minimum en m²' },
            surfaceMax: { type: 'number', description: 'Surface maximum en m²' },
            roomsMin: { type: 'number', description: 'Nombre minimum de pièces' },
            roomsMax: { type: 'number', description: 'Nombre maximum de pièces' },
            q: { type: 'string', description: 'Mot-clé dans le titre ou la description' },
            sort: { type: 'string', enum: ['price_asc', 'price_desc', 'date_desc', 'date_asc'], description: 'Ordre de tri' },
            page: { type: 'number', description: 'Numéro de page (défaut: 1)' },
            pageSize: { type: 'number', description: 'Résultats par page (max: 60)' }
          }
        },
        annotations: { readOnlyHint: true },
        execute: async function (input) {
          var params = new URLSearchParams();
          for (var key in input) {
            if (input[key] !== undefined && input[key] !== null && input[key] !== '') {
              params.set(key, String(input[key]));
            }
          }
          var url = API_BASE + '/api/listings?' + params.toString();
          var res = await fetch(url, { signal: ac.signal });
          if (!res.ok) throw new Error('Erreur API: ' + res.status);
          return res.json();
        }
      },
      {
        name: 'estimate_property',
        title: 'Estimer un bien immobilier',
        description: 'Estimer la valeur d\'un bien immobilier à Rabat, Salé ou Témara en fonction de son type, de son quartier, de sa surface et d\'autres caractéristiques.',
        inputSchema: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['vente', 'location'], description: 'Type de transaction' },
            quartier: { type: 'string', description: 'Quartier (ex: Agdal, Hay Riad, Souissi)' },
            surface: { type: 'number', description: 'Surface en m²' },
            ville: { type: 'string', description: 'Ville (ex: Rabat, Salé, Témara)' },
            pieces: { type: 'number', description: 'Nombre de pièces' },
            etage: { type: 'string', enum: ['rdc', 'bas', 'milieu', 'haut', 'dernier'], description: 'Type d\'étage' },
            etat: { type: 'string', enum: ['renover', 'bon', 'neuf'], description: 'État du bien' },
            standing: { type: 'string', enum: ['economique', 'standard', 'standing', 'luxe'], description: 'Standing' }
          },
          required: ['type', 'quartier', 'surface']
        },
        annotations: { readOnlyHint: true },
        execute: async function (input) {
          var params = new URLSearchParams();
          for (var key in input) {
            if (input[key] !== undefined && input[key] !== null && input[key] !== '') {
              params.set(key, String(input[key]));
            }
          }
          var url = API_BASE + '/api/estimation-prix?' + params.toString();
          var res = await fetch(url, { signal: ac.signal });
          if (!res.ok) throw new Error('Erreur API: ' + res.status);
          return res.json();
        }
      },
      {
        name: 'get_market_trends',
        title: 'Tendances du marché immobilier',
        description: 'Obtenir les tendances du marché immobilier par quartier avec les variations de prix sur une période donnée.',
        inputSchema: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['vente', 'location', 'all'], description: 'Filtrer par type de transaction (défaut: all)' },
            months: { type: 'number', description: 'Période en mois (3-36, défaut: 12)' }
          }
        },
        annotations: { readOnlyHint: true },
        execute: async function (input) {
          var params = new URLSearchParams();
          if (input.status) params.set('status', input.status);
          if (input.months) params.set('months', String(input.months));
          params.set('pageSize', '50');
          var url = API_BASE + '/api/market/trends?' + params.toString();
          var res = await fetch(url, { signal: ac.signal });
          if (!res.ok) throw new Error('Erreur API: ' + res.status);
          return res.json();
        }
      },
      {
        name: 'get_quartier_stats',
        title: 'Statistiques par quartier',
        description: 'Obtenir les statistiques agrégées par quartier: prix au m² moyen, nombre d\'annonces et fourchettes de prix.',
        inputSchema: {
          type: 'object',
          properties: {
            transaction: { type: 'string', enum: ['Vente', 'Location'], description: 'Filtrer par type de transaction' }
          }
        },
        annotations: { readOnlyHint: true },
        execute: async function (input) {
          var params = new URLSearchParams();
          if (input.transaction) params.set('transaction', input.transaction);
          var url = API_BASE + '/api/quartier-stats?' + params.toString();
          var res = await fetch(url, { signal: ac.signal });
          if (!res.ok) throw new Error('Erreur API: ' + res.status);
          return res.json();
        }
      },
      {
        name: 'get_listing_detail',
        title: 'Détail d\'une annonce',
        description: 'Obtenir les informations détaillées d\'une annonce immobilière spécifique à partir de son ID.',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'number', description: 'ID du bien immobilier' }
          },
          required: ['id']
        },
        annotations: { readOnlyHint: true },
        execute: async function (input) {
          var url = API_BASE + '/api/listings/' + input.id + '?scoreProfile=acquereur';
          var res = await fetch(url, { signal: ac.signal });
          if (!res.ok) throw new Error('Erreur API: ' + res.status);
          return res.json();
        }
      },
      {
        name: 'contact_agent',
        title: 'Contacter un agent',
        description: 'Envoyer un message de contact à un agent immobilier. Cette action crée une demande de suivi qui sera traitée par un conseiller.',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Nom complet du contact' },
            email: { type: 'string', format: 'email', description: 'Adresse email du contact' },
            phone: { type: 'string', description: 'Numéro de téléphone du contact' },
            subject: { type: 'string', description: 'Sujet du message' },
            message: { type: 'string', description: 'Contenu du message' }
          },
          required: ['name', 'email', 'subject', 'message']
        },
        annotations: { readOnlyHint: false },
        execute: async function (input) {
          var res = await fetch(API_BASE + '/api/contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
            signal: ac.signal
          });
          if (!res.ok) throw new Error('Erreur API: ' + res.status);
          return res.json();
        }
      }
    ];

    function registerAll() {
      return Promise.all(tools.map(function (tool) {
        return mc.registerTool(tool, { signal: ac.signal }).catch(function (err) {
          if (err.name === 'AbortError') return;
          console.warn('WebMCP: tool registration failed for "' + tool.name + '":', err.message);
        });
      }));
    }

    registerAll();

    window.addEventListener('pagehide', function () { ac.abort(); }, { once: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
