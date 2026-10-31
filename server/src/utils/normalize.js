/**
 * Word normalization (see docs/NORMALIZATION.md):
 *  1. Unicode NFC so "café" typed two ways compares equal.
 *  2. Trim + collapse internal whitespace runs to one space.
 *  3. Lowercase.
 * Accents, hyphens, apostrophes and punctuation are PRESERVED so distinct words are never merged.
 */
export function normalizeWord(input) { return String(input ?? '').normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase(); }
export function cleanDisplayWord(input) { return String(input ?? '').normalize('NFC').trim().replace(/\s+/g, ' '); }
export const normalizeEmail = (e) => String(e ?? '').normalize('NFKC').trim().toLowerCase();
export const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
