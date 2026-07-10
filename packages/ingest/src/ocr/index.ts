/**
 * OcrPort — the OCR boundary interface per ADR-006 (SC-5).
 *
 * Defines the contract for PDF/image text extraction via Docling +
 * PaddleOCR-VL. The port is an interface (not an abstract class) because it
 * has a single method and no shared state — the registry pattern is not
 * needed here (only one OCR backend in v1).
 *
 * **OCR latency (ADR-006):** PaddleOCR on Mac arm64 is CPU-only (no Metal
 * backend) — minutes per page. Worker timeout configuration MUST accommodate
 * this. FA-8's `AbortSignal` pattern covers HTTP timeouts; OCR timeouts need
 * separate handling (a per-document timeout, not a per-request timeout).
 *
 * **FA-7 compliance:** the OCR output text MUST be a faithful containment of
 * the source. A fabricated character in a cleaned doc becomes a "quote" from
 * a source — defamation-adjacent. The `spans` field carries character offsets
 * for substring-containment verification.
 *
 * v1 ships a stub implementation (`StubOcrAdapter`) that decodes UTF-8 text
 * from the raw bytes (sufficient for contract tests where the "PDF" is a
 * text buffer). The real Docling+PaddleOCR-VL wiring lands at the integration
 * level with real PDF fixtures.
 *
 * @rules FR-1.3, AC-2, ADR-006, FA-7
 * @adr ADR-006
 */

/**
 * A single OCR page result: extracted text + character spans.
 *
 * `spans` carry `{ start, end }` character offsets into `text` for
 * substring-containment verification (FA-7). The spans allow the cleaner to
 * verify that every character in the output is traceable to the source image.
 */
export interface OcrPage {
  text: string;
  spans: { start: number; end: number }[];
}

/**
 * The result of OCR processing: an array of pages.
 */
export interface OcrResult {
  pages: OcrPage[];
}

/**
 * The input to OCR: raw document bytes + content type.
 */
export interface OcrInput {
  rawBytes: Uint8Array;
  contentType: string;
}

/**
 * OcrPort — the OCR boundary interface (SC-5, ADR-006).
 *
 * Every OCR backend implements this interface. The ingest worker injects the
 * implementation; tests inject a stub.
 *
 * @rules ADR-006, SC-5, FA-7
 */
export interface OcrPort {
  /**
   * Extract text from a document (PDF, image).
   *
   * @param input - the raw document bytes + content type
   * @returns the OCR result: an array of pages with text + spans
   */
  ocr(input: OcrInput): Promise<OcrResult>;
}

/**
 * StubOcrAdapter — a v1 placeholder that decodes UTF-8 text from raw bytes.
 *
 * Sufficient for contract tests where the "PDF" is a text buffer. The real
 * Docling+PaddleOCR-VL wiring lands at the integration level with real PDF
 * fixtures (ADR-006 Task 3).
 *
 * @rules ADR-006, FA-7
 */
export class StubOcrAdapter implements OcrPort {
  async ocr(input: OcrInput): Promise<OcrResult> {
    const text = new TextDecoder().decode(input.rawBytes);
    return {
      pages: [
        {
          text,
          spans: [{ start: 0, end: text.length }],
        },
      ],
    };
  }
}
