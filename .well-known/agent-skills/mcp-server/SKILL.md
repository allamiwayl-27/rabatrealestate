# MCP Server — Real Estate Capitale

Discover and use the Real Estate Capitale MCP server for property search, valuation, and market data in Rabat, Salé, and Témara.

## Server Card

Fetch the MCP Server Card:

    GET /.well-known/mcp/server-card.json

## Transport

Streamable HTTP at `https://realestatecapitale.ma/mcp`.

## Tools

- `search_listings` — Search properties by quartier, budget, type, surface
- `estimate_property` — Estimate property value by quartier and surface
- `get_market_trends` — Get price trends over time
- `get_quartier_stats` — Get aggregated stats per quartier
- `get_listing_detail` — Get full listing details by ID
- `contact_agent` — Send a message to an agent
