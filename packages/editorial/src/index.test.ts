import { describe, it, expect } from 'vitest';
import { hello, packageName } from '@iip/editorial';

describe('@iip/editorial', () => {
  it('hello() reports alive from the package entry point (AC-F1-03)', () => {
    expect(packageName).toBe('@iip/editorial');
    expect(hello()).toBe('alive: @iip/editorial');
  });
});
