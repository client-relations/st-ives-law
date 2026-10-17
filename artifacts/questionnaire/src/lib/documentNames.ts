import type { DocumentId } from './documentPackages';

/**
 * File names for generated documents, as filed to the Clio matter.
 *
 * St Ives' convention (CR 2026-10-14): "<yymmdd> DRAFT <kind> - <full name>",
 * e.g. "261014 DRAFT Will - Isuru Abeysekara". The date is the generation date
 * at the firm, in Adelaide: Vercel runs in UTC, which is still the previous
 * day for the first ten-odd hours of every Adelaide morning.
 */

export const FIRM_TIME_ZONE = 'Australia/Adelaide';

/** The kind each document carries in its file name. */
const DRAFT_KINDS: Record<DocumentId, string | undefined> = {
  standard_will: 'Will',
  tt_will: 'Will',
  epa: 'POA',
  acd: 'ACD',
};

/** "261014" for 14 October 2026 at the firm. */
export function firmDateStamp(now: Date): string {
  const parts: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat('en-AU', {
    timeZone: FIRM_TIME_ZONE,
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)) {
    parts[part.type] = part.value;
  }
  return `${parts.year}${parts.month}${parts.day}`;
}

/**
 * The file name for one generated document. For a couple each spouse's copy is
 * named for that spouse, so the caller passes the person the document is for.
 */
export function documentFileName(documentId: DocumentId, label: string, fullName: string, now: Date): string {
  const name = fullName.replace(/\s+/g, ' ').trim();
  const kind = DRAFT_KINDS[documentId];
  // TODO(PENDING: Ces is sending the naming conventions) for the testamentary
  // trust, special disability trust, letter of wishes and other documents.
  // Until then anything without a kind keeps its old name.
  if (!kind) return `${label} — ${name}`;
  return `${firmDateStamp(now)} DRAFT ${kind} - ${name}`;
}
