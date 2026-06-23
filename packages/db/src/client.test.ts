/**
 * Unit tests for createDb() / closeDb().
 *
 * @rules AC-1
 * @adr ADR-002
 */

import { describe, it, expect } from 'vitest';
import { createDb, closeDb } from './client.js';

describe('createDb', () => {
  it('creates a handle with db and pool properties', () => {
    const handle = createDb('postgres://user:pass@localhost:5432/testdb');
    expect(handle).toHaveProperty('db');
    expect(handle).toHaveProperty('pool');
    expect(handle.pool).toBeDefined();
    expect(handle.db).toBeDefined();
  });

  it('throws on non-postgres URLs', () => {
    expect(() => createDb('mysql://user:pass@localhost/db')).toThrow(
      'postgres:// or postgresql://',
    );
    expect(() => createDb('http://localhost:5432')).toThrow(
      'postgres:// or postgresql://',
    );
    expect(() => createDb('')).toThrow('postgres:// or postgresql://');
  });

  it('throws on search_path with space after comma', () => {
    const url =
      'postgres://user:pass@localhost:5432/testdb?options=-c%20search_path%3Dag_catalog%2C%20public';
    expect(() => createDb(url)).toThrow('must not contain a space');
  });

  it('accepts search_path without space after comma', () => {
    const url =
      'postgres://user:pass@localhost:5432/testdb?options=-c%20search_path%3Dag_catalog%2Cpublic';
    expect(() => createDb(url)).not.toThrow();
  });

  it('accepts plain postgres URL without search_path', () => {
    expect(() =>
      createDb('postgres://user:pass@localhost:5432/testdb'),
    ).not.toThrow();
  });

  it('overrides default pool options via opts', () => {
    const handle = createDb('postgres://user:pass@localhost:5432/testdb', {
      max: 5,
    });
    expect((handle.pool as unknown as { options: { max?: number } }).options.max).toBe(5);
  });

  it('connectionUrl wins over opts.connectionString', () => {
    const handle = createDb('postgres://correct:pass@localhost:5432/correct', {
      connectionString: 'postgres://wrong:pass@localhost:5432/wrong',
    });
    // The pool's connectionString should be the explicit URL, not opts
    const poolOptions = (handle.pool as unknown as { options: { connectionString?: string } }).options;
    expect(poolOptions.connectionString).toBe(
      'postgres://correct:pass@localhost:5432/correct',
    );
  });
});

describe('closeDb', () => {
  it('ends the pool without throwing', async () => {
    const handle = createDb('postgres://user:pass@localhost:5432/testdb');
    await expect(closeDb(handle)).resolves.not.toThrow();
  });
});
