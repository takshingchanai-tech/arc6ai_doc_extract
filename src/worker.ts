/**
 * Cloudflare Workers entry point.
 * Uses Hono's default fetch export (no @hono/node-server).
 * OPENAI_API_KEY must be set as a Worker secret via wrangler.
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { run } from './orchestrator/index.js'

const app = new Hono()

app.use('*', cors())

app.get('/health', (c) => c.json({ status: 'ok', service: 'arc6ai_doc_extract' }))

app.post('/extract', async (c) => {
  // Inject OPENAI_API_KEY from CF Workers env into process.env
  const env = c.env as Record<string, string>
  if (env.OPENAI_API_KEY) {
    process.env.OPENAI_API_KEY = env.OPENAI_API_KEY
  }

  let formData: FormData
  try {
    formData = await c.req.formData()
  } catch {
    return c.json({ error: 'Request must be multipart/form-data' }, 400)
  }

  const file = formData.get('file')
  if (!file || !(file instanceof File)) {
    return c.json({ error: 'Missing file field' }, 400)
  }

  const schemaRaw = formData.get('schema')
  let schema: string[] | undefined
  if (schemaRaw && typeof schemaRaw === 'string') {
    try {
      const parsed = JSON.parse(schemaRaw) as unknown
      if (Array.isArray(parsed)) {
        schema = parsed as string[]
      } else if (typeof parsed === 'object' && parsed !== null && 'fields' in parsed) {
        schema = (parsed as { fields: string[] }).fields
      }
    } catch {
      return c.json({ error: 'Invalid schema JSON' }, 400)
    }
  }

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  try {
    const result = await run({
      buffer,
      filename: file.name,
      mimetype: file.type || undefined,
      schema
    })
    return c.json(result)
  } catch (err) {
    const message = (err as Error).message
    console.error('[arc6ai_doc_extract] Error:', message)
    return c.json({ error: message }, 500)
  }
})

export default app
