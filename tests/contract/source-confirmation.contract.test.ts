/**
 * Story 3.1 — Source trust-tier confirmation contract test (ATDD RED phase).
 *
 * Coverage gap from the Epic 3 test-design (R3.1a, SEC-3): the existing SC-1..5
 * scaffolds assert the routes persist a confirmed tier, but NONE lock the zod
 * contract semantics that `confirmed: true` must carry validation evidence —
 * not be self-declared. SEC-3 requires the trust tier to be assigned AT INGEST
 * and confirmed via source-authenticity validation, not operator assertion.
 *
 * A self-declared tier persisted as `confirmed: true` lets a Tier-3 aggregator
 * be served as Tier-1 fact, breaking the EI-2 fact/claim boundary. This is
 * defamation-adjacent: an allegation from an unverified source rendered as
 * established fact.
 *
 * The `SourceRegistrationSchema` (with confirmation-evidence refinement) does
 * NOT EXIST YET — `packages/contracts/src/ingest.ts` defines the identity +
 * enum schemas but not the registration payload with SEC-3 confirmation
 * semantics. This suite is RED by design (describe.skip) until Story 3.1
 * ships the schema.
 *
 * @rules FR-1.1, SEC-3, EI-8
 * @adr ADR-001
 * @activates-in Epic 3 (Story 3.1 — SourceRegistrationSchema with confirmation-evidence refinement)
 *
 * GIVEN the operator registers a source
 * WHEN trust_tier is assigned
 * THEN confirmed=true requires validation evidence (not self-declared) (SEC-3)
 *   AND a source without confirmation evidence is persisted confirmed=false
 *   AND confirmation evidence records the validating principal + timestamp
 */

import { describe, it, expect } from 'vitest';
import { SourceSourceType, CrawlStrategy } from '@iip/contracts';

// ─── RED-PHASE STUB ────────────────────────────────────────────────────────
// Story 3.1 has not shipped `SourceRegistrationSchema` yet. Dynamic import lets
// the suite COLLECT. Once the schema lands, remove `describe.skip` + the wrapper.
async function loadSourceRegistrationSchema() {
  // Variable specifier so Vite cannot statically resolve a symbol absent from
  // the package exports (Story 3.1 schema not shipped yet). The catch keeps the
  // suite GREEN at collection; describe.skip quarantines the body.
  const specifier = '@iip/contracts/source-registration';
  return import(specifier).catch(() => null);
}

describe.skip('Story 3.1 — Source trust-tier confirmation contract (ATDD RED)', () => {
  // A canonical registration with full confirmation evidence.
  const confirmedRegistration = {
    name: 'Senate Press Office',
    url: 'https://www.senate.gov/press',
    source_type: SourceSourceType.parse('press_release'),
    crawl_strategy: CrawlStrategy.parse('rss'),
    trust_tier: 1 as const,
    confirmed: true,
    confirmation_evidence: {
      validated_by: 'operator-002',
      validated_at: '2026-07-08T10:00:00Z',
      validation_method: 'domain_ownership' as const,
    },
    original_publisher: 'Senate Press Office',
  };

  // ─────────────────────────────────────────────────────────────────────────
  // SEC-3: confirmed=true REQUIRES validation evidence (not self-declared)
  // ─────────────────────────────────────────────────────────────────────────

  it('[P0] SCF-1: confirmed=true with validation evidence parses successfully', async () => {
    const mod = await loadSourceRegistrationSchema();
    const schema = mod?.SourceRegistrationSchema;
    // When: a registration carries confirmation evidence.
    const result = schema ? schema.safeParse(confirmedRegistration) : undefined;
    // Then: it parses, and the confirmed flag + evidence are preserved.
    expect(result?.success).toBe(true);
    if (result?.success) {
      expect(result.data.confirmed).toBe(true);
      expect(result.data.confirmation_evidence?.validated_by).toBe('operator-002');
    }
  });

  it('[P0] SCF-2: confirmed=true WITHOUT confirmation_evidence is REJECTED (SEC-3)', async () => {
    const mod = await loadSourceRegistrationSchema();
    const schema = mod?.SourceRegistrationSchema;
    // Given: a registration that claims confirmed=true but provides NO evidence.
    const selfDeclared = { ...confirmedRegistration };
    delete (selfDeclared as { confirmation_evidence?: unknown }).confirmation_evidence;
    // When: the schema parses it.
    const result = schema ? schema.safeParse(selfDeclared) : undefined;
    // Then: REJECTED — confirmed=true without evidence is self-declaration (SEC-3 violation).
    expect(result?.success).toBe(false);
  });

  it('[P0] SCF-3: confirmed=false WITHOUT confirmation_evidence is ACCEPTED (pending validation)', async () => {
    const mod = await loadSourceRegistrationSchema();
    const schema = mod?.SourceRegistrationSchema;
    // Given: a registration that is honestly unconfirmed (pending validation).
    const pending = { ...confirmedRegistration, confirmed: false };
    delete (pending as { confirmation_evidence?: unknown }).confirmation_evidence;
    // When: the schema parses it.
    const result = schema ? schema.safeParse(pending) : undefined;
    // Then: ACCEPTED — unconfirmed sources are valid; they just don't feed the graph yet.
    expect(result?.success).toBe(true);
    if (result?.success) {
      expect(result.data.confirmed).toBe(false);
    }
  });

  it('[P1] SCF-4: confirmation_evidence requires validated_by principal (not a default)', async () => {
    const mod = await loadSourceRegistrationSchema();
    const schema = mod?.SourceRegistrationSchema;
    // Given: evidence missing the validating principal (SEC-6 — no default on WHO).
    const noPrincipal = {
      ...confirmedRegistration,
      confirmation_evidence: {
        validated_at: '2026-07-08T10:00:00Z',
        validation_method: 'domain_ownership',
      },
    };
    // When: the schema parses it.
    const result = schema ? schema.safeParse(noPrincipal) : undefined;
    // Then: REJECTED — a confirmation with no validating principal is fabricated attribution.
    expect(result?.success).toBe(false);
  });

  it('[P1] SCF-5: trust_tier must be in the closed set {1, 2, 3} (SEC-3 structural)', async () => {
    const mod = await loadSourceRegistrationSchema();
    const schema = mod?.SourceRegistrationSchema;
    // Given: a registration with an out-of-set tier.
    const badTier = { ...confirmedRegistration, trust_tier: 4 };
    // When: the schema parses it.
    const result = schema ? schema.safeParse(badTier) : undefined;
    // Then: REJECTED — the tier set is closed (mirrors the DB CHECK constraint).
    expect(result?.success).toBe(false);
  });
});
