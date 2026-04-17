import { describe, expect, it } from 'vitest';
import { analysisInputSchema, summariesInputSchema } from '../src/schemas.js';

describe('input schemas', () => {
  it('rejects invalid date ranges', () => {
    const result = summariesInputSchema.safeParse({
      endDate: '2026-04-01',
      startDate: '2026-04-30',
    });

    expect(result.success).toBe(false);
  });

  it('applies defaults for analysis requests', () => {
    const result = analysisInputSchema.parse({
      endDate: '2026-04-15',
      prompt: 'Analyze team focus trends',
      startDate: '2026-04-01',
    });

    expect(result.bucketSize).toBe('day');
    expect(result.limit).toBeUndefined();
  });
});
