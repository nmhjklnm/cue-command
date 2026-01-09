const crypto = require('crypto');

const C = 'bcdfghjklmnpqrstvwxz';
const V = 'aeiou';
const CODA = ['', 'n', 'r', 'l', 's', 'm', 'nd', 'st', 'rk', 'ld'];

function choice(strOrArr) {
  const n = strOrArr.length;
  const i = crypto.randomInt(0, n);
  return strOrArr[i];
}

function syllable() {
  return choice(C) + choice(V) + choice(CODA);
}

function pureName(minLen = 8, maxLen = 12) {
  for (let tries = 0; tries < 100; tries += 1) {
    const nSyl = choice([3, 4, 5]);
    let s = '';
    for (let i = 0; i < nSyl; i += 1) s += syllable();
    s = s.slice(0, maxLen);
    if (s.length >= minLen && s.length <= maxLen && /^[a-zA-Z]+$/.test(s)) {
      return s;
    }
  }
  throw new Error('Name generation failed; adjust syllable/length parameters');
}

function generateName() {
  return pureName().toLowerCase();
}

module.exports = { generateName };
