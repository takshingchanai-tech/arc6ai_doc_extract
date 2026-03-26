import { extractPdf } from './pdf.js'
import { extractDocx } from './docx.js'
import { extractXlsx } from './xlsx.js'

export type FileFormat = 'pdf' | 'docx' | 'xlsx' | 'xls' | 'csv' | 'txt' | 'json' | 'md' | 'unknown'

export function detectFormat(filename: string, mimetype?: string): FileFormat {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf' || mimetype === 'application/pdf') return 'pdf'
  if (ext === 'docx' || mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx'
  if (ext === 'xlsx' || mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return 'xlsx'
  if (ext === 'xls' || mimetype === 'application/vnd.ms-excel') return 'xls'
  if (ext === 'csv' || mimetype === 'text/csv') return 'csv'
  if (ext === 'txt' || mimetype === 'text/plain') return 'txt'
  if (ext === 'json' || mimetype === 'application/json') return 'json'
  if (ext === 'md' || mimetype === 'text/markdown') return 'md'
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
    case 'xls':
      text = extractXlsx(buffer)
      break
    case 'csv':
    case 'txt':
    case 'md':
      text = buffer.toString('utf-8')
      break
    case 'json': {
      const raw = buffer.toString('utf-8')
      try {
        // Pretty-print JSON so the LLM reads it more naturally
        text = JSON.stringify(JSON.parse(raw), null, 2)
      } catch {
        text = raw
      }
      break
    }
    default:
      throw new Error(`Unsupported file format: ${filename}`)
  }

  return { text, format, sizeBytes }
}
