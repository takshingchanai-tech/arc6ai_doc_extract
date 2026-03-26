# arc6ai_doc_extract

**Document Intelligence skill** — part of the [Arc6AI](https://arc6ai.com) agent suite.

Extracts and formats the full content of documents as clean Markdown using a cost-optimised Judge-Router pipeline. Supports 13 file formats. Vision escalation is delegated to `arc6ai_visual_intelligence`.

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
     └── quality: low   ──▶  arc6ai_visual_intelligence/analyze  ──▶  formatAsMarkdown  ──▶  return ✓
```

90%+ of documents hit the cheap text path. Vision is only triggered when the judge flags low quality on PDF/image formats. Vision calls are delegated to `arc6ai_visual_intelligence` — no duplicated vision logic.

## Supported formats

| Format | Extractor |
|---|---|
| PDF (text layer) | unpdf (WebAssembly pdf.js, edge-compatible) |
| PDF (scanned/image) | arc6ai_visual_intelligence (vision, auto-escalated by judge) |
| Word `.docx` | mammoth |
| Excel `.xlsx` / `.xls` | SheetJS |
| PowerPoint `.pptx` | fflate (unzip + XML) |
| OpenDocument `.odt` / `.ods` / `.odp` | fflate (unzip + XML) |
| CSV | raw text |
| Plain text `.txt` | raw text |
| JSON | pretty-printed raw |
| Markdown `.md` | raw text |

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

**Response:**

```json
{
  "content": "# Q3 Revenue Report\n\n## Executive Summary\n\nRevenue grew 24% YoY...",
  "method": "text",
  "escalated": false,
  "confidence": "high",
  "format": "pdf"
}
```

If the judge detects low quality (e.g. scanned PDF), it auto-escalates to vision via `arc6ai_visual_intelligence`:

```json
{
  "content": "# Invoice\n\n| Field | Value |\n|---|---|\n| Vendor | Acme Corp |...",
  "method": "vision",
  "escalated": true,
  "confidence": "low",
  "reason": "Extracted text too short for file size — likely image-only PDF",
  "format": "pdf"
}
```

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

The project ships with `wrangler.toml` and a dedicated `src/worker.ts` entry point. No changes needed — just set your secret and deploy.

```bash
# Set your OpenAI key as a Worker secret
wrangler secret put OPENAI_API_KEY

# Deploy
npm run deploy
```

Or connect the GitHub repo to Cloudflare Workers CI/CD:
- **Build command:** `npm run build`
- **Deploy command:** `npx wrangler deploy`

The worker runs on the CF edge with `nodejs_compat` enabled. `unpdf` uses WebAssembly under the hood so it works without Node.js `fs`.

## Entry points

| File | Purpose |
|---|---|
| `src/server.ts` | Local Node.js dev server (`npm run dev`) |
| `src/worker.ts` | Cloudflare Workers entry (`npm run deploy`) |

## Part of the Arc6AI suite

| Skill | Description |
|---|---|
| **arc6ai_doc_extract** | Extract data from documents |
| arc6ai_web_search | Search the web and synthesise answers |
| arc6ai_structured_output | Convert text to JSON / CSV |
| arc6ai_data_analysis | Surface trends from datasets |
| arc6ai_visual_intelligence | Interpret charts and images |
| arc6ai_app_integration | Call CRM / ERP / email APIs |
| arc6ai_computer_control | Browser and screen automation |
| arc6ai_invoice_processing | Invoice extraction pipeline |
