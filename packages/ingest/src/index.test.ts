import { describe, it, expect } from 'vitest';
import { hello, packageName } from '@iip/ingest';

describe('@iip/ingest', () => {
  it('hello() reports alive from the package entry point (AC-F1-03)', () => {
    expect(packageName).toBe('@iip/ingest');
    expect(hello()).toBe('alive: @iip/ingest');
  });
});
