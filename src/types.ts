export interface CloudflareEnv {
  ALLOWED_ORIGINS?: string;
  HEALTH_ROUTE?: string;
  MCP_ROUTE?: string;
  MCP_SHARED_API_KEY?: string;
  RIZE_API_KEY?: string;
}

export type ErrorCode =
  | 'AUTH_ERROR'
  | 'CONFIG_ERROR'
  | 'INTERNAL_ERROR'
  | 'UPSTREAM_ERROR';

export interface FailureEnvelope {
  ok: false;
  error: {
    code: ErrorCode;
    details?: unknown;
    message: string;
  };
}

export interface SuccessEnvelope<T> {
  ok: true;
  data: T;
}

export type ToolEnvelope<T> = FailureEnvelope | SuccessEnvelope<T>;

export interface TeamRef {
  id: string;
  name: string;
}

export interface ClientRef {
  id: string;
  name: string;
}

export interface ProjectRef {
  id: string;
  name: string;
  client?: ClientRef;
  color?: string | null;
}

export interface TaskRef {
  id: string;
  name: string;
  project?: ProjectRef;
}

export interface CurrentUser {
  email: string;
  name: string;
}

export interface ClientRecord {
  id: string;
  name: string;
  team?: TeamRef;
}

export interface ProjectRecord {
  id: string;
  name: string;
  color?: string | null;
  client?: ClientRef;
}

export interface TaskRecord {
  id: string;
  name: string;
  project?: ProjectRef;
}

export interface TimeEntryRecord {
  id: string;
  durationSeconds: number;
  endTime: string;
  startTime: string;
  task?: TaskRef;
}

export interface SummaryBucket {
  breakTimeSeconds: number;
  endTime: string;
  focusTimeSeconds: number;
  meetingTimeSeconds: number;
  startTime: string;
  trackedTimeSeconds: number;
  workHoursSeconds: number;
}

export interface SessionRecord {
  description?: string | null;
  durationSeconds: number | null;
  endTime?: string | null;
  id: string;
  projects: ProjectRef[];
  source?: string | null;
  startTime: string;
  tasks: TaskRef[];
  title: string;
  type: string;
}

export interface EntityFilters {
  clientIds?: string[];
  projectIds?: string[];
  taskIds?: string[];
}

export interface NamedDuration {
  durationSeconds: number;
  id: string;
  name: string;
}

export interface DailyDuration {
  date: string;
  durationSeconds: number;
}

export interface TimeEntryAggregates {
  byClient: NamedDuration[];
  byDay: DailyDuration[];
  byProject: NamedDuration[];
  byTask: NamedDuration[];
  totalTrackedSeconds: number;
}

export interface SessionAggregates {
  countByType: Array<{ count: number; type: string }>;
  durationByType: Array<{ durationSeconds: number; type: string }>;
  totalSessionCount: number;
}

export interface AppDependencies {
  fetchFn?: typeof fetch;
  now?: () => Date;
}
