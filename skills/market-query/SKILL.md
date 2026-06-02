---
name: market-query
description: Handle stock, index, quote, and market questions in AI_Agent using the most reliable source first. Use when Codex needs to improve routing, parsing, presentation, or safeguards for HS stock snapshots, index queries, market data freshness, and web-search fallback behavior.
---

# Market Query

## Routing Priority

1. Dedicated stock/index API
2. Quote snapshot fallback
3. Web search as supplementary evidence

## Rules

- For 上证 / 深证指数 questions:
  Use dedicated index tools first.
- For known stock codes or names:
  Use dedicated stock snapshot first.
- For “today/current/latest” market questions:
  Show update time clearly.
- If a web result is older than the dedicated snapshot, treat it as context only.

## Answer Style

- Lead with latest price and update time.
- Then show change, change percentage, high, low, volume, amount.
- Mention when the answer comes from a snapshot rather than a search page.
