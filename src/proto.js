const fs = require('fs');
const os = require('os');
const path = require('path');

const BEGIN_MARKER = '<!-- HUMAN_AGENT_PROTO_BEGIN -->';
const END_MARKER = '<!-- HUMAN_AGENT_PROTO_END -->';

const BEGIN_MARKER_RE = /<!--\s*(?:HUMAN|HUAMN)_AGENT_PROTO_BEGIN\s*-->/;
const END_MARKER_RE = /<!--\s*(?:HUMAN|HUAMN)_AGENT_PROTO_END\s*-->/;

function getPlatformKey() {
  const p = process.platform;
  if (p === 'win32') return 'windows';
  if (p === 'darwin') return 'macos';
  if (p === 'linux') return 'linux';
  return p;
}

function configPath() {
  return path.join(os.homedir(), '.cue', 'cueme.json');
}

function expandPath(p) {
  if (typeof p !== 'string') return p;
  let s = p;

  // Expand leading ~
  if (s === '~' || s.startsWith('~/') || s.startsWith('~\\')) {
    s = path.join(os.homedir(), s.slice(2));
  }

  // Expand %ENV% variables (Windows-style)
  s = s.replace(/%([A-Za-z0-9_]+)%/g, (_, name) => {
    const v = process.env[name];
    return typeof v === 'string' ? v : '';
  });

  return s;
}

function pathExists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function detectVscodeCandidates({ platform }) {
  const candidates = [];
  const cwd = process.cwd();

  // Workspace-level (if you want repo-local rules)
  candidates.push(path.join(cwd, '.vscode', 'prompts', 'cueme_proto.instructions.md'));

  // User-level prompts
  const home = os.homedir();
  if (platform === 'macos') {
    candidates.push(
      path.join(home, 'Library', 'Application Support', 'Code', 'User', 'prompts', 'cueme_proto.instructions.md')
    );
  }
  if (platform === 'linux') {
    // User supplied: ~/.config/Code/User/prompts/
    candidates.push(path.join(home, '.config', 'Code', 'User', 'prompts', 'cueme_proto.instructions.md'));
  }
  if (platform === 'windows') {
    const appData = process.env.APPDATA;
    if (appData) candidates.push(path.join(appData, 'Code', 'User', 'prompts', 'cueme_proto.instructions.md'));
  }

  return candidates;
}

function detectWindsurfCandidates({ platform }) {
  const candidates = [];
  const cwd = process.cwd();

  // Workspace-level (repo-local)
  candidates.push(path.join(cwd, '.codeium', 'windsurf', 'memories', 'global_rules.md'));

  // User-level (standard)
  const home = os.homedir();
  const userProfile = process.env.USERPROFILE || home;
  if (platform === 'macos') candidates.push(path.join(home, '.codeium', 'windsurf', 'memories', 'global_rules.md'));
  if (platform === 'linux') candidates.push(path.join(home, '.codeium', 'windsurf', 'memories', 'global_rules.md'));
  if (platform === 'windows') {
    candidates.push(path.join(userProfile, '.codeium', 'windsurf', 'memories', 'global_rules.md'));
  }

  return candidates;
}

function detectKiroCandidates({ platform }) {
  const candidates = [];
  const cwd = process.cwd();

  // Workspace-level (repo-local)
  candidates.push(path.join(cwd, '.kiro', 'cueme_proto.md'));

  // User-level (standard)
  const home = os.homedir();
  const userProfile = process.env.USERPROFILE || home;
  if (platform === 'macos') candidates.push(path.join(home, '.kiro', 'cueme_proto.md'));
  if (platform === 'linux') candidates.push(path.join(home, '.config', 'kiro', 'cueme_proto.md'));
  if (platform === 'windows') {
    candidates.push(path.join(userProfile, '.kiro', 'cueme_proto.md'));
  }

  return candidates;
}

function firstExistingPath(candidates) {
  for (const p of candidates) {
    if (typeof p === 'string' && p.trim().length > 0 && pathExists(p)) return p;
  }
  return '';
}

function defaultPathMapTemplate() {
  const out = {};

  const home = os.homedir();
  const appData = process.env.APPDATA || '';
  const userProfile = process.env.USERPROFILE || home;

  // VSCode
  out['macos.vscode'] = path.join(
    home,
    'Library',
    'Application Support',
    'Code',
    'User',
    'prompts',
    'cueme_proto.instructions.md'
  );
  out['windows.vscode'] = appData
    ? path.join(appData, 'Code', 'User', 'prompts', 'cueme_proto.instructions.md')
    : path.join(userProfile, 'AppData', 'Roaming', 'Code', 'User', 'prompts', 'cueme_proto.instructions.md');
  out['linux.vscode'] = path.join(home, '.config', 'Code', 'User', 'prompts', 'cueme_proto.instructions.md');

  // Windsurf
  out['macos.windsurf'] = path.join(home, '.codeium', 'windsurf', 'memories', 'global_rules.md');
  out['windows.windsurf'] = path.join(userProfile, '.codeium', 'windsurf', 'memories', 'global_rules.md');
  out['linux.windsurf'] = path.join(home, '.codeium', 'windsurf', 'memories', 'global_rules.md');

  // Kiro
  out['macos.kiro'] = path.join(home, '.kiro', 'cueme_proto.md');
  out['windows.kiro'] = path.join(userProfile, '.kiro', 'cueme_proto.md');
  out['linux.kiro'] = path.join(home, '.config', 'kiro', 'cueme_proto.md');

  return out;
}

