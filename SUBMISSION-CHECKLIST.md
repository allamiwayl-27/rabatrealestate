# Manual Submission Checklist

## 1. GitHub Topics (enables Glama auto-index)
Go to: https://github.com/allamiwayl-27/rabatrealestate/settings
Set description: "MCP server for real estate in Morocco — 17 tools for search, valuation, and market analysis. Level 5 Agent-Native."
Add topics: mcp, model-context-protocol, real-estate, morocco, rabat, ai-agent, a2a, webmcp, property-search

## 2. Smithery
1. Go to https://smithery.ai/account/api-keys → create API key
2. Run in terminal:
   ```
   npx @smithery/cli@latest auth login
   npx @smithery/cli@latest mcp publish "https://realestatecapitale.ma/mcp" -n allamiwayl-27/rabatrealestate-mcp
   ```

## 3. mcp.so
Go to: https://mcp.so/submit
- GitHub URL: https://github.com/allamiwayl-27/rabatrealestate
- Description: Real estate MCP server for Morocco — search, valuation, market analysis, investor alerts, lead management. 17 tools.
- Tags: real-estate, morocco, property-search, valuation, market-analysis
- Category: Real Estate

## 4. awesome-mcp-servers PR
Fork https://github.com/punkpeye/awesome-mcp-servers
Add this line in the Real Estate section (alphabetically after pedra-ai):

```
- [allamiwayl-27/rabatrealestate](https://github.com/allamiwayl-27/rabatrealestate) - Real estate MCP server for Morocco. 17 tools: property search, valuation, market analysis, investor alerts, and lead management. Streamable HTTP.
```

## 5. DNS-AID (register.domains)
Contact register.domains support to add DS record:
- Key Tag: 2371
- Algorithm: 13 (ECDSAP256SHA256)
- Digest Type: 2 (SHA-256)
- Digest: B45584452AB422ACB8E2DB94CCC1FBB3B98220476C3F70C1160A0BD448E01FFE
