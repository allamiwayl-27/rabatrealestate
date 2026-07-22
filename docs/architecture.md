# Architecture MCP — Real Estate Capitale

## Vue d'ensemble

```
┌──────────────────────────────────────────────────────────────────┐
│                        Client (IA, opencode)                     │
│  opencode.json → type: "http", url: "http://localhost:3001"      │
│  ou → type: "remote", url: "https://realestatecapitale.ma/mcp"   │
└──────────┬──────────────────────────────────┬────────────────────┘
           │ STDIO (local)                    │ HTTP/SSE (prod)
           ▼                                  ▼
┌──────────────────────┐   ┌──────────────────────────────────────┐
│   mcp-server.js      │   │  Cloudflare Edge (worker-proxy.js)   │
│   (stdio transport)  │   │                                      │
│                      │   │  GET /mcp/health   → 200             │
│   lit JSON-RPC de    │   │  GET /mcp/sse      → SSE stream      │
│   stdin, écrit sur   │   │  POST /mcp/messages → 202 accepted   │
│   stdout             │   │                                      │
│                      │   │  MCP_ORIGIN=https://origin.re...ma   │
└──────────┬───────────┘   └──────────────────┬───────────────────┘
           │                                  │
           │   ┌──────────────────────────────┘
           │   │ (via Cloudflare Tunnel)
           ▼   ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Cloudflare Tunnel (cloudflared)               │
│                                                                  │
│  hostname → service                                              │
│  realestatecapitale.ma           → localhost:3000                │
│  origin.realestatecapitale.ma    → localhost:3000                │
│  api.realestatecapitale.ma       → localhost:5000                │
│  mcp.realestatecapitale.ma       → localhost:3001*               │
│  *:  *                           → http_status:404              │
│                                                                  │
│  (*) Fonctionne seulement si le connector combine est utilisé    │
└──────────────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────┐
│  Web Server (server.js → backend/app.js)                        │
│  port 3000                                                      │
│                                                                  │
│  /mcp/* → HTTP proxy vers http://127.0.0.1:3001                 │
│  /api/* → handleApi()                                           │
│  /*     → serveStatic() ou templates SEO                        │
└──────────────────┬───────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│  MCP HTTP/SSE Server (mcp-server-http.js)                       │
│  port 3001                                                      │
│                                                                  │
│  GET  /health  → {"status":"ok","uptime":N,"sessions":N}        │
│  GET  /sse     → SSE stream (event: endpoint, data: {...})       │
│  POST /messages?sessionId=... → 202, réponse via SSE            │
│                                                                  │
│  ↓ utilise                                                      │
└──────────────────┬───────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│  mcp-core.js → TOOLS, HANDLERS, handleRequest()                 │
│                                                                  │
│  Tools disponibles:                                              │
│  - search_listings   → Recherche multi-critères                 │
│  - get_listing       → Détail complet d'un bien                 │
│  - estimate_property → Estimation de valeur                     │
│  - get_market_trends → Tendances du marché                      │
│  - get_quartier_stats → Stats par quartier                      │
│  - list_quartiers    → Liste des quartiers                      │
│  - list_villes       → Liste des villes                         │
│  - create_lead       → Création d'un lead                       │
└──────────────────┬───────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│  PostgreSQL (mubawab)                                            │
│  Tables: annonces, localisations, caracteristiques, ...          │
└──────────────────────────────────────────────────────────────────┘
```

## Composants

### 1. mcp-core.js — Logique partagée

Fichier unique contenant toute la logique métier :
- Définition des 8 outils (nom, description, schéma JSON des paramètres)
- Handlers qui exécutent les requêtes SQL et retournent les résultats
- Connexion DB (PostgreSQL via `pg`)
- Fonction `handleRequest(msg)` pour router les appels JSON-RPC
- Exporte : `TOOLS`, `HANDLERS`, `getDb`, `handleRequest`, `logError`, `closeDb`

Ne dépend d'aucun transport. Réutilisable par `mcp-server.js` (stdio) et `mcp-server-http.js` (SSE).

### 2. mcp-server.js — Transport stdio

Thin wrapper (~40 lignes) qui lit JSON-RPC sur stdin et écrit les réponses sur stdout.
Utilisation : `node mcp-server.js`
Usage typique : intégration locale dans Claude Desktop, Cursor, opencode.

