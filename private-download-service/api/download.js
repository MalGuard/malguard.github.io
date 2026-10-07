import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createDownloadHandler } from '../lib/download.mjs';
import { metadata } from '../release.mjs';

export default createDownloadHandler({
  metadata,
  origin: 'https://malguard.github.io',
  publicAccess: true,
  getSecrets: () => ({ key: process.env.MALGUARD_DOWNLOAD_KEY }),
  readSealed: async () => {
    const parts = [];
    let total = 0;
    for (const part of metadata.parts) {
      if (!/^[0-9]{3}\.sealed$/.test(part.name)) throw new Error('invalid sealed path');
      const path = fileURLToPath(new URL('../sealed/' + part.name, import.meta.url));
      const info = await stat(path);
      if (!info.isFile() || info.size !== part.size) throw new Error('sealed size');
      total += info.size;
      if (total > metadata.size + 34) throw new Error('sealed limit');
      parts.push(await readFile(path));
    }
    return Buffer.concat(parts);
  }
});
