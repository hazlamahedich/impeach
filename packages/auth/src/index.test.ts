import { describe, it, expect } from 'vitest';
import { hello, packageName } from '@iip/auth';

describe('@iip/auth', () => {
  it('hello() reports alive from the package entry point (AC-F1-03)', () => {
    expect(packageName).toBe('@iip/auth');
    expect(hello()).toBe('alive: @iip/auth');
  });
});
