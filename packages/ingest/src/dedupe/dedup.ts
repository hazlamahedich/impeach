/**
 * deduplicateDocuments — the application-level dedup routine (FR-1.3, AC-3).
 *
 * Groups documents by `contentChecksum`; the first occurrence of each
 * checksum is emitted as `unique`, subsequent occurrences are emitted as
 * `duplicates` with `duplicateOf = first.url`. This is the pure dedup
 * decision layer — the DB-level upsert (`upsertLastWriteWins` on
 * `documents.content_checksum`) is the atomic resolver.
 *
 * **Dedup is defamation-adjacent (FR-1.3):** processing the same document
 * twice creates duplicate provenance chains that confuse retraction
 * propagation. The `content_checksum` must be the single dedup anchor — a
 * document with the same cleaned text is the same document, regardless of
 * which URL it was fetched from.
 *
 * This function is PURE: no I/O, no side effects, no DB access. It operates
 * on an in-memory array of documents carrying `{ url, contentChecksum }`.
 * The DB-level dedup (unique index + upsert) is a separate concern owned by
 * `@iip/db`.
 *
 * @rules FR-1.3, AC-3, FA-4, FA-5
 * @adr ADR-001
 */

/**
 * The minimal document shape `deduplicateDocuments` operates on.
 *
 * `url` is the source URL (used as the `duplicateOf` reference). `contentChecksum`
 * is the SHA-256 of the cleaned text — the dedup anchor. `cleanedText` is
 * carried through for convenience but is NOT part of the dedup key.
 */
export interface DedupDocument {
  url: string;
  cleanedText?: string;
  contentChecksum: string;
}

/**
 * A duplicate entry: maps a duplicate document to its original occurrence.
 */
export interface DuplicateEntry {
  /** The URL of the first document with this content checksum. */
  duplicateOf: string;
  /** The URL of the duplicate document that was dropped. */
  url: string;
  /** The content checksum that triggered the duplicate decision. */
  contentChecksum: string;
}

/**
 * The result of deduplication.
 *
 * `unique` — documents with distinct contentChecksums (first occurrence wins).
 * `duplicates` — documents whose contentChecksum was already seen; each maps
 * to the URL of its original occurrence (`duplicateOf = original.url`).
 */
export interface DedupResult<T extends DedupDocument = DedupDocument> {
  unique: T[];
  duplicates: DuplicateEntry[];
}

/**
 * Deduplicate documents by `contentChecksum` (FR-1.3, AC-3).
 *
 * First occurrence wins: the first document with a given checksum is emitted
 * in `unique`; every subsequent document with the same checksum is emitted in
 * `duplicates` with `duplicateOf` pointing to the first document's URL.
 *
 * @param docs - the documents to deduplicate
 * @returns `{ unique, duplicates }` — the deduplicated set + the duplicate list
 *
 * @rules FR-1.3, AC-3, FA-4, FA-5
 */
export function deduplicateDocuments<T extends DedupDocument>(docs: T[]): DedupResult<T> {
  const seen = new Map<string, string>(); // checksum → first.url
  const unique: T[] = [];
  const duplicates: DuplicateEntry[] = [];

  for (const doc of docs) {
    const firstUrl = seen.get(doc.contentChecksum);
    if (firstUrl === undefined) {
      // First occurrence — emit as unique.
      seen.set(doc.contentChecksum, doc.url);
      unique.push(doc);
    } else {
      // Duplicate — map to the original's URL and record the duplicate's
      // identity so triage/audit can reconstruct what was dropped.
      duplicates.push({ duplicateOf: firstUrl, url: doc.url, contentChecksum: doc.contentChecksum });
    }
  }

  return { unique, duplicates };
}
