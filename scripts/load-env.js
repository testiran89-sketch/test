const fs = require('fs');
const path = require('path');

function parseDotEnv(content) {
  const out = {};
  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function applyEnv(obj) {
  for (const [k, v] of Object.entries(obj)) {
    if (!process.env[k]) {
      process.env[k] = v;
    }
  }
}

function loadEnv() {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '..', '.env')
  ];

  let loadedFrom = null;
  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      applyEnv(parseDotEnv(raw));
      loadedFrom = filePath;
      break;
    }
  }

  return { loadedFrom };
}

function requireEnv(keys) {
  return keys.filter((k) => !process.env[k] || String(process.env[k]).trim() === '');
}

module.exports = { loadEnv, requireEnv };
