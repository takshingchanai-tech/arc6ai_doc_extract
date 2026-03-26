import { unzipSync } from 'fflate'

// Handles ODT (text), ODS (spreadsheet), ODP (presentation)
// All OpenDocument formats are ZIP archives with a content.xml inside

function stripXml(xml: string): string {
  return xml
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

export function extractOdf(buffer: Buffer): string {
  const zip = unzipSync(new Uint8Array(buffer))

  const contentData = zip['content.xml']
  if (!contentData) throw new Error('No content.xml found — may not be a valid ODF file')

  const xml = new TextDecoder().decode(contentData)
  return stripXml(xml)
}
