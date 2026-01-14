const chardet = require('chardet');
const iconv = require('iconv-lite');

function readAllStdin() {
  if (process.stdin.isTTY) return Promise.resolve('');
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    });
    process.stdin.on('end', () => {
      const buf = Buffer.concat(chunks);
      if (!buf || buf.length === 0) return resolve('');

      // BOM detection (fast path for common cases)
      if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
        return resolve(buf.slice(3).toString('utf8'));
      }
      if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
        return resolve(buf.slice(2).toString('utf16le'));
      }
      if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
        // UTF-16BE is rare; decode by swapping bytes.
        const swapped = Buffer.alloc(buf.length - 2);
        for (let i = 2; i + 1 < buf.length; i += 2) {
          swapped[i - 2] = buf[i + 1];
          swapped[i - 1] = buf[i];
        }
        return resolve(swapped.toString('utf16le'));
      }

      // Use chardet for automatic encoding detection
      const detected = chardet.detect(buf);
      
      if (detected && detected !== 'UTF-8') {
        try {
          return resolve(iconv.decode(buf, detected));
        } catch {
          // Fallback to UTF-8 if decode fails
          return resolve(buf.toString('utf8'));
        }
      }

      // Default to UTF-8
      return resolve(buf.toString('utf8'));
    });
    process.stdin.on('error', reject);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { readAllStdin, sleep };
