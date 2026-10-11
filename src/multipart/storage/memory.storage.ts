import { Buffer } from 'node:buffer';

import type { MultipartStorageEngine } from '../interfaces/index.ts';

/**
 * Buffers each file into `file.buffer`, the default storage
 * engine as in multer.
 */
function memoryStorage(): MultipartStorageEngine {
  return {
    _handleFile(_request, file, callback) {
      const chunks: Buffer[] = [];
      file.stream.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      file.stream.once('error', callback);
      file.stream.once('end', () => {
        const buffer = Buffer.concat(chunks);
        callback(null, { buffer, size: buffer.length });
      });
    },
    _removeFile(_request, file, callback) {
      delete file.buffer;
      callback(null);
    },
  };
}

export { memoryStorage };
