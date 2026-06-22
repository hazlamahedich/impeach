import { describe, it, expect } from 'vitest';
import { hello, packageName } from '@iip/citation';

describe('@iip/citation', () => {
  it('hello() reports alive from the package entry point (AC-F1-03)', () => {
    expect(packageName).toBe('@iip/citation');
    expect(hello()).toBe('alive: @iip/citation');
  });
});
