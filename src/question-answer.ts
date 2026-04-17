import {
  filterSessions,
  filterTimeEntries,
  limitRecords,
  sortByStartTimeDescending,
} from './analysis.js';
import { RizeClient } from './rize-client.js';
import type {
  BreakdownItem,
  BreakdownSection,
  ComparisonMode,
  ComparisonSection,
  EntityFilters,
  InterpretedRequest,
  MetricValue,
  ProjectRecord,
  QuestionAnswerResponse,
  ReportGrouping,
  ReportIntent,
  ReportMetric,
  SessionRecord,
  SummaryBucket,
  TimeEntryRecord,
} from './types.js';

export interface QuestionAnswerInput extends EntityFilters {
  endDate: string;
  grain?: 'day' | 'month' | 'week';
  question: string;
  startDate: string;
  topN?: number;
}

interface InterpretedQuestion {
  comparisonMode: ComparisonMode;
  defaultedHoursToTrackedTime: boolean;
  grain: 'day' | 'month' | 'none' | 'week';
  grouping: ReportGrouping;
  intent: ReportIntent;
  metric: ReportMetric;
  secondaryMetric: ReportMetric | null;
  topN: number;
}

interface ReportDataset {
  sessions: SessionRecord[];
  summaries: SummaryBucket[];
  timeEntries: TimeEntryRecord[];
}

const METRIC_DEFINITIONS: Record<ReportMetric, string> = {
  breakTimeSeconds: 'Break time from Rize summary buckets, in seconds.',
  focusTimeSeconds: 'Focus time from Rize summary buckets, in seconds.',
  meetingTimeSeconds: 'Meeting time from Rize summary buckets, in seconds.',
  sessionCount: 'Count of Rize sessions in the selected range.',
  trackedTimeSeconds:
    'Approved task-tracked time from Rize task time entries, in seconds.',
  workHoursSeconds: 'Total work hours from Rize summary buckets, in seconds.',
};

const UNSUPPORTED_QUESTION_HINTS = [
  {
    pattern: /\b(budget|cost|invoice|billing|revenue|profit|margin)\b/i,
    warning:
      'Rize data in this MCP does not include financial, billing, or budget fields.',
  },
  {
    pattern: /\b(capacity|utilization|overallocated|underallocated|forecast|forecasting)\b/i,
    warning:
      'Rize data can describe historical time usage, but capacity and utilization are not explicit source fields here.',
  },
  {
    pattern: /\b(commit|pull request|github|jira|linear|ticket)\b/i,
    warning:
      'This MCP does not include issue-tracker or source-control data unless Claude combines it with other tools.',
  },
];

export async function answerQuestion(
  input: QuestionAnswerInput,
  client: RizeClient
): Promise<QuestionAnswerResponse> {
  const interpreted = interpretQuestion(input);
  const projects = input.clientIds?.length ? await client.listProjects(500) : [];
  const current = await loadDataset(client, input.startDate, input.endDate, input, projects);
  const metrics = buildMetricMap(current);
  const warnings = inferWarnings(input.question);
  const breakdowns = buildBreakdowns(interpreted, current, warnings);
  const evidence = buildEvidence(current);
  const comparisons = await buildComparisons(
    client,
    input,
    interpreted,
    current,
    projects
  );

  return {
    breakdowns,
    comparisons,
    evidence,
    interpretedRequest: {
      comparisonMode: interpreted.comparisonMode,
      defaultedHoursToTrackedTime: interpreted.defaultedHoursToTrackedTime,
      filters: {
        clientIds: input.clientIds ?? [],
        projectIds: input.projectIds ?? [],
        taskIds: input.taskIds ?? [],
      },
      grain: interpreted.grain,
      grouping: interpreted.grouping,
      intent: interpreted.intent,
      metric: interpreted.metric,
      question: input.question,
    },
    metricDefinitions: METRIC_DEFINITIONS,
    metrics,
    question: input.question,
    warnings,
  };
}

export function interpretQuestion(input: QuestionAnswerInput): InterpretedQuestion {
  const question = input.question.toLowerCase();
  const metrics = detectMetrics(question);
  const requestedHours = /\bhours?\b/.test(question);
  const explicitMetric = metrics.length > 0 ? metrics[0] : null;
  const defaultedHoursToTrackedTime = requestedHours && explicitMetric === null;
  const metric = explicitMetric ?? 'trackedTimeSeconds';
  const grouping = detectGrouping(question, input.grain);
  const comparisonMode = detectComparisonMode(question, metrics);
  const intent = detectIntent(question, grouping, comparisonMode);
  const secondaryMetric =
    comparisonMode === 'metric_vs_metric' && metrics.length > 1 ? metrics[1] : null;

  return {
    comparisonMode,
    defaultedHoursToTrackedTime,
    grain: detectGrain(question, input.grain, grouping, comparisonMode),
    grouping,
    intent,
    metric,
    secondaryMetric,
    topN: input.topN ?? 5,
  };
}

