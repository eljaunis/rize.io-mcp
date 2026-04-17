export interface CloudflareEnv {
  ALLOWED_ORIGINS?: string;
  HEALTH_ROUTE?: string;
  MCP_ROUTE?: string;
  MCP_AUTH_USERS_JSON?: string;
  OAUTH_CLIENT_REGISTRATION_ROUTE?: string;
  OAUTH_AUTHORIZE_ROUTE?: string;
  OAUTH_KV: KVNamespace;
  OAUTH_PROVIDER?: {
    completeAuthorization: (options: unknown) => Promise<{ redirectTo: string }>;
    lookupClient: (clientId: string) => Promise<unknown>;
    parseAuthRequest: (request: Request) => Promise<unknown>;
  };
  RIZE_API_KEY?: string;
  SESSION_SIGNING_SECRET?: string;
  TOKEN_ROUTE?: string;
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

export type ReportMetric =
  | 'trackedTimeSeconds'
  | 'workHoursSeconds'
  | 'focusTimeSeconds'
  | 'meetingTimeSeconds'
  | 'breakTimeSeconds'
  | 'sessionCount';

export type ReportGrouping = 'client' | 'project' | 'task' | 'day' | 'week' | 'none';

export type ReportIntent =
  | 'total'
  | 'allocation'
  | 'top'
  | 'trend'
  | 'comparison'
  | 'mix';

export type ComparisonMode = 'metric_vs_metric' | 'previous_period' | 'none';

export interface MetricValue {
  label: string;
  value: number;
}

export interface BreakdownItem {
  id: string | null;
  label: string;
  percentageOfTotal?: number;
  value: number;
}

export interface BreakdownSection {
  dimension: ReportGrouping;
  items: BreakdownItem[];
  metric: ReportMetric;
}

export interface EvidenceSection {
  sessions?: SessionRecord[];
  summaryBuckets?: SummaryBucket[];
  timeEntries?: TimeEntryRecord[];
}

export interface ComparisonSection {
  kind: ComparisonMode;
  currentPeriod?: Record<string, number>;
  delta?: Record<string, number>;
  previousPeriod?: Record<string, number>;
}

export interface InterpretedRequest {
  comparisonMode: ComparisonMode;
  defaultedHoursToTrackedTime: boolean;
  filters: {
    clientIds: string[];
    projectIds: string[];
    taskIds: string[];
  };
  grain: 'day' | 'month' | 'none' | 'week';
  grouping: ReportGrouping;
  intent: ReportIntent;
  metric: ReportMetric;
  question: string;
}

export interface QuestionAnswerResponse {
  breakdowns: BreakdownSection[];
  comparisons: ComparisonSection | null;
  evidence: EvidenceSection;
  interpretedRequest: InterpretedRequest;
  metricDefinitions: Record<ReportMetric, string>;
  metrics: Record<ReportMetric, number>;
  question: string;
  warnings: string[];
}
