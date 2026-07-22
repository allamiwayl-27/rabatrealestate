# Serveur MCP — Real Estate Capitale

Fichier : `mcp-server.js` (593 lignes)
Connexion : PostgreSQL direct (via `pg`)
Protocole : MCP (JSON-RPC 2.0) sur stdio

---

## Tool 1 — `search_listings`

Rechercher des biens immobiliers avec filtres.

**Paramètres :**

| Champ | Type | Description |
|-------|------|-------------|
| `transaction` | `string` | `"Vente"` ou `"Location"` |
| `location` | `string` | Quartier ou ville (ex: `"Agdal"`, `"Hay Riad"`, `"Salé"`) |
| `propertyType` | `string` | `Appartement`, `Maison`, `Villa`, `Studio`, `Terrain`, `Bureau`, `Commerce`, `Riad` |
| `priceMin` | `number` | Prix minimum en MAD |
| `priceMax` | `number` | Prix maximum en MAD |
| `surfaceMin` | `number` | Surface minimum en m² |
| `surfaceMax` | `number` | Surface maximum en m² |
| `roomsMin` | `number` | Nombre minimum de pièces |
| `roomsMax` | `number` | Nombre maximum de pièces |
| `q` | `string` | Mot-clé dans le titre ou la description |
| `sort` | `string` | `price_asc`, `price_desc`, `date_desc`, `date_asc` |
| `page` | `number` | Page (défaut: 1) |
| `pageSize` | `number` | Résultats par page (défaut: 12, max: 60) |

**Retour :**
```json
{
  "data": [
    {
      "id": 123,
      "title": "Appartement 3 pieces Agdal",
      "price": 1200000,
      "surface": 85,
      "rooms": 3,
      "city": "Agdal",
      "type": "Vente",
      "propertyType": "Appartement",
      "description": "...",
      "image": "https://...",
      "postedAt": "2025-01-15T10:00:00Z",
      "lat": 34.0,
      "lng": -6.8
    }
  ],
  "meta": { "page": 1, "pageSize": 12, "total": 150, "totalPages": 13, "sort": "date_desc" }
}
```

**SQL :** Requête sur les tables `annonces` + `localisations` + `caracteristiques`, avec pagination, tri et 12 filtres optionnels.

---

## Tool 2 — `get_listing`

Obtenir le détail complet d'un bien immobilier par son ID.

**Paramètres :**

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `id` | `number` | Oui | ID du bien immobilier |

**Retour :**
```json
{
  "id": 123,
  "title": "Appartement 3 pieces Agdal",
  "price": 1200000,
  "surface": 85,
  "rooms": 3,
  "bedrooms": 2,
  "bathrooms": 1,
  "city": "Agdal",
  "type": "Vente",
  "propertyType": "Appartement",
  "phone": "2126XXXXXXXX",
  "description": "...",
  "postedAt": "2025-01-15T10:00:00Z",
  "lat": 34.0,
  "lng": -6.8
}
```

**SQL :** Jointure `annonces` + `localisations` + `caracteristiques` + `contacts`.

---

## Tool 3 — `estimate_property`

Estimer la valeur d'un bien immobilier via la procédure stockée `sp_estimation_prix()`.

**Paramètres :**

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `type` | `string` | Oui | `"vente"` ou `"location"` |
| `quartier` | `string` | Oui | Quartier (ex: `"Agdal"`, `"Hay Riad"`) |
| `surface` | `number` | Oui | Surface en m² |
| `ville` | `string` | Non | Ville (défaut: `"Rabat"`) |
| `pieces` | `number` | Non | Nombre de pièces |
| `etage` | `string` | Non | `rdc`, `bas`, `milieu`, `haut`, `dernier` |
| `etat` | `string` | Non | `renover`, `bon`, `neuf` |
| `standing` | `string` | Non | `economique`, `standard`, `standing`, `luxe` |

**Retour :**
```json
{
  "estimation_disponible": true,
  "quartier": "Agdal",
  "type": "vente",
  "surface_saisie": 120,
  "prix_m2_moyen": 18500,
  "estimation_basse": 1700000,
  "estimation_mediane": 2100000,
  "estimation_haute": 2500000,
  "nb_annonces": 45,
  "coefficient_applique": 1.15
}
```

**SQL :** `SELECT sp_estimation_prix($1, $2, $3, $4, $5)` avec coefficients standing/état/étage.

---

## Tool 4 — `get_market_trends`

Obtenir les tendances du marché immobilier par quartier (variation de prix sur N mois).

**Paramètres :**

| Champ | Type | Description |
|-------|------|-------------|
| `status` | `string` | `"vente"`, `"location"`, ou `"all"` (défaut) |
| `months` | `number` | Période en mois (3-36, défaut: 12) |

**Retour :**
```json
{
  "data": [
    {
      "district": "Agdal",
      "ville": "Rabat",
      "status": "vente",
      "latestPriceM2": 18500,
      "previousPriceM2": 18200,
      "latestSamples": 25,
      "previousSamples": 22,
      "variationPct": 1.6
    }
  ]
}
```

