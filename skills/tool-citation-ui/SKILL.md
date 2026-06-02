---
name: tool-citation-ui
description: Improve AI_Agent UI patterns for tool summaries, source cards, side drawers, and step-by-step visible agent actions. Use when Codex needs to refine frontend presentation of searches, citations, activity panels, or tool outputs without exposing private chain-of-thought.
---

# Tool Citation UI

## Principles

1. Show observable actions, not private reasoning.
2. Surface source cards when tools return external data.
3. Use lightweight progressive disclosure:
   - inline summary first
   - side drawer for full result lists
4. Keep motion soft and short.

## Good UI Patterns

- Search summary chip or button in the message body
- Side drawer for result list details
- Step cards for visible agent actions
- Timestamp and source labels for time-sensitive data
