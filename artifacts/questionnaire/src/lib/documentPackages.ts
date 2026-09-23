/**
 * What the firm sells, and therefore what the generator offers.
 *
 * Transcribed from the firm's own fee schedules — "2026 Estate Planning -
 * Single.pdf" and "2026 Estate Planning - Couple.pdf". Those two sheets are the
 * definition of a "package": four individual documents, and two bundles built
 * out of them. Keep this file in step with the schedules; nothing else should
 * hardcode a document list.
 *
 * The couple column is not a different product — it is the same set produced
 * twice, once per spouse, which is why every couple price is exactly double
 * except the packages, which carry their own bundled discount.
 */

export type DocumentId = 'standard_will' | 'tt_will' | 'epa' | 'acd';

export type DocumentDefinition = {
  id: DocumentId;
  label: string;
  description: string;
  /**
   * Template key understood by /api/generate-document, or null when the firm
   * has not supplied a precedent yet. A null here is why the UI shows the
   * document greyed out rather than hiding it — the lawyer should see that the
   * package is incomplete, not silently get two of three documents.
   */
  templateType: string | null;
  /** Clio custom field names this document needs before it reads as complete. */
  requiredFields: string[];
  price: { single: number; couple: number };
};

export type PackageDefinition = {
  id: string;
  label: string;
  documents: DocumentId[];
  price: { single: number; couple: number };
};

export const DOCUMENTS: DocumentDefinition[] = [
  {
    id: 'standard_will',
    label: 'Standard Will',
    description: 'Allows for 5 specific gifts. Further fee applies beyond that.',
    templateType: 'simple_will',
    requiredFields: ['InitialExecutor', 'BackupExecutor', 'Beneficiary1', 'Jurisdiction'],
    price: { single: 495, couple: 990 },
  },
  {
    id: 'tt_will',
    label: 'Will with Testamentary Trust',
    description:
      'A Standard Will plus a discretionary trust arising on death. Where more than one trust is required, use the Multi TT template.',
    // The fee schedule sells one testamentary trust; multi-TT is the
    // "further fee may be charged" case and uses multi_tt_will instead.
    templateType: 'single_tt_will',
    requiredFields: [
      'InitialExecutor',
      'BackupExecutor',
      'InitialTrusteeTt1',
      'InitialAppointorTt1',
      'NominatedBeneficiaryTt1',
      'Jurisdiction',
    ],
    price: { single: 1595, couple: 3190 },
  },
  {
    id: 'epa',
    label: 'Enduring Power of Attorney',
    description: 'Appoints an attorney over financial affairs on loss of capacity.',
    // No precedent in api/templates yet — awaiting it from the firm.
    templateType: null,
    requiredFields: [],
    price: { single: 295, couple: 590 },
  },
  {
    id: 'acd',
    label: 'Advance Care Directive',
    description: 'Appoints a substitute decision-maker for health and living decisions.',
    // No precedent in api/templates yet — awaiting it from the firm.
    templateType: null,
    requiredFields: [],
    price: { single: 495, couple: 990 },
  },
];

export const PACKAGES: PackageDefinition[] = [
  {
    id: 'standard_will_package',
    label: 'Standard Will Package',
    documents: ['standard_will', 'epa', 'acd'],
    price: { single: 1195, couple: 2390 },
  },
  {
    id: 'tt_will_package',
    label: 'Will with Testamentary Trust Package',
    documents: ['tt_will', 'epa', 'acd'],
    price: { single: 2150, couple: 4300 },
  },
];

/** The two packages differ only in which will they carry; they never stack. */
export const WILL_DOCUMENT_IDS: DocumentId[] = ['standard_will', 'tt_will'];

export function getDocument(id: DocumentId): DocumentDefinition {
  const found = DOCUMENTS.find((doc) => doc.id === id);
  if (!found) throw new Error(`Unknown document: ${id}`);
  return found;
}

export function formatPrice(amount: number): string {
  return `$${amount.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Total for a selection, using the package price when the selection is one.
 *
 * The generation screen no longer shows prices — kept because the figures are
 * a faithful transcription of the firm's fee schedule and the package-vs-
 * individual rule is the non-obvious part to rebuild.
 */
export function priceSelection(selected: DocumentId[], isCouple: boolean): number {
  const key = isCouple ? 'couple' : 'single';
  const matchingPackage = PACKAGES.find(
    (pkg) =>
      pkg.documents.length === selected.length &&
      pkg.documents.every((id) => selected.includes(id)),
  );
  if (matchingPackage) return matchingPackage.price[key];
  return selected.reduce((total, id) => total + getDocument(id).price[key], 0);
}

/**
 * Which of a document's required Clio fields are still empty.
 *
 * A matter created directly in Clio — rather than through the intake form —
 * has a name and little else, so this is how the lawyer finds out before
 * generating rather than after reading the draft.
 */
export function missingFieldsFor(
  selected: DocumentId[],
  customFields: Record<string, string> | null | undefined,
): string[] {
  const present = customFields || {};
  const required = new Set<string>();
  for (const id of selected) {
    for (const field of getDocument(id).requiredFields) required.add(field);
  }
  return [...required].filter((field) => {
    const value = present[field];
    return value === undefined || value === null || String(value).trim() === '';
  });
}

/** Completeness across every field any document might need, for the table badge. */
export function completenessFor(customFields: Record<string, string> | null | undefined): {
  filled: number;
  total: number;
} {
  const allFields = new Set<string>();
  for (const doc of DOCUMENTS) {
    for (const field of doc.requiredFields) allFields.add(field);
  }
  const present = customFields || {};
  const filled = [...allFields].filter(
    (field) => present[field] !== undefined && String(present[field]).trim() !== '',
  ).length;
  return { filled, total: allFields.size };
}
