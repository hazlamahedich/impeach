import { describe, it, expect } from 'vitest';
import { hello, packageName } from '@iip/db';

describe('@iip/db', () => {
  it('hello() reports alive from the package entry point (AC-F1-03)', () => {
    expect(packageName).toBe('@iip/db');
    expect(hello()).toBe('alive: @iip/db');
  });
});
