import { describe, it, expect } from 'vitest';
import h from '../../src/backend/helpers.js';

describe('helpers — parsePagination', () => {
  it('returns page, pageSize, offset from params', () => {
    const p = new URLSearchParams('page=3&pageSize=10');
    const r = h.parsePagination(p);
    expect(r.page).toBe(3);
    expect(r.pageSize).toBe(10);
    expect(r.offset).toBe(20);
  });

  it('uses defaults when no params', () => {
    const r = h.parsePagination(new URLSearchParams(''));
    expect(r.page).toBe(1);
    expect(r.pageSize).toBe(20);
    expect(r.offset).toBe(0);
  });

  it('respects custom defaults', () => {
    const r = h.parsePagination(new URLSearchParams(''), { page: 2, pageSize: 5 });
    expect(r.page).toBe(2);
    expect(r.pageSize).toBe(5);
    expect(r.offset).toBe(5);
  });

  it('caps pageSize at maxPageSize', () => {
    const r = h.parsePagination(new URLSearchParams('pageSize=999'), { maxPageSize: 50 });
    expect(r.pageSize).toBe(50);
  });

  it('pageSize=0 falls back to default (0 is falsy)', () => {
    const r = h.parsePagination(new URLSearchParams('pageSize=0'));
    expect(r.pageSize).toBe(20);
  });

  it('clamps page minimum to 1', () => {
    const r = h.parsePagination(new URLSearchParams('page=-5'));
    expect(r.page).toBe(1);
  });

  it('handles non-numeric values', () => {
    const r = h.parsePagination(new URLSearchParams('page=abc&pageSize=xyz'));
    expect(r.page).toBe(1);
    expect(r.pageSize).toBe(20);
  });

  it('handles null/undefined params gracefully', () => {
    const r = h.parsePagination(null);
    expect(r.page).toBe(1);
    expect(r.pageSize).toBe(20);
  });
});

describe('helpers — computePaginationMeta', () => {
  it('computes totalPages correctly', () => {
    const r = h.computePaginationMeta(95, 1, 20);
    expect(r.total).toBe(95);
    expect(r.totalPages).toBe(5);
    expect(r.safePage).toBe(1);
    expect(r.offset).toBe(0);
  });

  it('clamps safePage when page exceeds totalPages', () => {
    const r = h.computePaginationMeta(10, 100, 20);
    expect(r.safePage).toBe(1);
    expect(r.offset).toBe(0);
  });

  it('returns totalPages=1 when total=0', () => {
    const r = h.computePaginationMeta(0, 1, 20);
    expect(r.totalPages).toBe(1);
    expect(r.safePage).toBe(1);
  });

  it('exact division', () => {
    const r = h.computePaginationMeta(60, 3, 20);
    expect(r.totalPages).toBe(3);
    expect(r.safePage).toBe(3);
    expect(r.offset).toBe(40);
  });
});

describe('helpers — estimerCredit', () => {
  it('calculates mensualite and total', () => {
    const r = h.estimerCredit(1000000);
    expect(r.mensualite).toBeGreaterThan(0);
    expect(r.total).toBeGreaterThan(r.mensualite);
  });

  it('accepts custom taux and duree', () => {
    const r = h.estimerCredit(500000, 0.05, 120);
    expect(r.mensualite).toBeGreaterThan(0);
    expect(r.total).toBeGreaterThan(0);
  });

  it('zero amount gives zero', () => {
    const r = h.estimerCredit(0);
    expect(r.mensualite).toBe(0);
  });
});

describe('helpers — normalize', () => {
  it('trims and lowercases', () => {
    expect(h.normalize('  Hello WORLD  ')).toBe('hello world');
  });

  it('returns empty string for null/undefined', () => {
    expect(h.normalize(null)).toBe('');
    expect(h.normalize(undefined)).toBe('');
  });

  it('handles numbers', () => {
    expect(h.normalize(123)).toBe('123');
  });
});