### 3. mcp-server-http.js — Transport HTTP/SSE

Serveur HTTP standalone (port 3001) avec trois endpoints :

| Endpoint | Méthode | Description |
|---|---|---|
| `/health` | GET | Healthcheck JSON |
| `/sse` | GET | SSE stream persistent (heartbeat 15s, cleanup 10min) |
| `/messages?sessionId=` | POST | Requête JSON-RPC, réponse via SSE |

Points clés :
- Sessions SSE nettoyées après 10 min d'inactivité
- Heartbeat toutes les 15s pour maintenir la connexion
- CORS désactivé (Access-Control-Allow-Origin: *)
- Pas de dépendance externe (Node.js native `http`)

### 4. worker-proxy.js — Proxy Cloudflare Worker

Le worker déployé sur le zone `realestatecapitale.ma` intercepte les requêtes et :

1. **Pass-through** : les hostnames non-principaux (`mcp.*`, `origin.*`, `api.*`) sont passés directement au tunnel sans intervention du worker
2. **A2A** : `/a2a`, `/.well-known/agent.json` → `handleA2ARequest()`
3. **MCP proxy** : `/mcp/*` → forward vers `MCP_ORIGIN` (conserve le path original)
4. **Routage classique** : sitemap, contact, pages SEO, assets statiques

La variable d'environnement `MCP_ORIGIN` active le proxy MCP. En production :
```
MCP_ORIGIN = https://origin.realestatecapitale.ma
```

### 5. backend/app.js — Proxy MCP local

Le serveur web principal (port 3000, raw Node.js `http.createServer`) contient un reverse proxy pour MCP :

```javascript
// /mcp/health → http://127.0.0.1:3001/health
// /mcp/sse    → http://127.0.0.1:3001/sse
// /mcp/messages → http://127.0.0.1:3001/messages
```

Ce proxy :
- Préserve la méthode HTTP, les headers et le body
- Stream les réponses SSE sans buffering
- Utilise `MCP_ORIGIN` env var ou `http://127.0.0.1:3001` par défaut
- Timeout et erreurs → 502

## Flux de production

### Requête Health

```
Client → realestatecapitale.ma/mcp/health
  → DNS Cloudflare (104.21.95.188 / 172.67.170.250)
  → Worker (run_worker_first: true)
    → hostname = "realestatecapitale.ma" (primaire, continue)
    → path = "/mcp/health" (match MCP proxy)
    → MCP_ORIGIN = "https://origin.realestatecapitale.ma"
    → fetch("https://origin.realestatecapitale.ma/mcp/health")
  → origin.realestatecapitale.ma (non-primaire, pass-through)
  → Cloudflare Tunnel
    → ingress: origin.realestatecapitale.ma → localhost:3000
  → Web Server (port 3000)
    → path = "/mcp/health" → proxy vers http://127.0.0.1:3001/health
  → MCP Server (port 3001)
    → {"status":"ok","uptime":N,"sessions":0}
  → Réponse retourne par le même chemin
```

### Session SSE + Messages

```
1. GET /mcp/sse
   → SSE stream ouvert, sessionId créé
   → event: endpoint { "endpoint": "/messages?sessionId=xxx" }

2. POST /mcp/messages?sessionId=xxx
   Body: {"jsonrpc":"2.0","id":1,"method":"tools/list"}
   → 202 Accepted (immédiat)
   → Réponse envoyée via le SSE stream:
     event: message { "jsonrpc":"2.0","id":1,"result":{"tools":[...]} }
```

## Configuration

### opencode.json (root)

```json
{
  "mcp": {
    "realestatecapitale": {
      "type": "local",
      "command": ["node", "mcp-server.js"],
      "env": { "DATABASE_URL": "postgresql://..." }
    },
    "realestatecapitale-http": {
      "type": "http",
      "url": "http://localhost:3001"
    }
  }
}
```

### .opencode/mcp.json (opencode project)

```json
{
  "mcp": {
    "realestatecapitale-stdio": {
      "type": "local",
      "command": ["node", "mcp-server.js"],
      "enabled": false
    },
    "realestatecapitale": {
      "type": "http",
      "url": "http://localhost:3001",
      "enabled": true
    }
  }
}
```

### Production (via Cloudflare)

```
URL: https://realestatecapitale.ma/mcp
Type: remote (SSE transport)
```

