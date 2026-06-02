---
name: citation-answering
description: Produce grounded answers in AI_Agent that include source links, date clues, and confidence framing without exposing private reasoning. Use when Codex needs to improve how answers cite web results, tool outputs, document chunks, or any external evidence.
---

# Citation Answering

## Rules

1. Attach source links whenever the answer uses external data.
2. Mention explicit dates when sources contain them.
3. If multiple sources disagree, say so.
4. If data may be stale, say so before giving the answer.
5. Keep citations readable:
   - title
   - date clue
   - short summary

## Do Not

- Do not fabricate source dates.
- Do not hide uncertainty when evidence is weak.
- Do not present search snippets as if they were verified primary facts unless corroborated.
