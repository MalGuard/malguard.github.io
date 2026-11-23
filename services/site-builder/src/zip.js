// One uncompressed UTF-8 entry, supported by standard ZIP readers.
export function sourceZip(html) {
  const encoder = new TextEncoder();
  const name = encoder.encode("index.html");
  const data = encoder.encode(html);
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  crc = (crc ^ 0xffffffff) >>> 0;
  const localSize = 30 + name.length + data.length;
  const centralSize = 46 + name.length;
  const result = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(result.buffer);
  const u16 = (at, value) => view.setUint16(at, value, true);
  const u32 = (at, value) => view.setUint32(at, value, true);
  function header(start, central) {
    u32(start, central ? 0x02014b50 : 0x04034b50);
    if (central) u16(start + 4, 20);
    const at = start + (central ? 2 : 0);
    u16(at + 4, 20);
    u16(at + 6, 0x0800);
    u16(at + 12, 33); // January 1, 1980
    u32(at + 14, crc);
    u32(at + 18, data.length);
    u32(at + 22, data.length);
    u16(at + 26, name.length);
    result.set(name, start + (central ? 46 : 30));
  }
  header(0, false);
  result.set(data, 30 + name.length);
  header(localSize, true);
  const end = localSize + centralSize;
  u32(end, 0x06054b50);
  u16(end + 8, 1);
  u16(end + 10, 1);
  u32(end + 12, centralSize);
  u32(end + 16, localSize);
  return result;
}