async function loadDataset(
  client: RizeClient,
  startDate: string,
  endDate: string,
  filters: EntityFilters,
  projects: ProjectRecord[]
): Promise<ReportDataset> {
  const [timeEntries, summaries, sessions] = await Promise.all([
    client.getTimeEntries(startDate, endDate),
    client.getSummaries(startDate, endDate, 'day'),
    client.getSessions(startDate, endDate),
  ]);

  return {
    sessions: filterSessions(sessions, filters, projects),
    summaries,
    timeEntries: filterTimeEntries(timeEntries, filters, projects),
  };
}

function buildMetricMap(dataset: ReportDataset): Record<ReportMetric, number> {
  const summaryTotals = sumSummaryMetrics(dataset.summaries);

  return {
    breakTimeSeconds: summaryTotals.breakTimeSeconds,
    focusTimeSeconds: summaryTotals.focusTimeSeconds,
    meetingTimeSeconds: summaryTotals.meetingTimeSeconds,
    sessionCount: dataset.sessions.length,
    trackedTimeSeconds: dataset.timeEntries.reduce(
      (total, entry) => total + entry.durationSeconds,
      0
    ),
    workHoursSeconds: summaryTotals.workHoursSeconds,
  };
}

function buildBreakdowns(
  interpreted: InterpretedQuestion,
  dataset: ReportDataset,
  warnings: string[]
): BreakdownSection[] {
  if (interpreted.grouping === 'none') {
    return [];
  }

  if (
    ['client', 'project', 'task'].includes(interpreted.grouping) &&
    interpreted.metric !== 'trackedTimeSeconds'
  ) {
    warnings.push(
      'Client, project, and task breakdowns are only supported for tracked task time.'
    );
    return [];
  }

  const items = createBreakdownItems(interpreted, dataset);
  if (items.length === 0) {
    return [];
  }

  return [
    {
      dimension: interpreted.grouping,
      items,
      metric: interpreted.metric,
    },
  ];
}

async function buildComparisons(
  client: RizeClient,
  input: QuestionAnswerInput,
  interpreted: InterpretedQuestion,
  current: ReportDataset,
  projects: ProjectRecord[]
): Promise<ComparisonSection | null> {
  const currentMetrics = buildMetricMap(current);

  if (interpreted.comparisonMode === 'metric_vs_metric' && interpreted.secondaryMetric) {
    return {
      currentPeriod: {
        [interpreted.metric]: currentMetrics[interpreted.metric],
        [interpreted.secondaryMetric]: currentMetrics[interpreted.secondaryMetric],
      },
      delta: {
        [`${interpreted.metric}Minus${capitalize(interpreted.secondaryMetric)}`]:
          currentMetrics[interpreted.metric] - currentMetrics[interpreted.secondaryMetric],
      },
      kind: 'metric_vs_metric',
    };
  }

  if (interpreted.comparisonMode !== 'previous_period') {
    return null;
  }

  const previousRange = derivePreviousRange(input.startDate, input.endDate);
  const previous = await loadDataset(
    client,
    previousRange.startDate,
    previousRange.endDate,
    input,
    projects
  );
  const previousMetrics = buildMetricMap(previous);
  const delta = {} as Record<string, number>;

  for (const metric of Object.keys(currentMetrics) as ReportMetric[]) {
    delta[metric] = currentMetrics[metric] - previousMetrics[metric];
  }

  return {
    currentPeriod: currentMetrics,
    delta,
    kind: 'previous_period',
    previousPeriod: previousMetrics,
  };
}

function createBreakdownItems(
  interpreted: InterpretedQuestion,
  dataset: ReportDataset
): BreakdownItem[] {
  switch (interpreted.grouping) {
    case 'client':
      return finalizeBreakdownItems(
        groupTrackedEntriesBy(dataset.timeEntries, (entry) => {
          const client = entry.task?.project?.client;
          return {
            id: client?.id ?? null,
            label: client?.name ?? 'Unassigned client',
          };
        }),
        interpreted
      );
    case 'project':
      return finalizeBreakdownItems(
        groupTrackedEntriesBy(dataset.timeEntries, (entry) => {
          const project = entry.task?.project;
          return {
            id: project?.id ?? null,
            label: project?.name ?? 'Unassigned project',
          };
        }),
        interpreted
      );
    case 'task':
      return finalizeBreakdownItems(
        groupTrackedEntriesBy(dataset.timeEntries, (entry) => {
          const task = entry.task;
          return {
            id: task?.id ?? null,
            label: task?.name ?? 'Unassigned task',
          };
        }),
        interpreted
      );
    case 'day':
      return finalizeBreakdownItems(groupByDay(interpreted.metric, dataset), interpreted);
    case 'week':
      return finalizeBreakdownItems(groupByWeek(interpreted.metric, dataset), interpreted);
    default:
      return [];
  }
}

