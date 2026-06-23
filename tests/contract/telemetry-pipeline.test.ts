/**
 * VAL-9 Telemetry Pipeline Validation Stub
 *
 * @rules VAL-9, SEC-5, NFR-O-1
 * @adr ADR-001
 *
 * EMPTY HULL — Foundation Action Plan P5.
 *
 * Validates that the OpenTelemetry pipeline works end-to-end BEFORE the
 * render gate is implemented. A "hello world" span from a stub service
 * through the OTel collector into Tempo, asserted in CI.
 *
 * The full invariant: gate-invocation-per-served-response under queue
 * pressure. OTel span on gate() + collector (Tempo) + assertion:
 * gate_span_count == served_response_count under BullMQ backpressure.
 *
 * Prerequisites:
 *   - OTel Collector service in Docker Compose (Story 1.3)
 *   - Tempo service in Docker Compose (Story 1.3)
 *   - @opentelemetry/api + @opentelemetry/sdk-node installed
 *
 * When implementing:
 *   1. Export a span: tracer.startActiveSpan('iip.gate', (span) => { ... })
 *   2. Send to collector via OTLP
 *   3. Query Tempo API for the span
 *   4. Assert span exists with correct name + attributes
 */

import { describe, it, expect } from 'vitest';

describe('VAL-9 Telemetry Pipeline — STUB', () => {
  it('placeholder: OTel pipeline not yet wired', () => {
    // Track the requirement. Replace with real span → Tempo assertion.
    expect(true).toBe(true);
  });
});