describe('helpers — normalizeNoAccent', () => {
  it('removes accents', () => {
    expect(h.normalizeNoAccent('Témara')).toBe('temara');
    expect(h.normalizeNoAccent('Salé')).toBe('sale');
    expect(h.normalizeNoAccent('àâäáãå')).toBe('aaaaaa');
    expect(h.normalizeNoAccent('ñ')).toBe('n');
  });

  it('lowercases and trims', () => {
    expect(h.normalizeNoAccent('  ÉDAL  ')).toBe('edal');
  });
});

describe('helpers — normalizeLoose', () => {
  it('removes accents and non-alphanumeric', () => {
    expect(h.normalizeLoose('Témara Centre!')).toBe('temara centre');
  });

  it('collapses multiple spaces', () => {
    expect(h.normalizeLoose('hello   world')).toBe('hello world');
  });

  it('trims', () => {
    expect(h.normalizeLoose('  hello  ')).toBe('hello');
  });
});

describe('helpers — slugify', () => {
  it('creates slug from string', () => {
    expect(h.slugify('Hello World')).toBe('hello-world');
  });

  it('removes accents', () => {
    expect(h.slugify('Témara')).toBe('temara');
  });

  it('removes leading/trailing hyphens', () => {
    expect(h.slugify('-hello-')).toBe('hello');
  });

  it('truncates at maxLen', () => {
    expect(h.slugify('a'.repeat(100), 10)).toBe('a'.repeat(10));
  });

  it('handles empty/null', () => {
    expect(h.slugify('')).toBe('');
    expect(h.slugify(null)).toBe('');
  });
});

describe('helpers — normalizeOrigin', () => {
  it('parses valid https URL', () => {
    expect(h.normalizeOrigin('https://Example.com/path')).toBe('https://example.com');
  });

  it('parses valid http URL', () => {
    expect(h.normalizeOrigin('http://test.com:8080')).toBe('http://test.com:8080');
  });

  it('returns empty for non-http protocol', () => {
    expect(h.normalizeOrigin('ftp://files.com')).toBe('');
  });

  it('returns empty for empty string', () => {
    expect(h.normalizeOrigin('')).toBe('');
  });

  it('returns empty for invalid URL', () => {
    expect(h.normalizeOrigin('not a url')).toBe('');
  });

  it('returns empty for null', () => {
    expect(h.normalizeOrigin(null)).toBe('');
  });
});

describe('helpers — createHttpError', () => {
  it('creates error with statusCode', () => {
    const err = h.createHttpError(404, 'Not found');
    expect(err.message).toBe('Not found');
    expect(err.statusCode).toBe(404);
    expect(err).toBeInstanceOf(Error);
  });
});

describe('helpers — toBuffer', () => {
  it('creates buffer from string', () => {
    const buf = h.toBuffer('hello');
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.toString()).toBe('hello');
  });

  it('handles null/undefined', () => {
    expect(h.toBuffer(null).toString()).toBe('');
    expect(h.toBuffer(undefined).toString()).toBe('');
  });
});

describe('helpers — safeStringEqual', () => {
  it('returns true for equal strings', () => {
    expect(h.safeStringEqual('hello', 'hello')).toBe(true);
  });

  it('returns false for different strings', () => {
    expect(h.safeStringEqual('hello', 'world')).toBe(false);
  });

  it('returns true for equal length strings', () => {
    expect(h.safeStringEqual('abc', 'abc')).toBe(true);
  });

  it('returns false for different length strings', () => {
    expect(h.safeStringEqual('abc', 'abcd')).toBe(false);
  });

  it('returns true for two empty strings (same empty buffers)', () => {
    expect(h.safeStringEqual('', '')).toBe(true);
  });
});

