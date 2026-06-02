---
name: entity-normalizer
description: Normalize user-provided names, places, stock symbols, and shorthand references in AI_Agent before calling APIs or web search. Use when Codex needs to improve recognition of aliases, abbreviations, region names, stock identifiers, or other ambiguous entities.
---

# Entity Normalizer

## Targets

- City names and districts
- Stock names and codes
- Index aliases
- Product and company aliases

## Workflow

1. Detect whether the entity is already canonical.
2. Expand shorthand to a canonical form.
3. Preserve the user-facing form for display.
4. Use the canonical form for tools and APIs.

## Examples

- “上证” -> “上证指数”
- “sh601009” stays unchanged
- “南京银” -> “南京银行” if confidence is high
- “浦东” -> normalized city/district context before weather or map queries
