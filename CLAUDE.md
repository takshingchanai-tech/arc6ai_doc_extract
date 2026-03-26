# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## User instruction
"After building or adding new features, always run the tests and check the logs until every new function and feature works properly. Update both README.md and CLAUDE.md."

## What this is

`arc6ai_doc_extract` is a **standalone** document intelligence skill in the Arc6AI suite. It exposes a REST endpoint (`POST /extract`) that accepts a file upload and returns the full document content formatted as clean Markdown.

It uses a **Judge-Router pipeline**:
1. Try cheap text extraction (unpdf, mammoth, SheetJS, fflate for PPTX/ODF)
2. Score quality with a fast gpt-4o-mini judge (heuristics first, LLM only if needed)
3. If quality is high → format as Markdown (gpt-4o-mini, chunked for large docs) → return
4. If quality is low (e.g. scanned/image PDF) → return a suggestion message telling the caller to use the Visual Intelligence skill

**This skill does not call any other skill.** It is fully self-contained. Cross-skill orchestration (e.g. chaining doc-extract → visual-intelligence) belongs in a separate orchestrator layer.

## Commands

```bash
npm run dev        # local dev server at http://localhost:3001 (tsx watch)
npm run build      # tsc type check + wrangler dry-run — zero errors = passing
npm run deploy     # deploy to Cloudflare Workers (requires wrangler login)
npm run start      # production Node.js start
```

## Architecture

```
src/
├── extractor/
│   ├── index.ts   # Format detection + routing (pdf/docx/xlsx/xls/csv/txt/json/md/pptx/odt/ods/odp)
│   ├── pdf.ts     # unpdf — edge-compatible WebAssembly pdf.js
│   ├── docx.ts    # mammoth (uses arrayBuffer option for CF Workers compat)
│   ├── xlsx.ts    # SheetJS (xlsx + xls)
│   ├── pptx.ts    # fflate unzip + ppt/slides XML parsing
│   └── odf.ts     # fflate unzip + content.xml parsing (ODT/ODS/ODP)
├── judge/
│   └── index.ts   # Heuristic checks + gpt-4o-mini quality scoring
│                  # Returns: { escalate, reason }
├── orchestrator/
│   └── index.ts   # Pipeline: extract → judge → formatAsMarkdown OR suggestion message
├── server.ts      # Hono + @hono/node-server — local Node.js dev only
└── worker.ts      # Hono default export — Cloudflare Workers entry point
```

## API

```
POST /extract
Content-Type: multipart/form-data

Fields:
  file    (required) — PDF, DOCX, XLSX, XLS, PPTX, ODT, ODS, ODP, CSV, TXT, JSON, MD

Response (success):
{
  content:    string,            // full document content formatted as Markdown
  method:     "text",
  confidence: "high",
  format:     string             // detected file format
}

Response (low quality — scanned/image document):
{
  content:    string,            // human-readable message explaining the issue
  method:     "text",
  confidence: "low",
  reason:     string,            // judge explanation
  format:     string,
  suggestion: "visual-intelligence"  // caller should use this skill instead
}

GET /health → { status: "ok", service: "arc6ai_doc_extract" }
```

## Environment

```
OPENAI_API_KEY=sk-...   # required (Worker secret on CF, .env locally)
PORT=3001               # optional, local dev only
```

## Key design decisions

- **Fully independent skill** — does not call any other skill. When a document requires vision (scanned PDF), the response includes `suggestion: "visual-intelligence"` so the caller or user can decide what to do next.
- **unpdf instead of pdf-parse** — `pdf-parse` uses `fs.readFileSync` at load time and `createRequire` at module level, both of which fail on Cloudflare Workers edge runtime. `unpdf` uses WebAssembly (pdf.js compiled to WASM) and is fully edge-compatible.
- **Two entry points** — `server.ts` for local Node.js dev, `worker.ts` for CF Workers. Same orchestrator, same pipeline — only the HTTP server wrapper differs.
- **Judge runs heuristics first** — catches image-only PDFs and garbled encodings instantly with no API call. LLM judge only runs if heuristics pass.
- **VISION_COMPATIBLE gate** — only PDF/PNG/JPG/JPEG/GIF/WEBP formats can trigger a suggestion. CSV, TXT, DOCX, XLSX, PPTX, ODF always use the text path.
- **Full Markdown output** — no schema/JSON. LLM's job is formatting only: preserve all content, add structure. Large documents are chunked (24k chars/chunk) and processed in parallel.
- **CORS enabled** — `worker.ts` includes Hono's `cors()` middleware so the arc6ai.com website can call it directly from the browser.
- **Orchestration is external** — if you need to chain doc-extract → visual-intelligence automatically, build an orchestrator layer that calls both skills. Do not add inter-skill HTTP calls inside this repo.

## Deployment

```bash
# Set secret (one-time)
wrangler secret put OPENAI_API_KEY

# Deploy
npm run deploy
```

wrangler.toml is already configured:
- `name`: `arc6ai-doc-extract`
- `main`: `src/worker.ts`
- `compatibility_flags`: `["nodejs_compat"]`
- `compatibility_date`: `2024-11-01`
