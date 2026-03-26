import mammoth from 'mammoth'

export async function extractDocx(buffer: Buffer): Promise<string> {
  // CF Workers nodejs_compat Buffer may not pass mammoth's instanceof check —
  // use arrayBuffer option which mammoth accepts universally
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
  const result = await mammoth.extractRawText({ arrayBuffer })
  return result.value
}
