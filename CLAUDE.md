# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## User instruction
"After building or adding new features, always run the tests and check the logs until every new function and feature works properly. Update both README.md and CLAUDE.md."

## What this is

`arc6ai_doc_extract` is a standalone document intelligence skill in the Arc6AI suite. It exposes a REST endpoint (`POST /extract`) that accepts a file upload and returns structured extracted data.

It uses a **Judge-Router pipeline**:
1. Try cheap text extraction (unpdf, mammoth, SheetJS)
2. Score quality with a fast gpt-4o-mini judge (heuristics first, LLM only if needed)
3. Escalate to gpt-4o vision only if quality is low

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
│   ├── index.ts   # Format detection + routing
│   ├── pdf.ts     # unpdf — edge-compatible WebAssembly pdf.js
│   ├── docx.ts    # mammoth
│   └── xlsx.ts    # SheetJS
├── judge/
│   └── index.ts   # Heuristic checks + gpt-4o-mini quality scoring
│                  # Returns: { quality, escalate, reason }
├── vision/
│   └── index.ts   # gpt-4o vision fallback for low-quality extractions
├── orchestrator/
│   └── index.ts   # Pipeline runner: extract → judge → route → structure
├── server.ts      # Hono + @hono/node-server — local Node.js dev only
└── worker.ts      # Hono default export — Cloudflare Workers entry point
```

## API

```
POST /extract
Content-Type: multipart/form-data

Fields:
  file    (required) — PDF, DOCX, XLSX, CSV, or TXT
  schema  (optional) — JSON array of field names, e.g. ["vendor","total","date"]

Response:
{
  result:     object | string,   // structured fields (if schema) or raw text
  method:     "text" | "vision",
  escalated:  boolean,
  confidence: "high" | "low",
  reason?:    string             // judge explanation when escalated
  format:     string             // detected file format
}

GET /health → { status: "ok", service: "arc6ai_doc_extract" }
```

## Environment

```
OPENAI_API_KEY=sk-...   # required (Worker secret on CF, .env locally)
PORT=3001               # optional, local dev only
```

## Key design decisions

- **unpdf instead of pdf-parse** — `pdf-parse` uses `fs.readFileSync` at load time and `createRequire` at module level, both of which fail on Cloudflare Workers edge runtime. `unpdf` uses WebAssembly (pdf.js compiled to WASM) and is fully edge-compatible.
- **Two entry points** — `server.ts` for local Node.js dev, `worker.ts` for CF Workers. Same orchestrator, same pipeline — only the HTTP server wrapper differs.
- **Judge runs heuristics first** — catches image-only PDFs and garbled encodings instantly with no API call. LLM judge only runs if heuristics pass.
- **gpt-4o only for vision escalation** — gpt-4o-mini handles all other LLM calls (judge + structuring). Keeps cost low.
- **Schema is optional** — without schema returns full extracted text; with schema returns a typed JSON object.
- **CORS enabled** — `worker.ts` includes Hono's `cors()` middleware so the arc6ai.com website can call it directly from the browser.

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