Pour opencode, configurer un serveur remote :
```json
{
  "mcp": {
    "production": {
      "type": "remote",
      "url": "https://realestatecapitale.ma/mcp"
    }
  }
}
```

### wrangler.jsonc

```json
{
  "vars": {
    "MCP_ORIGIN": "https://origin.realestatecapitale.ma"
  }
}
```

### Tunnel cloudflared (combined-tunnel.yml)

```yaml
tunnel: rabatimmobilier
credentials-file: ~/.cloudflared/6daa4c25-...json
ingress:
  - hostname: origin.realestatecapitale.ma
    service: http://127.0.0.1:3000
  - hostname: api.realestatecapitale.ma
    service: http://127.0.0.1:5000
  - hostname: realestatecapitale.ma
    service: http://127.0.0.1:3000
  - hostname: mcp.realestatecapitale.ma
    service: http://127.0.0.1:3001
  - service: http_status:404
```

**Note** : La config du tunnel est gérée via Cloudflare Dashboard / API (remote config) pour le service Windows. Le fichier local `combined-tunnel.yml` est utilisé par les instances cloudflared lancées manuellement. Pour que `mcp.realestatecapitale.ma` fonctionne de façon fiable, utiliser le chemin `/mcp/*` sur le domaine principal.

## Déploiement

### 1. MCP Server

```bash
node mcp-server-http.js
# Écoute sur le port 3001 (configurable via PORT env var)
```

### 2. Worker Cloudflare

```bash
# Déployer la config production
wrangler deploy

# Vérifier les logs
wrangler tail
```

### 3. Tunnel cloudflared

```bash
# Lancer avec la config combinée (inclut mcp.realestatecapitale.ma)
cloudflared tunnel --config combined-tunnel.yml run

# Vérifier l'état
cloudflared tunnel info rabatimmobilier
```

### 4. Web Server

```bash
node server.js
# Écoute sur le port 3000, proxy MCP activé automatiquement
```

## Tests