function defaultConfigTemplate() {
  const protocolPath = path.join(__dirname, '..', 'protocol.md');
  return {
    'cueme.proto.path': defaultPathMapTemplate(),
    'cueme.proto.prefix': {
      windsurf: [],
      vscode: ['---', 'applyTo: "**"', '---'],
      kiro: [],
    },
    'cueme.proto.protocol_path': protocolPath,
  };
}

function detectAndFillTemplatePaths(tpl) {
  const platform = getPlatformKey();
  const keyVscode = `${platform}.vscode`;
  const keyWindsurf = `${platform}.windsurf`;
  const keyKiro = `${platform}.kiro`;

  const pathMap = tpl['cueme.proto.path'] || {};
  const detected = { platform, vscode: '', windsurf: '', kiro: '' };

  if (typeof pathMap !== 'object' || Array.isArray(pathMap)) {
    return { tpl, detected };
  }

  // If current platform key is empty or missing, try detect.
  if (typeof pathMap[keyVscode] !== 'string' || pathMap[keyVscode].trim().length === 0) {
    const p = firstExistingPath(detectVscodeCandidates({ platform }));
    if (p) {
      pathMap[keyVscode] = p;
      detected.vscode = p;
    }
  }

  if (typeof pathMap[keyWindsurf] !== 'string' || pathMap[keyWindsurf].trim().length === 0) {
    const p = firstExistingPath(detectWindsurfCandidates({ platform }));
    if (p) {
      pathMap[keyWindsurf] = p;
      detected.windsurf = p;
    }
  }

  if (typeof pathMap[keyKiro] !== 'string' || pathMap[keyKiro].trim().length === 0) {
    const p = firstExistingPath(detectKiroCandidates({ platform }));
    if (p) {
      pathMap[keyKiro] = p;
      detected.kiro = p;
    }
  }

  tpl['cueme.proto.path'] = pathMap;
  return { tpl, detected };
}

function initConfigIfMissing() {
  const p = configPath();
  if (fs.existsSync(p)) {
    return { created: false, path: p, detected: null };
  }
  ensureDirForFile(p);
  const { tpl, detected } = detectAndFillTemplatePaths(defaultConfigTemplate());
  fs.writeFileSync(p, JSON.stringify(tpl, null, 2) + '\n', 'utf8');
  return { created: true, path: p, detected };
}

function readConfigOrThrow({ auto_init } = {}) {
  const p = configPath();
  let raw;
  try {
    raw = fs.readFileSync(p, 'utf8');
  } catch {
    if (auto_init) {
      initConfigIfMissing();
      try {
        raw = fs.readFileSync(p, 'utf8');
      } catch {
        throw new Error(`error: cannot read config: ${p}`);
      }
    } else {
      throw new Error(`error: cannot read config: ${p}`);
    }
  }

  let cfg;
  try {
    cfg = JSON.parse(raw);
  } catch {
    throw new Error(`error: config is not valid JSON: ${p}`);
  }

  if (!cfg || typeof cfg !== 'object') {
    throw new Error(`error: config must be a JSON object: ${p}`);
  }
  return cfg;
}

