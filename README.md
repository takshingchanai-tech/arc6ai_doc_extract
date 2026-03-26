# arc6ai_doc_extract

**Document Intelligence skill** — part of the [Arc6AI](https://arc6ai.com) agent suite.

Extracts structured data from PDF, DOCX, XLSX, CSV, and TXT files using a cost-optimised Judge-Router pipeline.

## How it works

```
Incoming file
     │
     ▼
[Extractor]  unpdf / mammoth / SheetJS  (near-zero cost)
     │
     ▼
[Judge]      gpt-4o-mini quality scoring
     │
     ├── quality: high  ──▶  structure with gpt-4o-mini  ──▶  return ✓
     │
     └── quality: low   ──▶  gpt-4o vision re-extraction  ──▶  return ✓
```

90%+ of documents hit the cheap text path. Vision is only used when text extraction fails or quality is low.

## Supported formats

| Format | Method |
|---|---|
| PDF (text layer) | unpdf (edge-compatible, WebAssembly pdf.js) |
| PDF (scanned / image) | gpt-4o vision (auto-escalated by judge) |
| Word `.docx` | mammoth |
| Excel `.xlsx` | SheetJS |
| CSV | raw text |
| Plain text `.txt` | raw text |

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

Upload a file and optionally specify fields to extract.

```bash
# Extract everything from a PDF
curl -X POST http://localhost:3001/extract \
  -F "file=@invoice.pdf"

# Extract specific fields
curl -X POST http://localhost:3001/extract \
  -F "file=@invoice.pdf" \
  -F 'schema=["vendor","total","date","invoice_number"]'
```

**Response:**

```json
{
  "result": {
    "vendor": "Acme Corp",
    "total": "$1,250.00",
    "date": "2026-03-20",
    "invoice_number": "INV-0042"
  },
  "method": "text",
  "escalated": false,
  "confidence": "high",
  "format": "pdf"
}
```

If the judge detects low quality (e.g. scanned PDF), it auto-escalates to vision:

```json
{
  "result": { "vendor": "Acme Corp", "total": "$1,250.00" },
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