```bash
# Local : vérifier que MCP répond
curl http://localhost:3001/health
# → {"status":"ok","uptime":N,"sessions":0}

# Via le web server
curl http://localhost:3000/mcp/health
# → {"status":"ok","uptime":N,"sessions":0}

# Via le tunnel (production)
curl https://realestatecapitale.ma/mcp/health
# → {"status":"ok","uptime":N,"sessions":0}

# SSE stream
curl -N https://realestatecapitale.ma/mcp/sse
# → event: endpoint
# → data: {"endpoint":"/messages?sessionId=xxx"}

# Session complète (SSE + messages)
# Terminal 1 : ouvrir SSE
curl -N https://realestatecapitale.ma/mcp/sse
# Terminal 2 : envoyer une requête (utiliser le sessionId reçu)
curl -X POST "https://realestatecapitale.ma/mcp/messages?sessionId=xxx" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| `error code: 502` | MCP server down ou port 3001 non accessible | Vérifier `node mcp-server-http.js` |
| `error code: 1033` | Tunnel ne trouve pas la règle d'ingress | Utiliser le path `/mcp/*` au lieu du sous-domaine |
| `503` sur `/mcp/*` | `MCP_ORIGIN` non configuré dans le worker | Déployer avec `wrangler deploy` après avoir ajouté la var |
| `404` sur `/mcp/*` | Web server sans le proxy MCP | Vérifier que `backend/app.js` contient le bloc MCP |
| SSE se déconnecte | Timeout du tunnel ou du proxy | Heartbeat toutes les 15s, garder la session active |
| `Authentication error` | Token API Cloudflare invalide | Utiliser `wrangler whoami` pour vérifier |

## Intégration OpenAI (ChatGPT Apps)

### API Responses (appels programmatiques)

```json
{
  "model": "o4-mini",
  "tools": [
    {
      "type": "mcp",
      "server_label": "realestatecapitale",
      "server_url": "https://realestatecapitale.ma/mcp",
      "require_approval": "never"
    }
  ],
  "input": "Cherche un appartement à Agdal, 3 pièces, max 2M MAD"
}
```

- `server_url` : endpoint MCP public (SSE ou Streamable HTTP)
- `require_approval` : `"never"` pour automated, `"always"` pour chaque tool call
- `allowed_tools` (optionnel) : filtrer les outils exposés (`["search_listings", "get_listing"]`)

### ChatGPT App (developer mode)

1. Activer le mode développeur dans ChatGPT : Settings → Security and login → Developer mode
2. Créer une app : Settings → Plugins ou [chatgpt.com/plugins](https://chatgpt.com/plugins) → +
3. Renseigner :
   - **Name** : `Real Estate Capitale`
   - **Description** : `Recherche immobilière au Maroc (Rabat, Salé) — appartements, maisons, villas, tendances du marché`
   - **MCP server URL** : `https://realestatecapitale.ma/mcp`
4. Cliquer Create — ChatGPT liste automatiquement les 8 outils découverts

> Pour rafraîchir les métadonnées après un changement d'outils : Settings → Plugins → cliquer sur l'app → Refresh.

### Authentification OAuth (optionnel)

Pour sécuriser l'accès, implémenter OAuth 2.1 via le [MCP auth spec](https://developers.openai.com/apps-sdk/build/auth) :
- Héberger un document `/.well-known/oauth-protected-resource` sur le serveur
- Configurer un authorization server (Auth0, Okta, Cognito)
- Déclarer `securitySchemes` par outil dans les réponses `tools/list`

---

## Intégration Glama AI

### Via le Glama Gateway

Glama AI fournit un MCP Gateway qui agit comme reverse proxy avec logging, access control et gestion des credentials. Pour connecter le serveur :

```
URL Gateway : https://glama.ai/endpoints/<id>/mcp
```

Procédure :
1. Aller sur [glama.ai/mcp/connectors](https://glama.ai/mcp/connectors) → Add MCP Server → Connector
2. Renseigner :
   - **Name** : `Real Estate Capitale`
   - **Description** : `Annonces immobilières Rabat-Salé — recherche, estimation, tendances`
   - **Server URL** : `https://realestatecapitale.ma/mcp`
   - **Transport** : `streamable-http` (ou SSE)
3. Glama vérifie la reachability et génère une URL Gateway
4. Utiliser cette URL dans n'importe quel client MCP (Claude, Cursor, VS Code, ChatGPT)

### Via le Glama Registry (soumission open-source)

Pour référencer le dépôt dans le registry public Glama :
1. Aller sur [glama.ai/mcp/servers](https://glama.ai/mcp/servers) → Add MCP Server
2. Lier le dépôt GitHub : `https://github.com/anomalyco/rabat-immobilier`
3. Ajouter un fichier `glama.json` à la racine pour contrôler l'affichage :

```json
{
  "displayName": "Real Estate Capitale",
  "description": "MCP server for Moroccan real estate search (Rabat-Salé)",
  "category": "Real Estate",
  "transport": ["sse", "streamable-http"],
  "env": ["DATABASE_URL"],
  "repository": "https://github.com/anomalyco/rabat-immobilier"
}
```

### Client MCP config (Claude, Cursor, etc.)

```json
{
  "mcpServers": {
    "realestatecapitale-glama": {
      "type": "remote",
      "url": "https://glama.ai/endpoints/<id>/mcp"
    }
  }
}
```

### Glama Gateway vs connexion directe

| Critère | Connexion directe | Via Glama Gateway |
|---|---|---|
| Latence | ~50-100ms (direct) | +~20-50ms (proxy) |
| Call logging | ❌ | ✅ JSON-RPC complet |
| Per-tool ACL | ❌ | ✅ |
| Credentials managés | ❌ | ✅ OAuth auto-refresh |
| Audit trail | ❌ | ✅ Export SIEM |
| Analytics | ❌ | ✅ |

---

## Fichiers clés

| Fichier | Rôle |
|---|---|
| `mcp-core.js` | Logique partagée (tools, handlers, DB) |
| `mcp-server.js` | Transport stdio (~40 lignes) |
| `mcp-server-http.js` | Transport HTTP/SSE (port 3001) |
| `worker-proxy.js` | Proxy edge Cloudflare Worker |
| `backend/app.js` | Proxy MCP local (port 3000 → 3001) |
| `wrangler.jsonc` | Config Worker (vars, assets, env) |
| `opencode.json` | Config MCP pour opencode |
| `.opencode/mcp.json` | Config dédiée opencode project |
| `docs/mcp-tools.md` | Documentation détaillée des 8 outils |
| `docs/mcp-sse.md` | Documentation du transport SSE |
