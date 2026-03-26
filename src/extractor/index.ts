import { extractPdf } from './pdf.js'
import { extractDocx } from './docx.js'
import { extractXlsx } from './xlsx.js'

export type FileFormat = 'pdf' | 'docx' | 'xlsx' | 'csv' | 'txt' | 'unknown'

export function detectFormat(filename: string, mimetype?: string): FileFormat {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf' || mimetype === 'application/pdf') return 'pdf'
  if (ext === 'docx' || mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx'
  if (ext === 'xlsx' || mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return 'xlsx'
  if (ext === 'csv' || mimetype === 'text/csv') return 'csv'
  if (ext === 'txt' || mimetype === 'text/plain') return 'txt'
  return 'unknown'
}

export interface ExtractResult {
  text: string
  format: FileFormat
  sizeBytes: number
}

export async function extract(buffer: Buffer, filename: string, mimetype?: string): Promise<ExtractResult> {
  const format = detectFormat(filename, mimetype)
  const sizeBytes = buffer.length

  let text: string

  switch (format) {
    case 'pdf':
      text = await extractPdf(buffer)
      break
    case 'docx':
      text = await extractDocx(buffer)
      break
    case 'xlsx':
      text = extractXlsx(buffer)
      break
    case 'csv':
    case 'txt':
      text = buffer.toString('utf-8')
      break
    default:
      throw new Error(`Unsupported file format: ${filename}`)
  }

  return { text, format, sizeBytes }
}