describe('helpers — parseScryptHash', () => {
  it('parses valid scrypt hash', () => {
    const hash = 'scrypt$16384$8$1$abcdef01$abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
    const r = h.parseScryptHash(hash);
    expect(r).not.toBeNull();
    expect(r.n).toBe(16384);
    expect(r.r).toBe(8);
    expect(r.p).toBe(1);
  });

  it('returns null for non-scrypt hash', () => {
    expect(h.parseScryptHash('$2b$10$hash')).toBeNull();
  });

  it('returns null for invalid format', () => {
    expect(h.parseScryptHash('notahash')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(h.parseScryptHash('')).toBeNull();
  });

  it('returns null for null', () => {
    expect(h.parseScryptHash(null)).toBeNull();
  });

  it('returns null for invalid params', () => {
    expect(h.parseScryptHash('scrypt$0$0$0$abc$def')).toBeNull();
  });

  it('returns null for missing parts', () => {
    expect(h.parseScryptHash('scrypt$16384$8$1$')).toBeNull();
  });
});

describe('helpers — verifyPassword', () => {
  it('uses scrypt verification when hash present', () => {
    const salt = Buffer.alloc(16, 'a');
    const derived = require('crypto').scryptSync('password', salt, 64, { N: 16384, r: 8, p: 1 });
    const hash = `scrypt$16384$8$1$${salt.toString('hex')}$${derived.toString('hex')}`;
    expect(h.verifyPassword(hash, 'password')).toBe(true);
    expect(h.verifyPassword(hash, 'wrong')).toBe(false);
  });

  it('falls back to safeStringEqual for plain text', () => {
    expect(h.verifyPassword('mypassword', 'mypassword')).toBe(true);
    expect(h.verifyPassword('mypassword', 'wrong')).toBe(false);
  });
});

describe('helpers — isProbablyHashedPassword', () => {
  it('detects scrypt hash', () => {
    expect(h.isProbablyHashedPassword('$scrypt$16384$8$1$salt$hash')).toBe(true);
  });

  it('detects bcrypt hash', () => {
    expect(h.isProbablyHashedPassword('$2b$10$hash')).toBe(true);
  });

  it('detects argon2 hash', () => {
    expect(h.isProbablyHashedPassword('$argon2id$...')).toBe(true);
  });

  it('returns false for plain text', () => {
    expect(h.isProbablyHashedPassword('password')).toBe(false);
  });

  it('returns false for null', () => {
    expect(h.isProbablyHashedPassword(null)).toBe(false);
  });
});

describe('helpers — getBoundary', () => {
  it('extracts quoted boundary', () => {
    expect(h.getBoundary('multipart/form-data; boundary="abc123"')).toBe('abc123');
  });

  it('extracts unquoted boundary', () => {
    expect(h.getBoundary('multipart/form-data; boundary=abc123')).toBe('abc123');
  });

  it('returns null when no boundary', () => {
    expect(h.getBoundary('application/json')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(h.getBoundary('')).toBeNull();
  });
});

describe('helpers — parseMultipartFile', () => {
  it('returns null for non-buffer', () => {
    expect(h.parseMultipartFile('not a buffer', 'boundary')).toBeNull();
  });

  it('returns null for no boundary', () => {
    expect(h.parseMultipartFile(Buffer.from('data'), null)).toBeNull();
  });

  it('parses valid multipart section', () => {
    const boundary = '----test123';
    const body = '------test123\r\nContent-Disposition: form-data; name="file"; filename="test.txt"\r\nContent-Type: text/plain\r\n\r\nfile data here\r\n------test123--\r\n';
    const buf = Buffer.from(body);
    const result = h.parseMultipartFile(buf, boundary);
    expect(result).not.toBeNull();
    expect(result.name).toBe('file');
    expect(result.filename).toBe('test.txt');
    expect(result.mime).toBe('text/plain');
    expect(result.data.toString()).toContain('file data here');
  });

  it('returns null for missing delimiter', () => {
    expect(h.parseMultipartFile(Buffer.from('no delimiter'), 'boundary')).toBeNull();
  });

  it('returns null for missing header end', () => {
    const boundary = '----test';
    const body = '------test\r\nContent-Disposition: form-data; name="file"\r\nno-header-end';
    expect(h.parseMultipartFile(Buffer.from(body), boundary)).toBeNull();
  });

  it('returns null for missing Content-Disposition', () => {
    const boundary = '----test';
    const body = '------test\r\nContent-Type: text/plain\r\n\r\ndata\r\n------test--\r\n';
    expect(h.parseMultipartFile(Buffer.from(body), boundary)).toBeNull();
  });
});

describe('helpers — clamp', () => {
  it('clamps value between min and max', () => {
    expect(h.clamp(5, 0, 10)).toBe(5);
    expect(h.clamp(-5, 0, 10)).toBe(0);
    expect(h.clamp(15, 0, 10)).toBe(10);
  });
});

describe('helpers — statusToLabel', () => {
  it('returns Location for location', () => {
    expect(h.statusToLabel('location')).toBe('Location');
  });

  it('returns Vente for vente', () => {
    expect(h.statusToLabel('vente')).toBe('Vente');
  });

  it('returns Vente for anything else', () => {
    expect(h.statusToLabel('')).toBe('Vente');
    expect(h.statusToLabel(null)).toBe('Vente');
  });
});

describe('helpers — scoreToConfidenceLabel', () => {
  it('returns Elevee for >= 80', () => {
    expect(h.scoreToConfidenceLabel(80)).toBe('Elevee');
    expect(h.scoreToConfidenceLabel(100)).toBe('Elevee');
  });

  it('returns Moyenne for 60-79', () => {
    expect(h.scoreToConfidenceLabel(60)).toBe('Moyenne');
    expect(h.scoreToConfidenceLabel(79)).toBe('Moyenne');
  });

  it('returns Faible for < 60', () => {
    expect(h.scoreToConfidenceLabel(59)).toBe('Faible');
    expect(h.scoreToConfidenceLabel(0)).toBe('Faible');
  });
});

describe('helpers — escapeAttr', () => {
  it('escapes HTML entities', () => {
    expect(h.escapeAttr('a&b"c<d>e')).toBe('a&amp;b&quot;c&lt;d&gt;e');
  });

  it('handles null/undefined', () => {
    expect(h.escapeAttr(null)).toBe('');
    expect(h.escapeAttr(undefined)).toBe('');
  });
});

describe('helpers — toCsvFromObjects', () => {
  it('creates CSV from array of objects', () => {
    const rows = [{ a: 1, b: 'hello' }, { a: 2, b: 'world' }];
    const csv = h.toCsvFromObjects(rows);
    expect(csv).toContain('"a","b"');
    expect(csv).toContain('"1","hello"');
    expect(csv).toContain('"2","world"');
  });

  it('uses preferred columns', () => {
    const rows = [{ a: 1, b: 2, c: 3 }];
    const csv = h.toCsvFromObjects(rows, ['a', 'c']);
    expect(csv).toContain('"a","c"');
    expect(csv).not.toContain('"b"');
  });

  it('returns empty string for empty array', () => {
    expect(h.toCsvFromObjects([])).toBe('');
  });

  it('returns empty string for non-array', () => {
    expect(h.toCsvFromObjects(null)).toBe('');
  });

  it('escapes quotes in values', () => {
    const rows = [{ a: 'say "hello"' }];
    const csv = h.toCsvFromObjects(rows);
    expect(csv).toContain('"say ""hello"""');
  });
});

describe('helpers — expandLocationTerms', () => {
  it('returns canonical + synonyms for known alias', () => {
    const terms = h.expandLocationTerms('hay riad');
    expect(terms).toContain('hay riad');
    expect(terms).toContain('riyad');
  });

  it('returns synonym list when input is a synonym', () => {
    const terms = h.expandLocationTerms('riyad');
    expect(terms).toContain('hay riad');
    expect(terms).toContain('riyad');
  });

  it('returns original value for unknown location', () => {
    const terms = h.expandLocationTerms('unknown place');
    expect(terms).toEqual(['unknown place']);
  });

  it('returns empty string for empty input', () => {
    const terms = h.expandLocationTerms('');
    expect(terms).toEqual(['']);
  });
});
