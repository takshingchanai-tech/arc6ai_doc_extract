import OpenAI from 'openai'
import { extract } from '../extractor/index.js'
import { judge } from '../judge/index.js'
import { extractWithVision } from '../vision/index.js'

export interface ExtractionRequest {
  buffer: Buffer
  filename: string
  mimetype?: string
  schema?: string[]  // optional list of field names to extract
}

export interface ExtractionResponse {
  result: Record<string, unknown> | string
  method: 'text' | 'vision'
  escalated: boolean
  confidence: 'high' | 'low'
  reason?: string
  format: string
}

async function structureWithLLM(
  client: OpenAI,
  text: string,
  schema?: string[]
): Promise<Record<string, unknown> | string> {
  if (!schema?.length) return text

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    max_tokens: 1000,
    messages: [
      {
        role: 'system',
        content: `Extract the following fields from the document text and return as JSON: ${schema.join(', ')}. If a field is not found, set it to null. Return only valid JSON.`
      },
      {
        role: 'user',
        content: text.slice(0, 8000)  // stay within token budget
      }
    ]
  })

  try {
    const content = response.choices[0].message.content ?? '{}'
    // Strip markdown code fences if present
    const cleaned = content.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    return JSON.parse(cleaned) as Record<string, unknown>
  } catch {
    return text
  }
}

// Only these formats can be re-processed by the vision model
const VISION_COMPATIBLE = new Set(['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp'])

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

    // Step 2: Judge quality — but only escalate if format supports vision
    if (VISION_COMPATIBLE.has(format)) {
      const verdict = await judge(client, rawText, extracted.sizeBytes, req.schema)
      if (verdict.escalate) {
        escalated = true
        judgeReason = verdict.reason
        rawText = await extractWithVision(client, req.buffer, req.filename, req.schema)
        method = 'vision'
      }
    }

    // Step 3: Structure output if schema provided
    const result = await structureWithLLM(client, rawText, req.schema)

    return {
      result,
      method,
      escalated,
      confidence: escalated ? 'low' : 'high',
      reason: judgeReason,
      format
    }
  } catch (err) {
    // Text extraction failed entirely — try vision only if format supports it
    const ext = req.filename.split('.').pop()?.toLowerCase() ?? 'unknown'
    if (!VISION_COMPATIBLE.has(ext)) {
      throw new Error(`Extraction failed: ${(err as Error).message}`)
    }
    try {
      rawText = await extractWithVision(client, req.buffer, req.filename, req.schema)
      const result = await structureWithLLM(client, rawText, req.schema)
      return {
        result,
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
