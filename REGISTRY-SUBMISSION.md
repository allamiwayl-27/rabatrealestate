# Registry Submissions — realestatecapitale/mcp

**Server:** ma.realestatecapitale/mcp
**Endpoint:** https://realestatecapitale.ma/mcp
**Tools:** 17 (search_listings, get_listing, estimate_property, create_lead, get_comparables, get_investor_alerts, get_price_analytics, get_rental_yield, get_market_predictions, get_quartier_comparison, get_suspicious_listings, get_liquidity, get_agency_leaderboard, + MCP meta tools)
**Protocol:** MCP 2025-03-26, Streamable HTTP
**A2A:** 0.3 compatible, 5 skills
**Agent Skills:** 3 skills (v0.2.0)
**WebMCP:** navigator.modelContext support
**isitagentready.com:** Level 5 — Agent-Native

---

## Step 0 — Update GitHub Repo

Go to: https://github.com/allamiwayl-27/rabatrealestate/settings

**Description:**
```
MCP server for real estate in Morocco — 17 tools for search, valuation, market analysis, and agent services. Level 5 Agent-Native.
```

**Topics (add these):**
```
mcp
model-context-protocol
real-estate
morocco
rabat
ai-agent
a2a
webmcp
property-search
```

---

## Step 1 — Official MCP Registry

**Repo:** https://github.com/modelcontextprotocol/registry
**File to add:** `servers/ma.realestatecapitale-mcp.json`

Content for the JSON file:
```json
{
  "name": "ma.realestatecapitale/mcp",
  "description": "MCP server for real estate search, property valuation, market analysis, and agent services in Rabat, Salé, and Témara, Morocco. 17 tools including search_listings, estimate_property, get_market_trends, get_investor_alerts, and lead management.",
  "homepage": "https://realestatecapitale.ma",
  "repository": {
    "type": "git",
    "url": "https://github.com/allamiwayl-27/rabatrealestate"
  },
  "version_detail": {
    "version": "1.0.0",
    "release_date": "2026-07-25"
  }
}
```

**Steps:**
1. Fork https://github.com/modelcontextprotocol/registry
2. Add the JSON file under `servers/ma.realestatecapitale-mcp.json`
3. Open PR with title: `Add ma.realestatecapitale/mcp — Real estate MCP server for Morocco`

---

## Step 2 — Smithery

**URL:** https://smithery.ai/new

**Fill in:**
- Server Name: `ma.realestatecapitale/mcp`
- Description: `MCP server for real estate search, valuation, and market analysis in Rabat, Morocco. 17 tools, Streamable HTTP.`
- GitHub URL: `https://github.com/allamiwayl-27/rabatrealestate`
- Endpoint URL: `https://realestatecapitale.ma/mcp`
- Transport: Streamable HTTP
- Auth: None required for discovery (initialize, tools/list work without auth)

---

## Step 3 — mcp.so

**Repo to PR:** https://github.com/chatmcp/mcpso

Add this line in README.md after the preview image section:
```markdown
- [ma.realestatecapitale/mcp](https://github.com/allamiwayl-27/rabatrealestate) — MCP server for real estate search, valuation, and market analysis in Rabat, Morocco with 17 tools.
```

---

## Step 4 — awesome-mcp-servers

**Repo to PR:** https://github.com/punkpeye/awesome-mcp-servers

Add under the **Real Estate** or **Data** section:
```markdown
- [ma.realestatecapitale/mcp](https://github.com/allamiwayl-27/rabatrealestate) - Real estate MCP server for Morocco. 17 tools: property search, valuation, market analysis, investor alerts, and lead management. Streamable HTTP.
```

---

## Step 5 — Glama (auto-index)

Glama auto-indexes GitHub repos with `mcp` topic. Once you add the topics in Step 0, Glama will pick it up within 24-48h. Check at: https://glama.ai/mcp/servers

---

## Step 6 — MCPFind

**URL:** https://mcpfind.org (submit via their form)

- Name: ma.realestatecapitale/mcp
- GitHub: https://github.com/allamiwayl-27/rabatrealestate
- Endpoint: https://realestatecapitale.ma/mcp
- Category: Real Estate / Data
- Description: MCP server for real estate in Morocco — search, valuation, market analysis, investor alerts, lead management.

---

## DNS-AID (pending)

DS record needs to be published at register.domains registrar for DNSSEC chain of trust.
Key Tag: 2371, Algorithm: 13 (ECDSAP256SHA256), Digest Type: 2 (SHA-256)
Digest: `B45584452AB422ACB8E2DB94CCC1FBB3B98220476C3F70C1160A0BD448E01FFE`

Contact register.domains support to add this DS record.
