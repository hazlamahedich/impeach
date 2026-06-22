import { describe, it, expect } from 'vitest';
import { hello, packageName } from '@iip/config';

describe('@iip/config', () => {
  it('hello() reports alive from the package entry point (AC-F1-03)', () => {
    expect(packageName).toBe('@iip/config');
    expect(hello()).toBe('alive: @iip/config');
  });
});
