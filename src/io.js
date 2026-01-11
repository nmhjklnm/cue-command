function readAllStdin() {
  if (process.stdin.isTTY) return Promise.resolve('');
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { readAllStdin, sleep };
