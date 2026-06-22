import { describe, it, expect } from 'vitest';
import { hello, packageName } from '@iip/eval';

describe('@iip/eval', () => {
  it('hello() reports alive from the package entry point (AC-F1-03)', () => {
    expect(packageName).toBe('@iip/eval');
    expect(hello()).toBe('alive: @iip/eval');
  });
});
