# @realestatecapitale/mcp-server

Serveur MCP (Model Context Protocol) pour les données immobilières de Rabat, Salé et Témara.

## Installation

```bash
npm install -g @realestatecapitale/mcp-server
```

Ou exécution directe sans installation :

```bash
npx @realestatecapitale/mcp-server          # mode stdio
npx @realestatecapitale/mcp-server-http     # mode HTTP
```

## Utilisation

### Mode stdio (Claude Desktop, opencode, Cursor)

```bash
mcp-server
```

### Mode HTTP/SSE

```bash
mcp-server-http
# Écoute sur le port 3001 (configurable via PORT)
```

## Configuration

```env
DATABASE_URL=postgresql://user:pass@host:5432/db
PORT=3001
```

| Variable | Défaut | Description |
|---|---|---|
| `DATABASE_URL` | — | URL de connexion PostgreSQL (obligatoire) |
| `PORT` | `3001` | Port du serveur HTTP (mode HTTP uniquement) |

## Outils MCP

| Outil | Description |
|---|---|
| `search_listings` | Rechercher des biens avec filtres (transaction, lieu, budget, surface, type) |
| `get_listing` | Détail complet d'un bien par son ID |
| `estimate_property` | Estimation de prix au m² par quartier |
| `get_market_trends` | Tendances du marché sur N mois |
| `get_quartier_stats` | Statistiques agrégées par quartier |
| `list_quartiers` | Liste des quartiers disponibles |
| `list_villes` | Liste des villes disponibles |
| `create_lead` | Créer un lead client |

Documentation complète des outils : [docs/tools.md](docs/tools.md)

## Production

Le serveur est accessible publiquement à l'URL :

```
https://realestatecapitale.ma/mcp
```

Configuration opencode :

```json
{
  "mcp": {
    "realestatecapitale": {
      "type": "remote",
      "url": "https://realestatecapitale.ma/mcp",
      "enabled": true
    }
  }
}
```

## Architecture

```
Client → Cloudflare Worker → Tunnel → Web Server → MCP Server → PostgreSQL
```

Détails : [docs/architecture.md](docs/architecture.md)