**SQL :** CTE `monthly` → `ranked` → `aggregated` sur `historique_prix` avec ré-échantillonnage mensuel. Minimum 3 annonces par cohorte pour validité.

---

## Tool 5 — `get_quartier_stats`

Statistiques agrégées par quartier (prix m² moyen, nombre d'annonces, fourchette).

**Paramètres :**

| Champ | Type | Description |
|-------|------|-------------|
| `transaction` | `string` | `"Vente"` ou `"Location"` (optionnel, tous par défaut) |

**Retour :**
```json
{
  "data": [
    {
      "quartier": "Agdal",
      "ville": "Rabat",
      "prixM2Moyen": 18500,
      "prixMoyen": 2100000,
      "nbAnnonces": 45,
      "prixMin": 500000,
      "prixMax": 5000000
    }
  ]
}
```

**SQL :** `GROUP BY quartier, ville` avec `AVG`, `MIN`, `MAX` sur les annonces actives. Minimum 3 annonces par quartier.

---

## Tool 6 — `list_quartiers`

Lister tous les quartiers disponibles avec leur ville.

**Paramètres :** Aucun

**Retour :**
```json
{
  "data": [
    { "quartier": "Agdal", "ville": "Rabat" },
    { "quartier": "Hay Riad", "ville": "Rabat" },
    { "quartier": "Tabriquet", "ville": "Salé" },
    { "quartier": "Harhoura", "ville": "Témara" }
  ]
}
```

**SQL :** `SELECT DISTINCT quartier, ville FROM localisations WHERE quartier IS NOT NULL` (trie les alias communs : Salé/Sale, Témara/Temara).

---

## Tool 7 — `list_villes`

Lister toutes les villes disponibles.

**Paramètres :** Aucun

**Retour :**
```json
{
  "data": ["Rabat", "Salé", "Témara"]
}
```

**SQL :** `SELECT DISTINCT` avec normalisation des alias.

---

## Tool 8 — `create_lead`

Créer un lead (contact client) pour prise de rendez-vous ou demande d'information.

**Paramètres :**

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `name` | `string` | Oui | Nom du contact (2-120 caractères) |
| `phone` | `string` | Oui | Téléphone (8-24 caractères, ex: `"0612345678"`) |
| `source` | `string` | Non | `website`, `whatsapp_click`, `facebook`, `phone`, `other`, `mcp` (défaut: `mcp`) |
| `listingId` | `number` | Non | ID du bien concerné |

**Retour :**
```json
{
  "ok": true,
  "id": 42,
  "message": "Lead enregistre"
}
```

**Validation :** name 2-120 chars, phone 8-24 chars.

**SQL :** `INSERT INTO leads (name, phone, source, listing_id) VALUES ($1, $2, $3, $4) RETURNING id`.

---

## Schéma de la base

Tables utilisées par le serveur MCP :

| Table | Rôle | Colonnes clés |
|-------|------|---------------|
| `annonces` | Annonces immobilières | `id`, `titre`, `prix`, `surface`, `statut` (vente/location), `type_bien`, `est_active`, `date_publication`, `description` |
| `localisations` | Localisation géographique | `annonce_id`, `quartier`, `ville`, `latitude`, `longitude` |
| `caracteristiques` | Caractéristiques détaillées | `annonce_id`, `pieces`, `chambres`, `salles_de_bain` |
| `contacts` | Coordonnées de contact | `annonce_id`, `telephone_principal`, `telephone`, `agence_nom` |
| `historique_prix` | Historique des prix pour tendances | `annonce_id`, `date_releve`, `prix` |
| `leads` | Leads clients | `id`, `name`, `phone`, `source`, `listing_id`, `created_at` |

---

## Dépendances

- **Runtime :** Node.js ≥ 20
- **Module npm :** `pg` (PostgreSQL)
- **Base de données :** PostgreSQL (via `DATABASE_URL`)

## Configuration

Variable d'environnement :

```
DATABASE_URL=postgresql://scraper:admin@127.0.0.1:5432/mubawab
```

## Intégration Claude Desktop

```json
{
  "mcpServers": {
    "realestatecapitale": {
      "command": "C:\\Program Files\\nodejs\\node.exe",
      "args": ["C:\\RABATICI\\mcp-server.js"],
      "env": {
        "DATABASE_URL": "postgresql://scraper:admin@127.0.0.1:5432/mubawab"
      }
    }
  }
}
```

## Intégration opencode

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "realestatecapitale": {
      "type": "local",
      "command": ["C:\\Program Files\\nodejs\\node.exe", "C:\\RABATICI\\mcp-server.js"],
      "enabled": true,
      "env": {
        "DATABASE_URL": "postgresql://scraper:admin@127.0.0.1:5432/mubawab"
      }
    }
  }
}
```

## Test

```powershell
cd C:\RABATICI && node tests\test-mcp.js
```
