# MCP over HTTP/SSE — Real Estate Capitale

Transport HTTP+SSE (Server-Sent Events) du protocole MCP pour permettre aux clients IA distants (Claude, opencode, assistants personnalisés) d'interroger la base immobilière sans exécution locale.

---

## Architecture

```
┌─────────────┐     SSE (GET /sse)     ┌──────────────────┐     TCP      ┌────────────┐
│ Client IA   │ ◄───────────────────── │ mcp-server-      │────────────►│ PostgreSQL │
│ (Claude,    │     POST /messages     │ http.js :3001    │             │  mubawab   │
│  opencode,  │ ─────────────────────► │                  │             └────────────┘
│  curl, ...) │                        └──────────────────┘
└─────────────┘                               │
                                        ┌─────┴──────┐
                                        │ mcp-core.js │
                                        │ (logique    │
                                        │  partagée)  │
                                        └─────────────┘
```

Le serveur expose le même ensemble de 8 outils MCP que le transport stdio (`mcp-server.js`), mais via HTTP avec SSE pour la réponse asynchrone.

**Fichiers :**

| Fichier | Rôle |
|---------|------|
| `mcp-core.js` | Logique partagée : TOOLS, HANDLERS, DB, `handleRequest()` |
| `mcp-server.js` | Transport stdio (thin wrapper, ~40 lignes) |
| `mcp-server-http.js` | Transport HTTP/SSE (session management, endpoints) |

---

## Protocole SSE

Le transport MCP over SSE suit le draft du protocole MCP :

1. **Connexion** : le client ouvre `GET /sse`, le serveur maintient la connexion ouverte
2. **Endpoint** : le serveur envoie `event: endpoint` avec l'URL de session
3. **Requêtes** : le client envoie des messages JSON-RPC via `POST /messages?sessionId=xxx`
4. **Réponses** : le serveur répond via SSE sur la connexion persistante (`event: message`)

### Séquence

```mermaid
sequenceDiagram
    participant Client
    participant Serveur HTTP/SSE
    participant DB (PostgreSQL)

    Client->>Serveur: GET /sse
    Serveur-->>Client: HTTP 200, text/event-stream
    Serveur-->>Client: event: endpoint
    Note over Client: data: {"endpoint": "/messages?sessionId=xxx"}

    Client->>Serveur: POST /messages?sessionId=xxx
    Note over Client: {"jsonrpc":"2.0","id":1,"method":"tools/list"}
    Serveur-->>Client: HTTP 202 (accepted)
    Serveur->>DB (PostgreSQL): requête SQL
    DB (PostgreSQL)-->>Serveur: résultats
    Serveur-->>Client: event: message
    Note over Client: data: {"jsonrpc":"2.0","id":1,"result":{...}}
```

---

## Endpoints HTTP

### `GET /health`

**Description :** Healthcheck du serveur.

**Réponse :**
```json
{
  "status": "ok",
  "uptime": 123.45,
  "sessions": 2
}
```

### `GET /sse`

**Description :** Connexion SSE persistante. Le client reçoit d'abord l'événement `endpoint` contenant l'URL de session pour les requêtes.

**Headers :**
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

**Événements reçus :**
```
event: endpoint
data: {"endpoint":"/messages?sessionId=550e8400-e29b-41d4-a716-446655440000"}

: heartbeat

event: message
data: {"jsonrpc":"2.0","id":1,"result":{"tools":[...]}}
```

**Heartbeat :** le serveur envoie un commentaire (`: heartbeat`) toutes les 15 secondes pour maintenir la connexion active.

### `POST /messages`

**Description :** Envoi d'une requête JSON-RPC au serveur MCP.

**Paramètres (query string) :**
| Paramètre | Type | Requis | Description |
|-----------|------|--------|-------------|
| `sessionId` | `string` | Oui | ID de session reçu via SSE |

**Headers :**
```
Content-Type: application/json
```

**Body :**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list"
}
```

**Réponse immédiate :** `HTTP 202 Accepted`
```json
{ "accepted": true }
```

**Réponse différée :** le résultat est envoyé ultérieurement via SSE (`event: message`).

---

## Sessions

### Cycle de vie

1. **Création** : à l'ouverture de `GET /sse`, une session est créée avec un UUID aléatoire
2. **Activité** : `lastSeen` est mis à jour à chaque `POST /messages`
3. **Expiration** : nettoyage toutes les 5 minutes des sessions inactives depuis 10 minutes
4. **Fermeture** : à la déconnexion du client (fermeture SSE), la session est supprimée

### Gestion mémoire

Les sessions sont stockées dans un `Map` côté serveur. Chaque session contient :
- `res` — la réponse HTTP SSE (pour envoyer les événements)
- `lastSeen` — timestamp Unix de la dernière activité

---

## 8 outils MCP exposés

Les mêmes outils que le transport stdio :

| Tool | Description |
|------|-------------|
| `search_listings` | Recherche avec filtres (transaction, localisation, budget, surface, pièces, mot-clé, tri, pagination) |
| `get_listing` | Détail complet d'un bien par ID |
| `estimate_property` | Estimation de prix via procédure stockée (prix m², fourchette basse/haute) |
| `get_market_trends` | Tendances par quartier (variation sur N mois) |
| `get_quartier_stats` | Statistiques agrégées (prix m² moyen, fourchette, nb annonces) |
| `list_quartiers` | Liste des quartiers disponibles |
| `list_villes` | Liste des villes disponibles |
| `create_lead` | Création d'un lead client |

Voir [`mcp-tools.md`](./mcp-tools.md) pour le détail de chaque tool (paramètres, retours, SQL).

---

## Intégration dans différents clients

### Claude Desktop (transport HTTP)

*Non supporté nativement — Claude Desktop utilise uniquement le transport stdio.*
Pour Claude Desktop, utiliser `mcp-server.js` avec la config stdio :

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

### opencode (transport HTTP)

Config dans `.opencode/mcp.json` ou `opencode.json` :

```json
{
  "mcp": {
    "realestatecapitale": {
      "type": "http",
      "url": "http://localhost:3001",
      "enabled": true
    }
  }
}
```

### Client HTTP personnalisé (curl)

```bash
# 1. Ouvrir connexion SSE en arrière-plan
curl -s -N http://localhost:3001/sse &

