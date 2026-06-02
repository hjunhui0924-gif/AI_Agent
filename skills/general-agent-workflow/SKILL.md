---
name: general-agent-workflow
description: Build or extend the AI_Agent project as a general-purpose chat assistant with file upload, document-aware answering, optional web search, and MCP-exposed tools. Use when Codex needs to modify the app's agent workflow, attachment parsing, search behavior, MCP server, or related frontend chat experience.
---

# General Agent Workflow

## Overview

Use this skill when working on the local `AI_Agent` project as a general assistant rather than a vertical domain bot.

Preserve these product principles:

1. Keep the UI close to a modern chat workspace: lightweight, file-friendly, and fast to send.
2. Treat uploaded files as first-class context. Prefer extracting readable text and passing it to the model with clear file labels.
3. Make web search explicit. The model should only search when the user enabled it and the question is time-sensitive or externally factual.
4. Keep MCP tools aligned with the app's own backend capabilities so external clients and the web UI do not drift apart.

## Workflow

### 1. Understand the change surface

Before editing, inspect these files first:

- `app.py`: request/response layer and streaming chat endpoint
- `agents/agent.py`: prompt, tools, persistence, and chat orchestration
- `utils/file_utils.py`: supported file formats and extraction limits
- `static/index.html`, `static/main.js`, `static/style.css`: chat UI
- `mcp_server/server.py`: tools exposed through MCP

### 2. Keep prompt construction explicit

When changing the agent:

- Keep user-visible text separate from internal attachment/search context markers.
- Preserve clean history rendering by stripping internal sections before returning chat history to the frontend.
- If you add new hidden context sections, update both prompt construction and history parsing together.

### 3. Add file support carefully

If adding a new file type:

- Update `utils/file_utils.py`
- Add the extension to both backend support and frontend `accept`
- Cap extracted text to avoid blowing up token usage
- Prefer returning a limitation note over pretending parsing succeeded

Read [references/file-support.md](references/file-support.md) before expanding parser behavior.

### 4. Keep search optional

If adjusting search behavior:

- Do not silently force search on
- Keep the search toggle state visible in the UI
- Use the same underlying search helper for both the app agent and the MCP server where possible

### 5. Keep MCP in sync

If you add or rename a core backend capability, decide whether it should also appear in `mcp_server/server.py`.

Read [references/architecture.md](references/architecture.md) before larger refactors.
