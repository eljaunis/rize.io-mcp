import type {
  DailyDuration,
  EntityFilters,
  NamedDuration,
  ProjectRecord,
  SessionAggregates,
  SessionRecord,
  SummaryBucket,
  TimeEntryAggregates,
  TimeEntryRecord,
} from './types.js';

const UNAVAILABLE_DATA_HINTS = [
  {
    pattern: /\b(budget|cost|invoice|billing|revenue|profit|margin)\b/i,
    warning:
      'Rize data in this MCP does not include financial, billing, or budget fields.',
  },
  {
    pattern: /\b(forecast|forecasting|future capacity|next sprint|next week capacity)\b/i,
    warning:
      'The MCP only returns current and historical Rize data. Any forecasting must be inferred by Claude.',
  },
  {
    pattern: /\b(commit|pull request|github|jira|linear|ticket)\b/i,
    warning:
      'This MCP does not include issue-tracker or source-control data unless Claude combines it with other tools.',
  },
];

export interface AnalysisContextInput extends EntityFilters {
  bucketSize: 'day' | 'month' | 'week';
  currentSession: SessionRecord | null;
  endDate: string;
  limit: number;
  prompt: string;
  projectsForClientFilters?: ProjectRecord[];
  sessions: SessionRecord[];
  startDate: string;
  summaries: SummaryBucket[];
  timeEntries: TimeEntryRecord[];
}

export function filterProjects(
  projects: ProjectRecord[],
  filters: Pick<EntityFilters, 'clientIds'>
): ProjectRecord[] {
  if (!filters.clientIds?.length) {
    return projects;
  }

  const allowed = new Set(filters.clientIds);
  return projects.filter((project) => project.client && allowed.has(project.client.id));
}

export function filterTimeEntries(
  entries: TimeEntryRecord[],
  filters: EntityFilters,
  projectsForClientFilters: ProjectRecord[] = []
): TimeEntryRecord[] {
  const allowedProjectIds = deriveProjectIdsFromClientFilters(filters.clientIds, projectsForClientFilters);

  return entries.filter((entry) => {
    const task = entry.task;
    const project = task?.project;
    const clientId = project?.client?.id;
    const projectId = project?.id;
    const taskId = task?.id;

    if (filters.clientIds?.length && !clientId) {
      return false;
    }

    if (filters.clientIds?.length && clientId && !filters.clientIds.includes(clientId)) {
      return false;
    }

    if (
      filters.clientIds?.length &&
      allowedProjectIds.size > 0 &&
      projectId &&
      !allowedProjectIds.has(projectId)
    ) {
      return false;
    }

    if (filters.projectIds?.length && (!projectId || !filters.projectIds.includes(projectId))) {
      return false;
    }

    if (filters.taskIds?.length && (!taskId || !filters.taskIds.includes(taskId))) {
      return false;
    }

    return true;
  });
}

export function filterSessions(
  sessions: SessionRecord[],
  filters: EntityFilters,
  projectsForClientFilters: ProjectRecord[] = []
): SessionRecord[] {
  const allowedProjectIds = deriveProjectIdsFromClientFilters(filters.clientIds, projectsForClientFilters);

  return sessions.filter((session) => {
    const projectIds = session.projects.map((project) => project.id);
    const taskIds = session.tasks.map((task) => task.id);

    if (
      filters.clientIds?.length &&
      allowedProjectIds.size > 0 &&
      !projectIds.some((projectId) => allowedProjectIds.has(projectId))
    ) {
      return false;
    }

    if (
      filters.projectIds?.length &&
      !projectIds.some((projectId) => filters.projectIds?.includes(projectId))
    ) {
      return false;
    }

    if (filters.taskIds?.length && !taskIds.some((taskId) => filters.taskIds?.includes(taskId))) {
      return false;
    }

    return true;
  });
}

export function sortByName<T extends { name: string }>(records: T[]): T[] {
  return [...records].sort((left, right) => left.name.localeCompare(right.name));
}

export function sortByStartTimeDescending<T extends { startTime: string }>(records: T[]): T[] {
  return [...records].sort((left, right) => right.startTime.localeCompare(left.startTime));
}

export function limitRecords<T>(records: T[], limit?: number): T[] {
  if (!limit || limit < 1) {
    return records;
  }

  return records.slice(0, limit);
}

export function aggregateTimeEntries(entries: TimeEntryRecord[]): TimeEntryAggregates {
  const byClient = new Map<string, NamedDuration>();
  const byProject = new Map<string, NamedDuration>();
  const byTask = new Map<string, NamedDuration>();
  const byDay = new Map<string, number>();

  for (const entry of entries) {
    const task = entry.task;
    const project = task?.project;
    const client = project?.client;

    if (client) {
      incrementNamedDuration(byClient, client.id, client.name, entry.durationSeconds);
    }

    if (project) {
      incrementNamedDuration(byProject, project.id, project.name, entry.durationSeconds);
    }

    if (task) {
      incrementNamedDuration(byTask, task.id, task.name, entry.durationSeconds);
    }

    const date = entry.startTime.slice(0, 10);
    byDay.set(date, (byDay.get(date) ?? 0) + entry.durationSeconds);
  }

  return {
    byClient: mapToSortedNamedDurations(byClient),
    byDay: [...byDay.entries()]
      .map(([date, durationSeconds]): DailyDuration => ({ date, durationSeconds }))
      .sort((left, right) => left.date.localeCompare(right.date)),
    byProject: mapToSortedNamedDurations(byProject),
    byTask: mapToSortedNamedDurations(byTask),
    totalTrackedSeconds: entries.reduce((total, entry) => total + entry.durationSeconds, 0),
  };
}

