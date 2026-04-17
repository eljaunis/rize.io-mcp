import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const dateField = z
  .string()
  .regex(dateRegex, 'Expected date in YYYY-MM-DD format');

const idArray = z
  .array(z.string().min(1))
  .max(100)
  .optional()
  .describe('Optional ID filter list');

const limitField = z
  .number()
  .int()
  .min(1)
  .max(500)
  .default(50)
  .describe('Maximum number of records to return');

const optionalLimitField = z
  .number()
  .int()
  .min(1)
  .max(500)
  .optional()
  .describe('Maximum number of records to return');

function validateDateRange(
  value: { endDate: string; startDate: string },
  ctx: z.core.$RefinementCtx
) {
  if (value.startDate <= value.endDate) {
    return;
  }

  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message: 'startDate must be less than or equal to endDate',
    path: ['startDate'],
  });
}

export const emptyInputSchema = z.object({});

export const clientListInputSchema = z.object({
  limit: limitField.optional(),
});

export const projectListInputSchema = z.object({
  clientIds: idArray.describe('Optional client IDs to include'),
  limit: limitField.optional(),
});

export const taskListInputSchema = z.object({
  limit: limitField.optional(),
  projectIds: idArray.describe('Optional project IDs to include'),
});

export const summariesInputSchema = z
  .object({
    bucketSize: z
      .enum(['day', 'week', 'month'])
      .default('day')
      .describe('Summary bucket size'),
    endDate: dateField,
    startDate: dateField,
  })
  .superRefine(validateDateRange);

export const timeEntriesInputSchema = z
  .object({
    clientIds: idArray.describe('Optional client IDs to include'),
    endDate: dateField,
    limit: optionalLimitField,
    projectIds: idArray.describe('Optional project IDs to include'),
    startDate: dateField,
    taskIds: idArray.describe('Optional task IDs to include'),
  })
  .superRefine(validateDateRange);

export const sessionsInputSchema = z
  .object({
    clientIds: idArray.describe('Optional client IDs to include'),
    endDate: dateField,
    limit: optionalLimitField,
    projectIds: idArray.describe('Optional project IDs to include'),
    startDate: dateField,
    taskIds: idArray.describe('Optional task IDs to include'),
  })
  .superRefine(validateDateRange);

export const analysisInputSchema = z
  .object({
    bucketSize: z
      .enum(['day', 'week', 'month'])
      .default('day')
      .describe('Summary bucket size'),
    clientIds: idArray.describe('Optional client IDs to include'),
    endDate: dateField,
    limit: optionalLimitField,
    projectIds: idArray.describe('Optional project IDs to include'),
    prompt: z
      .string()
      .min(8)
      .max(2000)
      .describe('Natural-language analysis request for Claude'),
    startDate: dateField,
    taskIds: idArray.describe('Optional task IDs to include'),
  })
  .superRefine(validateDateRange);

export const questionAnswerInputSchema = z
  .object({
    clientIds: idArray.describe('Optional client IDs to include'),
    endDate: dateField,
    grain: z
      .enum(['day', 'week', 'month'])
      .optional()
      .describe('Optional reporting grain hint'),
    projectIds: idArray.describe('Optional project IDs to include'),
    question: z
      .string()
      .min(8)
      .max(2000)
      .describe('Natural-language reporting or time question'),
    startDate: dateField,
    taskIds: idArray.describe('Optional task IDs to include'),
    topN: z
      .number()
      .int()
      .min(1)
      .max(25)
      .optional()
      .describe('Optional top-N hint for ranked questions'),
  })
  .superRefine(validateDateRange);
