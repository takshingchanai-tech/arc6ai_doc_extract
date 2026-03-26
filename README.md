# arc6ai_doc_extract

**Document Intelligence skill** — part of the [Arc6AI](https://arc6ai.com) agent suite.

Extracts and formats the full content of documents as clean Markdown using a cost-optimised Judge-Router pipeline. Supports 12 file formats. Fully standalone — does not call any other skill.

## How it works

```
Incoming file
     │
     ▼
[Extractor]  unpdf / mammoth / SheetJS / fflate  (near-zero cost)
     │
     ▼
[Judge]      gpt-4o-mini quality scoring  (heuristics first, LLM if needed)
     │
     ├── quality: high  ──▶  formatAsMarkdown (gpt-4o-mini, chunked)  ──▶  return ✓
     │
     └── quality: low   ──▶  return suggestion: "use Visual Intelligence skill"
```

90%+ of documents hit the cheap text path. When a scanned or image-only document is detected, the skill returns a clear message instead of attempting to process it — keeping each skill focused on what it does best. Cross-skill chaining belongs in an orchestrator layer.

## Supported formats

| Format | Extractor |
|---|---|
| PDF (text layer) | unpdf (WebAssembly pdf.js, edge-compatible) |
| Word `.docx` | mammoth |
| Excel `.xlsx` / `.xls` | SheetJS |
| PowerPoint `.pptx` | fflate (unzip + XML) |
| OpenDocument `.odt` / `.ods` / `.odp` | fflate (unzip + XML) |
| CSV | raw text |
| Plain text `.txt` | raw text |
| JSON | pretty-printed raw |
| Markdown `.md` | raw text |

Scanned / image-only PDFs are detected by the judge and return a `suggestion: "visual-intelligence"` response — no extraction attempted.

## Quick start

```bash
git clone https://github.com/takshingchanai-tech/arc6ai_doc_extract.git
cd arc6ai_doc_extract
npm install
cp .env.example .env      # add your OPENAI_API_KEY
npm run dev               # http://localhost:3001
```

## API

### `POST /extract`

Upload a file. Returns full content formatted as Markdown — no information lost.

```bash
# Extract a PDF
curl -X POST http://localhost:3001/extract \
  -F "file=@report.pdf"

# Extract a spreadsheet
curl -X POST http://localhost:3001/extract \
  -F "file=@data.xlsx"
```

**Successful extraction:**

```json
{
  "content": "# Q3 Revenue Report\n\n## Executive Summary\n\nRevenue grew 24% YoY...",
  "method": "text",
  "confidence": "high",
  "format": "pdf"
}
```

**Scanned / image-only document (low quality detected by judge):**

```json
{
  "content": "This document appears to be a scanned or image-only PDF. No readable text layer was found.\n\nTo extract content from this document, please use the Visual Intelligence skill.",
  "method": "text",
  "confidence": "low",
  "reason": "Extracted text too short for file size — likely image-only PDF",
  "format": "pdf",
  "suggestion": "visual-intelligence"
}
```

The caller (website, orchestrator, or API client) decides what to do with the suggestion — this skill does not call visual-intelligence itself.

### `GET /health`

```json
{ "status": "ok", "service": "arc6ai_doc_extract" }
```

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENAI_API_KEY` | Yes | — | OpenAI API key |
| `PORT` | No | `3001` | HTTP port (local dev only) |

## Deployment on Cloudflare Workers

```bash
# Set your OpenAI key as a Worker secret
wrangler secret put OPENAI_API_KEY

# Deploy
npm run deploy
```

Or connect the GitHub repo to Cloudflare Workers CI/CD:
- **Build command:** `npm run build`
- **Deploy command:** `npx wrangler deploy`

## Entry points

| File | Purpose |
|---|---|
| `src/server.ts` | Local Node.js dev server (`npm run dev`) |
| `src/worker.ts` | Cloudflare Workers entry (`npm run deploy`) |

## Part of the Arc6AI suite

Each skill is an independent service. Cross-skill orchestration is handled by a separate orchestrator layer.

| Skill | Description |
|---|---|
| **arc6ai_doc_extract** | Extract text from documents (PDF, DOCX, XLSX, PPTX, etc.) |
| arc6ai_visual_intelligence | Interpret images, charts, and scanned documents via GPT-4o Vision |
| arc6ai_web_search | Search the web and synthesise answers |
| arc6ai_structured_output | Convert text to JSON / CSV |
| arc6ai_data_analysis | Surface trends from datasets |
| arc6ai_app_integration | Call CRM / ERP / email APIs |
| arc6ai_computer_control | Browser and screen automation |
| arc6ai_invoice_processing | Invoice extraction pipeline |