function groupTrackedEntriesBy(
  entries: TimeEntryRecord[],
  selector: (entry: TimeEntryRecord) => { id: string | null; label: string }
): BreakdownItem[] {
  const totals = new Map<string, BreakdownItem>();

  for (const entry of entries) {
    const selected = selector(entry);
    const key = `${selected.id ?? 'none'}::${selected.label}`;
    const current = totals.get(key);

    totals.set(key, {
      id: selected.id,
      label: selected.label,
      value: (current?.value ?? 0) + entry.durationSeconds,
    });
  }

  return [...totals.values()];
}

function groupByDay(metric: ReportMetric, dataset: ReportDataset): BreakdownItem[] {
  if (metric === 'trackedTimeSeconds') {
    return groupTrackedEntriesBy(dataset.timeEntries, (entry) => ({
      id: entry.startTime.slice(0, 10),
      label: entry.startTime.slice(0, 10),
    }));
  }

  if (metric === 'sessionCount') {
    const totals = new Map<string, number>();
    for (const session of dataset.sessions) {
      const day = session.startTime.slice(0, 10);
      totals.set(day, (totals.get(day) ?? 0) + 1);
    }
    return [...totals.entries()].map(([label, value]) => ({ id: label, label, value }));
  }

  return dataset.summaries.map((bucket) => ({
    id: bucket.startTime.slice(0, 10),
    label: bucket.startTime.slice(0, 10),
    value: readMetricValue(metric, bucket, dataset),
  }));
}

function groupByWeek(metric: ReportMetric, dataset: ReportDataset): BreakdownItem[] {
  if (metric === 'trackedTimeSeconds') {
    const totals = new Map<string, BreakdownItem>();
    for (const entry of dataset.timeEntries) {
      const week = toIsoWeekLabel(entry.startTime);
      const current = totals.get(week);
      totals.set(week, {
        id: week,
        label: week,
        value: (current?.value ?? 0) + entry.durationSeconds,
      });
    }
    return [...totals.values()];
  }

  if (metric === 'sessionCount') {
    const totals = new Map<string, number>();
    for (const session of dataset.sessions) {
      const week = toIsoWeekLabel(session.startTime);
      totals.set(week, (totals.get(week) ?? 0) + 1);
    }
    return [...totals.entries()].map(([label, value]) => ({ id: label, label, value }));
  }

  const totals = new Map<string, number>();
  for (const bucket of dataset.summaries) {
    const week = toIsoWeekLabel(bucket.startTime);
    totals.set(week, (totals.get(week) ?? 0) + readMetricValue(metric, bucket, dataset));
  }
  return [...totals.entries()].map(([label, value]) => ({ id: label, label, value }));
}

function finalizeBreakdownItems(
  items: BreakdownItem[],
  interpreted: InterpretedQuestion
): BreakdownItem[] {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const withPercentages = items.map((item) => ({
    ...item,
    percentageOfTotal: total > 0 ? Number(((item.value / total) * 100).toFixed(2)) : 0,
  }));

  if (interpreted.grouping === 'day' || interpreted.grouping === 'week') {
    return withPercentages.sort((left, right) => left.label.localeCompare(right.label));
  }

  const sorted = withPercentages.sort(
    (left, right) => right.value - left.value || left.label.localeCompare(right.label)
  );

  if (interpreted.intent === 'top') {
    return sorted.slice(0, interpreted.topN);
  }

  return sorted;
}

function buildEvidence(dataset: ReportDataset) {
  return {
    sessions: limitRecords(sortByStartTimeDescending(dataset.sessions), 3),
    summaryBuckets: dataset.summaries.slice(0, 7),
    timeEntries: limitRecords(sortByStartTimeDescending(dataset.timeEntries), 3),
  };
}

function inferWarnings(question: string): string[] {
  return UNSUPPORTED_QUESTION_HINTS.filter((hint) => hint.pattern.test(question)).map(
    (hint) => hint.warning
  );
}

function detectMetrics(question: string): ReportMetric[] {
  const matches: ReportMetric[] = [];

  if (/\bwork hours?\b|\btotal work\b/.test(question)) {
    matches.push('workHoursSeconds');
  }
  if (/\bfocus|deep work|maker\b/.test(question)) {
    matches.push('focusTimeSeconds');
  }
  if (/\bmeeting|calendar\b/.test(question)) {
    matches.push('meetingTimeSeconds');
  }
  if (/\bbreak|idle|pause\b/.test(question)) {
    matches.push('breakTimeSeconds');
  }
  if (/\bsession count\b|\bnumber of sessions\b|\bhow many sessions\b/.test(question)) {
    matches.push('sessionCount');
  }

  return [...new Set(matches)];
}

