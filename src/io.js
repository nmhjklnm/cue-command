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

      // BOM detection
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

      // Heuristic: PowerShell piping to native exe often uses UTF-16LE without BOM.
      const sampleLen = Math.min(buf.length, 256);

      // For small samples, use odd/even byte distribution (UTF-16LE ASCII often has 0x00 in odd indices).
      if (sampleLen <= 64) {
        let oddTotal = 0;
        let evenTotal = 0;
        let oddZeros = 0;
        let evenZeros = 0;
        for (let i = 0; i < sampleLen; i += 1) {
          if (i % 2 === 0) {
            evenTotal += 1;
            if (buf[i] === 0x00) evenZeros += 1;
          } else {
            oddTotal += 1;
            if (buf[i] === 0x00) oddZeros += 1;
          }
        }

        const oddZeroRatio = oddTotal > 0 ? oddZeros / oddTotal : 0;
        const evenZeroRatio = evenTotal > 0 ? evenZeros / evenTotal : 0;

        if (oddZeroRatio > 0.6 && evenZeroRatio < 0.2) {
          return resolve(buf.toString('utf16le'));
        }
      } else {
        let zeros = 0;
        for (let i = 0; i < sampleLen; i += 1) {
          if (buf[i] === 0x00) zeros += 1;
        }
        const zeroRatio = zeros / sampleLen;
        if (zeroRatio > 0.2) {
          return resolve(buf.toString('utf16le'));
        }
      }

      return resolve(buf.toString('utf8'));
    });
    process.stdin.on('error', reject);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { readAllStdin, sleep };
