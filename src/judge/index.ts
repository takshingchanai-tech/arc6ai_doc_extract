import OpenAI from 'openai'

export interface JudgeVerdict {
  quality: 'high' | 'low'
  escalate: boolean
  reason: string
}

function quickCheck(text: string, sizeBytes: number): JudgeVerdict | null {
  // Fast heuristic checks — no API call needed
  if (sizeBytes > 10_000 && text.trim().length < 50) {
    return { quality: 'low', escalate: true, reason: 'Extracted text too short for file size — likely image-only PDF' }
  }

  const nonAlpha = (text.match(/[^a-zA-Z0-9\s.,!?;:()\-$%]/g) ?? []).length
  const ratio = nonAlpha / Math.max(text.length, 1)
  if (ratio > 0.3 && text.length > 20) {
    return { quality: 'low', escalate: true, reason: 'High ratio of non-alphanumeric characters — likely garbled encoding' }
  }

  if (text.includes('\uFFFD')) {
    return { quality: 'low', escalate: true, reason: 'Unicode replacement characters detected — encoding failure' }
  }

  return null
}

export async function judge(
  client: OpenAI,
  text: string,
  sizeBytes: number,
  schema?: string[]
): Promise<JudgeVerdict> {
  // Run quick heuristic checks first (free)
  const quick = quickCheck(text, sizeBytes)
  if (quick) return quick

  // LLM-based quality check (gpt-4o-mini — cheap)
  const schemaHint = schema?.length
    ? `The caller expects these fields: ${schema.join(', ')}. Check if any are present.`
    : ''

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    max_tokens: 100,
    messages: [
      {
        role: 'system',
        content: `You are a document quality judge. Given extracted text from a document, decide if the extraction is high quality (readable, meaningful content) or low quality (garbled, incomplete, or unreadable). ${schemaHint}

Respond with JSON only: {"quality": "high"|"low", "reason": "one sentence explanation"}`
      },
      {
        role: 'user',
        content: `Extracted text (first 500 chars):\n\n${text.slice(0, 500)}`
      }
    ]
  })

  try {
    const raw = response.choices[0].message.content ?? '{}'
    const parsed = JSON.parse(raw) as { quality: 'high' | 'low'; reason: string }
    return {
      quality: parsed.quality,
      escalate: parsed.quality === 'low',
      reason: parsed.reason
    }
  } catch {
    // If parsing fails, assume high quality (don't escalate unnecessarily)
    return { quality: 'high', escalate: false, reason: 'Judge parse error — defaulting to high' }
  }
}
