import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string }>

export async function extractPdf(buffer: Buffer): Promise<string> {
  const data = await pdfParse(buffer)
  return data.text
}
