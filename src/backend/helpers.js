const crypto = require('crypto');
const { URL } = require('url');
const config = require('./config');

function parsePagination(params, defaults = {}) {
  const { page: defaultPage = 1, pageSize: defaultPageSize = 20, maxPageSize = 100 } = defaults;
  const page = Math.max(1, Number(params?.get?.('page') ?? defaultPage) || defaultPage);
  const pageSize = Math.min(maxPageSize, Math.max(1, Number(params?.get?.('pageSize') ?? defaultPageSize) || defaultPageSize));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function computePaginationMeta(total, page, pageSize) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * pageSize;
  return { page, pageSize, total, totalPages, safePage, offset };
}

function estimerCredit(montant, tauxAnnuel = 0.035, dureeMois = 300) {
  const tauxMensuel = tauxAnnuel / 12;
  const mensualite = montant * (tauxMensuel * Math.pow(1 + tauxMensuel, dureeMois)) / (Math.pow(1 + tauxMensuel, dureeMois) - 1);
  return { mensualite: Math.round(mensualite), total: Math.round(mensualite * dureeMois) };
}

const normalize = (value) => (value == null ? '' : String(value)).trim().toLowerCase();

const normalizeNoAccent = (value) =>
  normalize(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const normalizeLoose = (value) =>
  normalizeNoAccent(value)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const slugify = (value, maxLen = 60) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, maxLen);

const normalizeOrigin = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    return `${parsed.protocol}//${parsed.host}`.toLowerCase();
  } catch {
    return '';
  }
};

const createHttpError = (statusCode, message) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

const toBuffer = (value) => Buffer.from(String(value ?? ''), 'utf8');

const safeStringEqual = (left, right) => {
  try {
    const a = toBuffer(left);
    const b = toBuffer(right);
    if (a.length !== b.length) {
      const longer = a.length > b.length ? a : b;
      const shorter = a.length > b.length ? b : a;
      const buf = Buffer.alloc(longer.length, 0);
      shorter.copy(buf);
      return crypto.timingSafeEqual(longer, buf);
    }
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
};

const parseScryptHash = (encoded) => {
  const parts = String(encoded || '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return null;
  const [_, nRaw, rRaw, pRaw, saltHex, hashHex] = parts;
  const n = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p) || n <= 1 || r <= 0 || p <= 0) return null;
  if (!saltHex || !hashHex) return null;
  try {
    return { n, r, p, salt: Buffer.from(saltHex, 'hex'), expected: Buffer.from(hashHex, 'hex') };
  } catch { return null; }
};

const verifyPassword = (storedPassword, incomingPassword) => {
  const parsed = parseScryptHash(storedPassword);
  if (!parsed) return safeStringEqual(storedPassword, incomingPassword);
  const derived = crypto.scryptSync(String(incomingPassword || ''), parsed.salt, parsed.expected.length, { N: parsed.n, r: parsed.r, p: parsed.p });
  return crypto.timingSafeEqual(derived, parsed.expected);
};

const isProbablyHashedPassword = (value) =>
  typeof value === 'string' && /^\$(scrypt|2[abmy]|argon2(id?)?)\$/i.test(value.trim());

const getBoundary = (contentType) => {
  const match = String(contentType || '').match(/boundary=(?:"([^"]+)"|([^;\s]+))/i);
  return match?.[1] || match?.[2] || null;
};

const parseMultipartFile = (buffer, boundary) => {
  if (!Buffer.isBuffer(buffer) || !boundary) return null;
  const delimiter = Buffer.from(`--${boundary}`);
  const endDelimiter = Buffer.from(`--${boundary}--`);
  let start = buffer.indexOf(delimiter);
  if (start === -1) return null;
  start += delimiter.length;
  const end = buffer.indexOf(endDelimiter, start);
  const sectionEnd = (end !== -1 ? end : buffer.indexOf(delimiter, start));
  if (sectionEnd === -1) return null;
  const section = buffer.subarray(start, sectionEnd);
  const headerEnd = section.indexOf('\r\n\r\n');
  if (headerEnd === -1) return null;
  const headerSection = section.subarray(0, headerEnd).toString('utf8');
  const dispositionMatch = headerSection.match(/Content-Disposition:\s*form-data;\s*name="([^"]*)"(?:;\s*filename="([^"]*)")?/i);
  if (!dispositionMatch) return null;
  const name = dispositionMatch[1];
  const filename = dispositionMatch[2] || null;
  const contentTypeMatch = headerSection.match(/Content-Type:\s*(\S+)/i);
  const mime = contentTypeMatch?.[1] || null;
  const data = section.subarray(headerEnd + 4);
  return { name, filename, mime, data };
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const statusToLabel = (status) => {
  if (status === 'location') return 'Location';
  return 'Vente';
};

const scoreToConfidenceLabel = (value) => {
  if (value >= 80) return 'Elevee';
  if (value >= 60) return 'Moyenne';
  return 'Faible';
};

const escapeAttr = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const expandLocationTerms = (value) => {
  const key = normalizeNoAccent(value || '');
  if (!key) return [String(value || '')];
  const aliases = config.LOCATION_ALIASES;
  if (aliases[key]) return [key, ...aliases[key]];
  for (const [canonical, syns] of Object.entries(aliases)) {
    if (syns.includes(key)) return [canonical, ...syns];
  }
  return [String(value)];
};

const toCsvFromObjects = (rows, preferredColumns = null) => {
  const list = Array.isArray(rows) ? rows : [];
  if (list.length === 0) return '';
  const columns = Array.isArray(preferredColumns) && preferredColumns.length
    ? preferredColumns
    : Object.keys(list[0]);
  const esc = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const header = columns.map(esc).join(',');
  const lines = list.map((row) => columns.map((c) => esc(row[c])).join(','));
  return [header, ...lines].join('\n');
};

module.exports = {
  parsePagination, computePaginationMeta, estimerCredit,
  normalize, normalizeNoAccent, normalizeLoose, slugify,
  normalizeOrigin, createHttpError,
  toBuffer, safeStringEqual, parseScryptHash, verifyPassword, isProbablyHashedPassword,
  getBoundary, parseMultipartFile,
  clamp, statusToLabel, scoreToConfidenceLabel,
  escapeAttr, toCsvFromObjects, expandLocationTerms
};
