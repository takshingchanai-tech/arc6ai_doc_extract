import OpenAI from 'openai'

export async function extractWithVision(
  client: OpenAI,
  buffer: Buffer,
  filename: string,
  schema?: string[]
): Promise<string> {
  const base64 = buffer.toString('base64')
  const ext = filename.split('.').pop()?.toLowerCase()
  const mimeType = ext === 'pdf' ? 'application/pdf' : `image/${ext === 'jpg' ? 'jpeg' : ext}`

  const schemaPrompt = schema?.length
    ? `Focus on extracting these specific fields: ${schema.join(', ')}.`
    : 'Extract all meaningful text, tables, and structured data.'

  // For PDFs, we convert to an image URL approach — GPT-4o can handle base64 images
  // For actual image files, pass directly
  const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext ?? '')

  if (!isImage && ext !== 'pdf') {
    throw new Error(`Vision extraction not supported for format: ${ext}`)
  }

  const imageMime = isImage ? `image/${ext === 'jpg' ? 'jpeg' : ext}` : 'image/png'

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `You are a document extraction expert. ${schemaPrompt} Return the extracted content as structured plain text. Preserve tables using markdown table format.`
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:${imageMime};base64,${base64}`,
              detail: 'high'
            }
          }
        ]
      }
    ]
  })

  return response.choices[0].message.content ?? ''
}