export function aggregateSessions(sessions: SessionRecord[]): SessionAggregates {
  const durationByType = new Map<string, number>();
  const countByType = new Map<string, number>();

  for (const session of sessions) {
    durationByType.set(
      session.type,
      (durationByType.get(session.type) ?? 0) + (session.durationSeconds ?? 0)
    );
    countByType.set(session.type, (countByType.get(session.type) ?? 0) + 1);
  }

  return {
    countByType: [...countByType.entries()]
      .map(([type, count]) => ({ count, type }))
      .sort((left, right) => right.count - left.count || left.type.localeCompare(right.type)),
    durationByType: [...durationByType.entries()]
      .map(([type, durationSeconds]) => ({ durationSeconds, type }))
      .sort(
        (left, right) =>
          right.durationSeconds - left.durationSeconds || left.type.localeCompare(right.type)
      ),
    totalSessionCount: sessions.length,
  };
}

export function buildAnalysisContext(input: AnalysisContextInput) {
  const filteredTimeEntries = filterTimeEntries(
    input.timeEntries,
    input,
    input.projectsForClientFilters
  );
  const filteredSessions = filterSessions(input.sessions, input, input.projectsForClientFilters);
  const limitedTimeEntries = limitRecords(
    sortByStartTimeDescending(filteredTimeEntries),
    input.limit
  );
  const limitedSessions = limitRecords(sortByStartTimeDescending(filteredSessions), input.limit);
  const warnings = inferWarnings(input.prompt);

  if (hasEntityFilters(input) && input.summaries.length > 0) {
    warnings.push(
      'Summary buckets are team-wide Rize totals for the date range. Entity filters only apply to the detailed sessions, entries, and derived aggregates.'
    );
  }

  if (filteredTimeEntries.length > limitedTimeEntries.length) {
    warnings.push(
      `Time entries were truncated to ${input.limit} records. Aggregates still reflect the full filtered set.`
    );
  }

  if (filteredSessions.length > limitedSessions.length) {
    warnings.push(
      `Sessions were truncated to ${input.limit} records. Aggregates still reflect the full filtered set.`
    );
  }

  return {
    currentSession: input.currentSession,
    normalizedScope: {
      appliedFilters: {
        clientIds: input.clientIds ?? [],
        projectIds: input.projectIds ?? [],
        taskIds: input.taskIds ?? [],
      },
      bucketSize: input.bucketSize,
      dateRange: {
        endDate: input.endDate,
        startDate: input.startDate,
      },
      includesToday: includesToday(input.startDate, input.endDate),
      inferredTopics: inferTopics(input.prompt),
      limit: input.limit,
      prompt: input.prompt,
    },
    sessions: {
      aggregates: aggregateSessions(filteredSessions),
      count: filteredSessions.length,
      items: limitedSessions,
    },
    summaries: {
      bucketSize: input.bucketSize,
      buckets: input.summaries,
      count: input.summaries.length,
    },
    timeEntries: {
      aggregates: aggregateTimeEntries(filteredTimeEntries),
      count: filteredTimeEntries.length,
      items: limitedTimeEntries,
    },
    warnings,
  };
}

function deriveProjectIdsFromClientFilters(
  clientIds: string[] | undefined,
  projects: ProjectRecord[]
): Set<string> {
  if (!clientIds?.length) {
    return new Set();
  }

  const clientIdSet = new Set(clientIds);
  return new Set(
    projects
      .filter((project) => project.client && clientIdSet.has(project.client.id))
      .map((project) => project.id)
  );
}

function incrementNamedDuration(
  map: Map<string, NamedDuration>,
  id: string,
  name: string,
  durationSeconds: number
) {
  const current = map.get(id);

  map.set(id, {
    durationSeconds: (current?.durationSeconds ?? 0) + durationSeconds,
    id,
    name,
  });
}

function mapToSortedNamedDurations(map: Map<string, NamedDuration>): NamedDuration[] {
  return [...map.values()].sort(
    (left, right) =>
      right.durationSeconds - left.durationSeconds || left.name.localeCompare(right.name)
  );
}

function inferWarnings(prompt: string): string[] {
  return UNAVAILABLE_DATA_HINTS.filter((hint) => hint.pattern.test(prompt)).map(
    (hint) => hint.warning
  );
}

function inferTopics(prompt: string): string[] {
  const lowered = prompt.toLowerCase();
  const topics = new Set<string>();

  if (/\bfocus|deep work|maker\b/.test(lowered)) {
    topics.add('focus');
  }
  if (/\bmeeting|calendar\b/.test(lowered)) {
    topics.add('meetings');
  }
  if (/\bbreak|idle|pause\b/.test(lowered)) {
    topics.add('breaks');
  }
  if (/\bclient|customer\b/.test(lowered)) {
    topics.add('clients');
  }
  if (/\bproject\b/.test(lowered)) {
    topics.add('projects');
  }
  if (/\btask\b/.test(lowered)) {
    topics.add('tasks');
  }
  if (/\btrend|compare|week over week|month over month\b/.test(lowered)) {
    topics.add('trends');
  }
  if (topics.size === 0) {
    topics.add('general-analysis');
  }

  return [...topics];
}

function includesToday(startDate: string, endDate: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return startDate <= today && endDate >= today;
}

function hasEntityFilters(filters: EntityFilters): boolean {
  return Boolean(
    filters.clientIds?.length || filters.projectIds?.length || filters.taskIds?.length
  );
}
