import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { run } from './orchestrator/index.js'

const app = new Hono()

app.get('/health', (c) => c.json({ status: 'ok', service: 'arc6ai_doc_extract' }))

app.post('/extract', async (c) => {
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

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  try {
    const result = await run({
      buffer,
      filename: file.name,
      mimetype: file.type || undefined,
    })
    return c.json(result)
  } catch (err) {
    const message = (err as Error).message
    console.error('[arc6ai_doc_extract] Error:', message)
    return c.json({ error: message }, 500)
  }
})

const port = Number(process.env.PORT ?? 3001)
console.log(`arc6ai_doc_extract running on http://localhost:${port}`)

serve({ fetch: app.fetch, port })
