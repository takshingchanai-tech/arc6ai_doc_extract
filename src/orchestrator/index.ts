import OpenAI from 'openai'
import { extract } from '../extractor/index.js'
import { judge } from '../judge/index.js'
import { extractWithVision } from '../vision/index.js'

// Only these formats can be re-processed by the vision model
const VISION_COMPATIBLE = new Set(['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp'])

export interface ExtractionRequest {
  buffer: Buffer
  filename: string
  mimetype?: string
}

export interface ExtractionResponse {
  content: string          // full extracted content formatted as Markdown
  method: 'text' | 'vision'
  escalated: boolean
  confidence: 'high' | 'low'
  reason?: string
  format: string
}

async function formatAsMarkdown(client: OpenAI, text: string, filename: string): Promise<string> {
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    max_tokens: 4000,
    messages: [
      {
        role: 'system',
        content: `You are a document formatter. Format the following extracted document content as clean, well-structured Markdown.

Rules:
- Preserve ALL content — do not summarise, omit, or analyse anything
- Add clear structure: use # for the document title, ## for sections, bullet points for lists, and | tables | for tabular data
- Clean up redundant whitespace and OCR artifacts but keep all words
- For spreadsheets/CSV: render data as Markdown tables
- For presentations: use ## Slide N as headers
- Do not add commentary, interpretation, or analysis
- Output only the formatted Markdown, nothing else`
      },
      {
        role: 'user',
        content: `Filename: ${filename}\n\n${text.slice(0, 12000)}`
      }
    ]
  })

  return response.choices[0].message.content ?? text
}

export async function run(req: ExtractionRequest): Promise<ExtractionResponse> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  let rawText: string
  let format: string
  let escalated = false
  let method: 'text' | 'vision' = 'text'
  let judgeReason: string | undefined

  try {
    // Step 1: Cheap text extraction
    const extracted = await extract(req.buffer, req.filename, req.mimetype)
    rawText = extracted.text
    format = extracted.format

    // Step 2: Judge quality — only escalate if format supports vision
    if (VISION_COMPATIBLE.has(format)) {
      const verdict = await judge(client, rawText, extracted.sizeBytes)
      if (verdict.escalate) {
        escalated = true
        judgeReason = verdict.reason
        rawText = await extractWithVision(client, req.buffer, req.filename)
        method = 'vision'
      }
    }

    // Step 3: Format full content as clean Markdown (no information loss)
    const content = await formatAsMarkdown(client, rawText, req.filename)

    return { content, method, escalated, confidence: escalated ? 'low' : 'high', reason: judgeReason, format }

  } catch (err) {
    // Text extraction failed — try vision only if format supports it
    const ext = req.filename.split('.').pop()?.toLowerCase() ?? 'unknown'
    if (!VISION_COMPATIBLE.has(ext)) {
      throw new Error(`Extraction failed: ${(err as Error).message}`)
    }
    try {
      rawText = await extractWithVision(client, req.buffer, req.filename)
      const content = await formatAsMarkdown(client, rawText, req.filename)
      return {
        content,
        method: 'vision',
        escalated: true,
        confidence: 'low',
        reason: `Text extraction failed: ${(err as Error).message}`,
        format: ext
      }
    } catch (visionErr) {
      throw new Error(`All extraction methods failed. Last error: ${(visionErr as Error).message}`)
    }
  }
}
