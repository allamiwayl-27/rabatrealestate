# Real Estate Capitale — MCP Server

MCP server for real estate search, property valuation, market analysis, and lead management in Rabat, Salé, and Témara, Morocco.

## Quick Start

```bash
# Install
npm install

# Set database URL
cp .env.example .env
# Edit .env with your PostgreSQL connection string

# Start stdio server (for Claude Desktop, opencode, Cursor)
npm start

# Or start HTTP/SSE server
npm start:http
```

## 17 Tools

| Tool | Description |
|------|-------------|
| `search_listings` | Search properties with filters (type, location, budget, surface, rooms) |
| `get_listing` | Get full listing details by ID |
| `estimate_property` | Estimate property value by quartier and surface |
| `get_market_trends` | Price trends over time by quartier |
| `get_quartier_stats` | Aggregated stats per quartier (price/m², count) |
| `list_quartiers` | List all available quartiers |
| `list_villes` | List all available cities |
| `create_lead` | Create a lead (contact client) |
| `get_comparables` | Find similar listings for valuation |
| `get_investor_alerts` | Identify undervalued properties |
| `get_price_analytics` | Price/m² analysis with distribution |
| `get_rental_yield` | Rental yield by quartier |
| `get_market_predictions` | 90-day price predictions |
| `get_quartier_comparison` | Compare two quartiers side-by-side |
| `get_suspicious_listings` | Detect outlier pricing |
| `get_liquidity` | Market liquidity index |
| `get_agency_leaderboard` | Agency ranking by volume |

## Transports

### stdio (local)

```bash
node bin/mcp-server
```

For Claude Desktop, opencode, Cursor — reads JSON-RPC from stdin, writes to stdout.

### HTTP/SSE (remote)

```bash
node bin/mcp-server-http
# Listens on port 3001
```

Endpoints:
- `GET /` — Server info (Streamable HTTP discovery)
- `POST /` — Synchronous JSON-RPC
- `GET /sse` — SSE stream
- `POST /messages?sessionId=...` — SSE session messages
- `GET /health` — Health check

## Configuration

### Claude Desktop

Copy `config/claude-desktop.json` to your Claude Desktop MCP config, or add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "realestatecapitale": {
      "command": "node",
      "args": ["/path/to/rabatrealestate/bin/mcp-server"],
      "env": {
        "DATABASE_URL": "postgresql://user:pass@localhost:5432/mubawab"
      }
    }
  }
}
```

### opencode

```json
{
  "mcp": {
    "realestatecapitale": {
      "type": "local",
      "command": ["node", "bin/mcp-server"],
      "env": { "DATABASE_URL": "..." }
    }
  }
}
```

### Remote (HTTP)

```json
{
  "mcp": {
    "realestatecapitale": {
      "type": "remote",
      "url": "https://realestatecapitale.ma/mcp"
    }
  }
}
```

## Query Tool

```bash
# List tools
node bin/query "tools/list"

# Call a tool
node bin/query 'tools/call {"name":"list_villes","arguments":{}}'

# Query remote server
MCP_URL=https://realestatecapitale.ma/mcp node bin/query "tools/list"
```

## Testing

```bash
npm test
```

## Architecture

```
┌─────────────┐     stdio      ┌──────────────┐
│ Claude Desktop│ ◄──────────── │ bin/mcp-server│
│ opencode     │               │ (stdio)       │
└─────────────┘               └──────┬───────┘
                                      │
┌─────────────┐     HTTP/SSE  ┌──────┴───────┐
│ Remote AI   │ ◄──────────── │ bin/mcp-     │
│ clients     │               │ server-http  │
└─────────────┘               │ (port 3001)  │
                              └──────┬───────┘
                                     │
                              ┌──────┴───────┐
                              │ src/core/     │
                              │ mcp-core.js   │
                              │ (17 tools)    │
                              └──────┬───────┘
                                     │
                              ┌──────┴───────┐
                              │ PostgreSQL    │
                              │ (mubawab)     │
                              └──────────────┘
```

## License

MIT
