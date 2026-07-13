import { describe, it, expect } from 'vitest';
import { createDb, intakeDocuments } from '@iip/db';

describe('@iip/db', () => {
  it('exports the Drizzle schema and client factory (AC #4)', () => {
    expect(typeof createDb).toBe('function');
    // Drizzle pgTable returns an object with the column map + table config.
    // compatibility_probe (Story 1.2 scaffolding) was removed once real tables
    // existed; intakeDocuments proves the schema barrel is wired.
    expect(intakeDocuments).toBeDefined();
    expect(intakeDocuments.id).toBeDefined();
    expect(intakeDocuments.content_hash).toBeDefined();
    expect(intakeDocuments.created_at).toBeDefined();
  });
});
