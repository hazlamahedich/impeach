import { describe, it, expect } from 'vitest';
import { hello, packageName } from '@iip/render';

describe('@iip/render', () => {
  it('hello() reports alive from the package entry point (AC-F1-03)', () => {
    expect(packageName).toBe('@iip/render');
    expect(hello()).toBe('alive: @iip/render');
  });
});
