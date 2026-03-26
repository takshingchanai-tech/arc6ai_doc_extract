import { unzipSync } from 'fflate'

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

export function extractPptx(buffer: Buffer): string {
  const zip = unzipSync(new Uint8Array(buffer))
  const slideTexts: Array<{ index: number; text: string }> = []

  for (const [path, data] of Object.entries(zip)) {
    // Slides live at ppt/slides/slide1.xml, slide2.xml, etc.
    const match = path.match(/^ppt\/slides\/slide(\d+)\.xml$/)
    if (!match) continue

    const xml = new TextDecoder().decode(data)
    const text = stripXml(xml)
    if (text) slideTexts.push({ index: Number(match[1]), text })
  }

  // Return slides in order
  return slideTexts
    .sort((a, b) => a.index - b.index)
    .map((s, i) => `=== Slide ${i + 1} ===\n${s.text}`)
    .join('\n\n')
}
