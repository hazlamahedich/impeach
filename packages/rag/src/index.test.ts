import { describe, it, expect } from 'vitest';
import { hello, packageName } from '@iip/rag';

describe('@iip/rag', () => {
  it('hello() reports alive from the package entry point (AC-F1-03)', () => {
    expect(packageName).toBe('@iip/rag');
    expect(hello()).toBe('alive: @iip/rag');
  });
});