function detectGrouping(
  question: string,
  grain?: 'day' | 'month' | 'week'
): ReportGrouping {
  if (/\bby client\b|\bper client\b|\bacross clients\b|\bclient allocation\b/.test(question)) {
    return 'client';
  }
  if (/\bby project\b|\bper project\b|\bprojects took the most\b/.test(question)) {
    return 'project';
  }
  if (/\bby task\b|\bper task\b/.test(question)) {
    return 'task';
  }
  if (grain === 'day' || /\bday by day\b|\bdaily\b|\bby day\b/.test(question)) {
    return 'day';
  }
  if (grain === 'week' || /\bweek over week\b|\bweekly\b|\bby week\b/.test(question)) {
    return 'week';
  }
  return 'none';
}

function detectComparisonMode(
  question: string,
  metrics: ReportMetric[]
): ComparisonMode {
  if (/\bcompare\b|\bversus\b|\bvs\b/.test(question) && metrics.length >= 2) {
    return 'metric_vs_metric';
  }
  if (/\bweek over week\b|\bmonth over month\b|\bwhat changed\b|\bchanged\b/.test(question)) {
    return 'previous_period';
  }
  return 'none';
}

function detectIntent(
  question: string,
  grouping: ReportGrouping,
  comparisonMode: ComparisonMode
): ReportIntent {
  if (comparisonMode === 'metric_vs_metric') {
    return 'mix';
  }
  if (comparisonMode === 'previous_period') {
    return 'comparison';
  }
  if (/\btop\b|\bmost\b|\bhighest\b/.test(question)) {
    return 'top';
  }
  if (/\btrend\b|\bover time\b|\bdaily\b|\bweekly\b/.test(question)) {
    return 'trend';
  }
  if (
    grouping !== 'none' ||
    /\ballocation\b|\bsplit\b|\bbreakdown\b/.test(question)
  ) {
    return 'allocation';
  }
  return 'total';
}

function detectGrain(
  question: string,
  grain: 'day' | 'month' | 'week' | undefined,
  grouping: ReportGrouping,
  comparisonMode: ComparisonMode
): 'day' | 'month' | 'none' | 'week' {
  if (grain) {
    return grain;
  }
  if (grouping === 'day' || /\bdaily\b|\bday by day\b/.test(question)) {
    return 'day';
  }
  if (
    grouping === 'week' ||
    /\bweek over week\b|\bweekly\b|\bthis week\b|\blast week\b/.test(question)
  ) {
    return 'week';
  }
  if (/\bmonthly\b|\bmonth over month\b|\bthis month\b|\blast month\b/.test(question)) {
    return 'month';
  }
  if (comparisonMode === 'previous_period') {
    return 'week';
  }
  return 'none';
}

function sumSummaryMetrics(summaries: SummaryBucket[]) {
  return summaries.reduce(
    (totals, bucket) => ({
      breakTimeSeconds: totals.breakTimeSeconds + bucket.breakTimeSeconds,
      focusTimeSeconds: totals.focusTimeSeconds + bucket.focusTimeSeconds,
      meetingTimeSeconds: totals.meetingTimeSeconds + bucket.meetingTimeSeconds,
      trackedTimeSeconds: totals.trackedTimeSeconds + bucket.trackedTimeSeconds,
      workHoursSeconds: totals.workHoursSeconds + bucket.workHoursSeconds,
    }),
    {
      breakTimeSeconds: 0,
      focusTimeSeconds: 0,
      meetingTimeSeconds: 0,
      trackedTimeSeconds: 0,
      workHoursSeconds: 0,
    }
  );
}

function readMetricValue(
  metric: ReportMetric,
  bucket: SummaryBucket,
  dataset: ReportDataset
): number {
  switch (metric) {
    case 'breakTimeSeconds':
      return bucket.breakTimeSeconds;
    case 'focusTimeSeconds':
      return bucket.focusTimeSeconds;
    case 'meetingTimeSeconds':
      return bucket.meetingTimeSeconds;
    case 'sessionCount':
      return dataset.sessions.length;
    case 'trackedTimeSeconds':
      return bucket.trackedTimeSeconds;
    case 'workHoursSeconds':
      return bucket.workHoursSeconds;
  }
}

function derivePreviousRange(startDate: string, endDate: string) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const daySpan = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  const previousEnd = new Date(start.getTime() - 86400000);
  const previousStart = new Date(previousEnd.getTime() - (daySpan - 1) * 86400000);

  return {
    endDate: toDateString(previousEnd),
    startDate: toDateString(previousStart),
  };
}

function parseDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toIsoWeekLabel(dateLike: string): string {
  const date = new Date(dateLike);
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${utcDate.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function capitalize(value: string): string {
  return `${value[0]?.toUpperCase() ?? ''}${value.slice(1)}`;
}
