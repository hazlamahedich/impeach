import { describe, it, expect } from 'vitest';
import { createDb, compatibilityProbe } from '@iip/db';

describe('@iip/db', () => {
  it('exports the Drizzle schema and client factory (AC #4)', () => {
    expect(typeof createDb).toBe('function');
    // Drizzle pgTable returns an object with the column map + table config
    expect(compatibilityProbe).toBeDefined();
    expect(compatibilityProbe.id).toBeDefined();
    expect(compatibilityProbe.label).toBeDefined();
    expect(compatibilityProbe.createdAt).toBeDefined();
  });
});
