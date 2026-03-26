import OpenAI from 'openai'
import { extract } from '../extractor/index.js'
import { judge } from '../judge/index.js'

// Only these formats could theoretically benefit from vision — used to decide
// whether to return a "try visual-intelligence" suggestion
const VISION_COMPATIBLE = new Set(['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp'])

export interface ExtractionRequest {
  buffer: Buffer
  filename: string
  mimetype?: string
}

export interface ExtractionResponse {
  content: string           // full extracted content formatted as Markdown, or a guidance message
  method: 'text'
  confidence: 'high' | 'low'
  reason?: string           // judge explanation when confidence is low
  format: string
  suggestion?: 'visual-intelligence'  // set when the document needs vision to be processed
}

const CHUNK_SIZE = 24000   // chars per chunk (~6k tokens input)
const CHUNK_MAX_TOKENS = 8000  // max output tokens per chunk

function splitIntoChunks(text: string, size: number): string[] {
  const chunks: string[] = []
  let i = 0
  while (i < text.length) {
    let end = Math.min(i + size, text.length)
    if (end < text.length) {
      const lastNewline = text.lastIndexOf('\n', end)
      if (lastNewline > i + size * 0.7) end = lastNewline + 1
    }
    chunks.push(text.slice(i, end))
    i = end
  }
  return chunks
}

async function formatChunk(
  client: OpenAI,
  chunk: string,
  filename: string,
  chunkIndex: number,
  totalChunks: number
): Promise<string> {
  const isFirst = chunkIndex === 0
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    max_tokens: CHUNK_MAX_TOKENS,
    messages: [
      {
        role: 'system',
        content: `You are a document formatter. Format the following extracted document content as clean, well-structured Markdown.

Rules:
- Preserve ALL content — do not summarise, omit, or analyse anything
- Add clear structure: use # for the document title (first chunk only), ## for sections, bullet points for lists, and | tables | for tabular data
- Clean up redundant whitespace and OCR artifacts but keep all words
- For spreadsheets/CSV: render data as Markdown tables
- For presentations: use ## Slide N as headers
- Do not add commentary, interpretation, or analysis
- Output only the formatted Markdown, nothing else
${!isFirst ? '- This is a continuation chunk — do NOT add a document title, just continue formatting the content' : ''}`
      },
      {
        role: 'user',
        content: `Filename: ${filename} (part ${chunkIndex + 1} of ${totalChunks})\n\n${chunk}`
      }
    ]
  })
  return response.choices[0].message.content ?? chunk
}

async function formatAsMarkdown(client: OpenAI, text: string, filename: string): Promise<string> {
  const chunks = splitIntoChunks(text, CHUNK_SIZE)

  if (chunks.length === 1) {
    return formatChunk(client, chunks[0], filename, 0, 1)
  }

  const formatted = await Promise.all(
    chunks.map((chunk, i) => formatChunk(client, chunk, filename, i, chunks.length))
  )

  return formatted.join('\n\n')
}

export async function run(req: ExtractionRequest): Promise<ExtractionResponse> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  let rawText: string
  let format: string

  try {
    // Step 1: Cheap text extraction
    const extracted = await extract(req.buffer, req.filename, req.mimetype)
    rawText = extracted.text
    format = extracted.format

    // Step 2: Judge quality — if poor and format is image/PDF, suggest visual-intelligence
    if (VISION_COMPATIBLE.has(format)) {
      const verdict = await judge(client, rawText, extracted.sizeBytes)
      if (verdict.escalate) {
        return {
          content: `This document appears to be a **scanned or image-only ${format.toUpperCase()}**. No readable text layer was found.\n\nTo extract content from this document, please use the **Visual Intelligence** skill — it uses GPT-4o Vision to read images and scanned documents.`,
          method: 'text',
          confidence: 'low',
          reason: verdict.reason,
          format,
          suggestion: 'visual-intelligence',
        }
      }
    }

    // Step 3: Format full content as clean Markdown
    const content = await formatAsMarkdown(client, rawText, req.filename)

    return { content, method: 'text', confidence: 'high', format }

  } catch (err) {
    // Text extraction failed entirely — if vision-compatible, suggest visual-intelligence
    const ext = req.filename.split('.').pop()?.toLowerCase() ?? 'unknown'
    if (VISION_COMPATIBLE.has(ext)) {
      return {
        content: `Text extraction failed for this **${ext.toUpperCase()}** file. It may be a scanned document or image-only PDF.\n\nTo extract content from this document, please use the **Visual Intelligence** skill.`,
        method: 'text',
        confidence: 'low',
        reason: `Text extraction failed: ${(err as Error).message}`,
        format: ext,
        suggestion: 'visual-intelligence',
      }
    }
    throw new Error(`Extraction failed: ${(err as Error).message}`)
  }
}
