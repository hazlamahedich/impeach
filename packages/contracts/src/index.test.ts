import { describe, it, expect } from 'vitest';
import { hello, packageName } from '@iip/contracts';

describe('@iip/contracts', () => {
  it('hello() reports alive from the package entry point (AC-F1-03)', () => {
    expect(packageName).toBe('@iip/contracts');
    expect(hello()).toBe('alive: @iip/contracts');
  });
});