function detectEol(text) {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

function ensureDirForFile(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function buildFinalProto({ cfg, agent }) {
  const prefixMap = cfg['cueme.proto.prefix'] || {};
  const protocolPath = cfg['cueme.proto.protocol_path'];

  const prefixRaw = prefixMap[agent];
  let prefix;
  if (typeof prefixRaw === 'string') {
    prefix = prefixRaw;
  } else if (Array.isArray(prefixRaw) && prefixRaw.every((x) => typeof x === 'string')) {
    prefix = prefixRaw.join('\n');
  } else {
    throw new Error(`error: prefix not configured: cueme.proto.prefix["${agent}"]`);
  }

  if (typeof protocolPath !== 'string' || protocolPath.trim().length === 0) {
    throw new Error('error: cannot read protocol.md');
  }

  const protocolPathExpanded = expandPath(protocolPath);
  const resolvedProtocolPath = path.isAbsolute(protocolPathExpanded)
    ? protocolPathExpanded
    : path.resolve(process.cwd(), protocolPathExpanded);

  let protocol;
  try {
    protocol = fs.readFileSync(resolvedProtocolPath, 'utf8');
  } catch {
    throw new Error('error: cannot read protocol.md');
  }

  return { prefix, protocol };
}

function resolveTargetPath({ cfg, agent }) {
  const platform = getPlatformKey();
  const key = `${platform}.${agent}`;
  const pathMap = cfg['cueme.proto.path'] || {};
  const p = pathMap[key];
  if (typeof p !== 'string' || p.trim().length === 0) {
    throw new Error(`error: target path not configured: cueme.proto.path["${key}"]`);
  }
  const expanded = expandPath(p);
  return path.isAbsolute(expanded) ? expanded : path.resolve(process.cwd(), expanded);
}

function makeManagedBlock({ prefix, protocol, eol }) {
  const normalizedProto = String(protocol || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const protoLines = normalizedProto.split('\n');
  const managedBlock = [BEGIN_MARKER, ...protoLines, END_MARKER].join(eol) + eol;
  
  if (prefix && prefix.trim()) {
    const normalizedPrefix = String(prefix).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    return normalizedPrefix + eol + eol + managedBlock;
  }
  
  return managedBlock;
}

function applyManagedBlock({ existing, prefix, protocol }) {
  const eol = detectEol(existing);
  const block = makeManagedBlock({ prefix, protocol, eol });

  const beginMatch = existing.match(BEGIN_MARKER_RE);
  const endMatch = existing.match(END_MARKER_RE);
  if (beginMatch && endMatch && endMatch.index > beginMatch.index) {
    const beginIdx = beginMatch.index;
    const endIdx = endMatch.index;
    const endLen = endMatch[0].length;

    const before = existing.slice(0, beginIdx);
    const after = existing.slice(endIdx + endLen);

    const afterTrim = after.startsWith(eol) ? after.slice(eol.length) : after;
    return before + block + afterTrim;
  }

  let out = existing;
  if (!out.endsWith(eol)) out += eol;
  out += block;
  return out;
}

function listAgents({ cfg }) {
  const prefixMap = cfg['cueme.proto.prefix'] || {};
  const pathMap = cfg['cueme.proto.path'] || {};

  const agents = new Set();
  for (const k of Object.keys(prefixMap)) agents.add(k);
  for (const k of Object.keys(pathMap)) {
    const parts = String(k).split('.');
    if (parts.length === 2) agents.add(parts[1]);
  }

  return Array.from(agents).sort();
}

function protoRender(agent) {
  const cfg = readConfigOrThrow({ auto_init: true });
  return buildFinalProto({ cfg, agent });
}

function protoPath(agent) {
  const cfg = readConfigOrThrow({ auto_init: true });
  return resolveTargetPath({ cfg, agent });
}

function protoLs() {
  const cfg = readConfigOrThrow({ auto_init: true });
  return listAgents({ cfg }).join('\n') + '\n';
}

function protoApply(agent) {
  const cfg = readConfigOrThrow({ auto_init: true });
  const targetPath = resolveTargetPath({ cfg, agent });
  const { prefix, protocol } = buildFinalProto({ cfg, agent });

  let existing = '';
  let exists = false;
  try {
    existing = fs.readFileSync(targetPath, 'utf8');
    exists = true;
  } catch {
    existing = '';
    exists = false;
  }

  const eol = exists ? detectEol(existing) : os.EOL;
  const managedBlock = makeManagedBlock({ prefix, protocol, eol });

  let out;
  if (!exists) {
    out = managedBlock;
  } else {
    out = applyManagedBlock({ existing, prefix, protocol });
  }

  ensureDirForFile(targetPath);
  fs.writeFileSync(targetPath, out, 'utf8');

  return `ok: applied to ${targetPath}`;
}

function protoInit() {
  const { created, path: p, detected } = initConfigIfMissing();
  if (!created) return `ok: exists ${p}`;
  const platform = detected && detected.platform ? detected.platform : getPlatformKey();
  const keyVscode = `${platform}.vscode`;
  const keyWindsurf = `${platform}.windsurf`;
  const keyKiro = `${platform}.kiro`;
  const vs = detected && detected.vscode ? 'detected' : 'empty';
  const ws = detected && detected.windsurf ? 'detected' : 'empty';
  const ks = detected && detected.kiro ? 'detected' : 'empty';
  return `ok: initialized ${p} (auto-detect: ${keyVscode}=${vs}, ${keyWindsurf}=${ws}, ${keyKiro}=${ks})`;
}

module.exports = {
  BEGIN_MARKER,
  END_MARKER,
  getPlatformKey,
  protoApply,
  protoInit,
  protoLs,
  protoPath,
  protoRender,
};
