import { describe, it, expect } from 'vitest';
import { hello, packageName } from '@iip/graph';

describe('@iip/graph', () => {
  it('hello() reports alive from the package entry point (AC-F1-03)', () => {
    expect(packageName).toBe('@iip/graph');
    expect(hello()).toBe('alive: @iip/graph');
  });
});
