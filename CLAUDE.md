# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## User instruction
"After building or adding new features, always run the tests and check the logs until every new function and feature works properly. Update both README.md and CLAUDE.md."

## What this is

`arc6ai_doc_extract` is a standalone document intelligence skill in the Arc6AI suite. It exposes a single REST endpoint (`POST /extract`) that accepts a file upload and returns structured extracted data.

It uses a **Judge-Router pipeline**:
1. Try cheap text extraction (pdf-parse, mammoth, SheetJS)
2. Score quality with a fast gpt-4o-mini judge
3. Escalate to gpt-4o vision only if quality is low

## Commands

```bash
npm run dev        # start dev server at http://localhost:3001 (tsx watch)
npm run build      # TypeScript type check — zero errors = passing
npm run start      # production start
```

## Architecture

```
src/
├── extractor/     # Format-specific text extractors
│   ├── index.ts   # Format detection + routing
│   ├── pdf.ts     # pdf-parse (CJS via createRequire)
│   ├── docx.ts    # mammoth
│   └── xlsx.ts    # SheetJS
├── judge/
│   └── index.ts   # Heuristic + gpt-4o-mini quality scoring
├── vision/
│   └── index.ts   # gpt-4o vision fallback for low-quality extractions
├── orchestrator/
│   └── index.ts   # Pipeline runner: extract → judge → route → structure
└── server.ts      # Hono HTTP server
```

## API

```
POST /extract
Content-Type: multipart/form-data

Fields:
  file    (required) — PDF, DOCX, XLSX, CSV, or TXT
  schema  (optional) — JSON array of field names to extract, e.g. ["vendor","total","date"]

Response:
{
  result:     object | string,   // extracted fields or raw text
  method:     "text" | "vision",
  escalated:  boolean,
  confidence: "high" | "low",
  reason?:    string             // judge explanation if escalated
  format:     string             // detected file format
}

GET /health → { status: "ok", service: "arc6ai_doc_extract" }
```

## Environment

```
OPENAI_API_KEY=sk-...   # required
PORT=3001               # optional, default 3001
```

## Key design decisions

- **pdf-parse** is a CJS module — import via `createRequire(import.meta.url)` to work in ESM
- **Judge runs heuristics first** (free) before making an LLM call — catches image-only PDFs instantly
- **gpt-4o only for vision escalation** — gpt-4o-mini handles all other LLM calls
- **Schema is optional** — without it, returns full extracted text; with it, returns a JSON object

## Deployment

Designed to be deployed as a **Cloudflare Worker** (via `@cloudflare/next-on-pages` or Hono's Cloudflare adapter). The Hono framework is edge-compatible — swap `@hono/node-server` for the Cloudflare adapter when deploying.
