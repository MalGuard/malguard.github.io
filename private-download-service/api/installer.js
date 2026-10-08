import {readFile, stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createPasswordDownloadHandler} from '../lib/password-download.mjs';
import {metadata} from '../installer-release.mjs';

export default createPasswordDownloadHandler({
  metadata, origin: 'https://malguard.github.io',
  readSealed: async () => {
    const chunks = []; let total = 0;
    for (const part of metadata.parts) {
      if (!/^[0-9]{3}\.sealed$/.test(part.name)) throw new Error('invalid sealed path');
      const path = fileURLToPath(new URL('../sealed-installer/' + part.name, import.meta.url));
      const info = await stat(path);
      if (!info.isFile() || info.size !== part.size) throw new Error('sealed size');
      total += info.size;
      if (total > metadata.size + 34) throw new Error('sealed limit');
      chunks.push(await readFile(path));
    }
    return Buffer.concat(chunks);
  }
});
