/**
 * Editorial package smoke test (SEC-6).
 *
 * @rules SEC-6
 */
import { describe, it, expect } from 'vitest';
import { packageName } from './index.js';

describe('@iip/editorial package', () => {
  it('exports package name', () => {
    expect(packageName).toBe('@iip/editorial');
  });
});
