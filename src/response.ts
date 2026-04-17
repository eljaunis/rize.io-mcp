import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { toFailureEnvelope } from './errors.js';
import type { SuccessEnvelope } from './types.js';

export function toSuccessResult<T>(data: T): CallToolResult {
  const envelope: SuccessEnvelope<T> = {
    ok: true,
    data,
  };

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(envelope, null, 2),
      },
    ],
    structuredContent: envelope as unknown as Record<string, unknown>,
  };
}

export function toFailureResult(error: unknown): CallToolResult {
  const envelope = toFailureEnvelope(error);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(envelope, null, 2),
      },
    ],
    isError: true,
    structuredContent: envelope as unknown as Record<string, unknown>,
  };
}
