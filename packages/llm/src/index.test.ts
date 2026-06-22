import { describe, it, expect } from 'vitest';
import { hello, packageName } from '@iip/llm';

describe('@iip/llm', () => {
  it('hello() reports alive from the package entry point (AC-F1-03)', () => {
    expect(packageName).toBe('@iip/llm');
    expect(hello()).toBe('alive: @iip/llm');
  });
});
