import * as XLSX from 'xlsx'

export function extractXlsx(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const lines: string[] = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const csv = XLSX.utils.sheet_to_csv(sheet)
    lines.push(`=== Sheet: ${sheetName} ===\n${csv}`)
  }

  return lines.join('\n\n')
}
