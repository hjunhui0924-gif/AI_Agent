---
name: document-rag-workflow
description: Improve file understanding in AI_Agent for PDFs, Word, Excel, CSV, and text documents using extraction, chunking, relevant-snippet selection, and grounded answer generation. Use when Codex needs to strengthen document parsing quality, chunking strategy, retrieval behavior, or source attribution from uploaded files.
---

# Document RAG Workflow

## Workflow

1. Extract clean text from uploaded files.
2. Preserve structural markers:
   - page markers
   - sheet names
   - table sections
3. Chunk content into bounded spans.
4. Rank chunks against the active user question.
5. Feed the most relevant chunks to the model.
6. Prefer answers that mention:
   - file name
   - page
   - sheet
   - chunk label

## Improvement Priorities

- Better PDF page preservation
- Better DOCX table extraction
- Better Excel row/column summaries
- Better long-document chunk ranking

## Guardrails

- If extraction is weak, say so.
- If the answer depends on missing pages or images, say so.