# 2. Récupérer le sessionId depuis l'événement endpoint, puis :
curl -s -X POST "http://localhost:3001/messages?sessionId=xxx" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# 3. La réponse arrive sur la connexion SSE
```

### Client JavaScript (Node.js)

```javascript
const http = require('http');

async function connectMCP() {
  // 1. SSE
  const sse = await new Promise(resolve => {
    http.get('http://localhost:3001/sse', res => {
      let buf = '';
      res.on('data', chunk => {
        buf += chunk.toString();
        const m = buf.match(/event: endpoint\s*\n\s*data:\s*({[^}]+})/);
        if (m) resolve({ res, endpoint: JSON.parse(m[1]).endpoint });
      });
    });
  });

  const sessionId = new URLSearchParams(sse.endpoint.split('?')[1]).get('sessionId');

  // 2. Écouter les réponses SSE
  sse.res.on('data', chunk => {
    const lines = chunk.toString().split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const msg = JSON.parse(line.slice(6));
        if (msg.result) console.log('Résultat:', msg.result);
      }
    }
  });

  // 3. Envoyer une requête
  const send = (msg) => {
    return new Promise(resolve => {
      const req = http.request(`http://localhost:3001/messages?sessionId=${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }, resolve);
      req.write(JSON.stringify(msg));
      req.end();
    });
  };

  await send({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
  await send({ jsonrpc: '2.0', id: 2, method: 'tools/call',
    params: { name: 'list_villes', arguments: {} } });

  return sse;
}
```

---

## Déploiement

### Démarrer le serveur

```powershell
# Port par défaut 3001
node mcp-server-http.js

# Port personnalisé
$env:PORT = 4000; node mcp-server-http.js
```

### Variables d'environnement

| Variable | Défaut | Description |
|----------|--------|-------------|
| `PORT` | `3001` | Port d'écoute HTTP |
| `DATABASE_URL` | — | URL de connexion PostgreSQL |

### npm scripts

```json
{
  "start:mcp": "node mcp-server.js",
  "start:mcp:http": "node mcp-server-http.js"
}
```

```powershell
npm run start:mcp:http
```

---

## Tests

### Test automatisé (9 tests)

```powershell
# Prérequis : serveur MCP HTTP en cours d'exécution
# npm run start:mcp:http (dans un autre terminal)

node tests/test-mcp-http.js
```

Ce script teste :
1. Healthcheck (`GET /health`)
2. 404 sur route inconnue
3. Connexion SSE et réception de l'endpoint
4. Requête JSON-RPC via POST + réponse SSE
5. Session invalide (404)
6. Sessions multiples
7. Compteur de sessions dans le healthcheck

### Tests du transport stdio (8 tests)

```powershell
node tests/test-mcp.js
```

---

## Sécurité

- **CORS** : `Access-Control-Allow-Origin: *` (à restreindre en production)
- **Nettoyage** : sessions inactives supprimées après 10 minutes
- **Pas d'authentification** : le serveur est conçu pour un usage LAN/local. En production, ajouter un proxy (nginx, Cloudflare Tunnel) avec authentification.

### Reverse proxy (nginx)

```nginx
location /mcp/ {
  proxy_pass http://127.0.0.1:3001/;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_buffering off;
  proxy_cache off;
  chunked_transfer_encoding on;
}
```

---

## Comparaison stdio vs SSE

| Critère | stdio (`mcp-server.js`) | SSE (`mcp-server-http.js`) |
|---------|------------------------|----------------------------|
| Usage | Client local (Claude Desktop) | Client distant (API, web) |
| Transport | stdin/stdout | HTTP + SSE |
| Sessions | 1 (monolithique) | Multiples (concurrentes) |
| Port | Aucun (pipe) | 3001 (configurable) |
| Connexion DB | Partagée (singleton) | Partagée (singleton) |
| Dépendances | Node.js + pg | Node.js + pg (0 module externe) |
| Tests | 8 tests | 9 tests |
| Fragilité | Aucune (process unique) | Heartbeat / timeout sessions |
