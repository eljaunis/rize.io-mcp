import { AppError } from './errors.js';
import type {
  ClientRecord,
  CurrentUser,
  ProjectRecord,
  SessionRecord,
  SummaryBucket,
  TaskRecord,
  TimeEntryRecord,
} from './types.js';

const RIZE_API_URL = 'https://api.rize.io/api/v1/graphql';

interface GraphQLError {
  message: string;
}

interface GraphQLResponse<TData> {
  data?: TData;
  errors?: GraphQLError[];
}

interface RizeClientOptions {
  apiKey: string;
  fetchFn?: typeof fetch;
}

export class RizeClient {
  private readonly apiKey: string;
  private readonly fetchFn: typeof fetch;

  constructor(options: RizeClientOptions) {
    this.apiKey = options.apiKey;
    this.fetchFn = options.fetchFn ?? fetch.bind(globalThis);
  }

  async getCurrentUser(): Promise<CurrentUser> {
    const data = await this.request<{ currentUser: CurrentUser }>(
      `
        query CurrentUser {
          currentUser {
            email
            name
          }
        }
      `
    );

    return data.currentUser;
  }

  async listClients(first = 50): Promise<ClientRecord[]> {
    const data = await this.request<{
      clients: {
        nodes: Array<{
          id: string;
          name: string;
          team?: {
            id: string;
            name: string;
          } | null;
        }>;
      };
    }>(
      `
        query ListClients($first: Int) {
          clients(first: $first) {
            nodes {
              id
              name
              team {
                id
                name
              }
            }
          }
        }
      `,
      { first }
    );

    return data.clients.nodes.map((client) => ({
      id: client.id,
      name: client.name,
      team: client.team
        ? {
            id: client.team.id,
            name: client.team.name,
          }
        : undefined,
    }));
  }

  async listProjects(first = 50): Promise<ProjectRecord[]> {
    const data = await this.request<{
      projects: {
        nodes: Array<{
          color?: string | null;
          client?: {
            id: string;
            name: string;
          } | null;
          id: string;
          name: string;
        }>;
      };
    }>(
      `
        query ListProjects($first: Int) {
          projects(first: $first) {
            nodes {
              id
              name
              color
              client {
                id
                name
              }
            }
          }
        }
      `,
      { first }
    );

    return data.projects.nodes.map((project) => ({
      id: project.id,
      name: project.name,
      color: project.color ?? null,
      client: project.client
        ? {
            id: project.client.id,
            name: project.client.name,
          }
        : undefined,
    }));
  }

  async listTasks(first = 50): Promise<TaskRecord[]> {
    const data = await this.request<{
      tasks: {
        nodes: Array<{
          id: string;
          name: string;
          project?: {
            client?: {
              id: string;
              name: string;
            } | null;
            color?: string | null;
            id: string;
            name: string;
          } | null;
        }>;
      };
    }>(
      `
        query ListTasks($first: Int) {
          tasks(first: $first) {
            nodes {
              id
              name
              project {
                id
                name
                color
                client {
                  id
                  name
                }
              }
            }
          }
        }
      `,
      { first }
    );

    return data.tasks.nodes.map((task) => ({
      id: task.id,
      name: task.name,
      project: task.project
        ? {
            id: task.project.id,
            name: task.project.name,
            color: task.project.color ?? null,
            client: task.project.client
              ? {
                  id: task.project.client.id,
                  name: task.project.client.name,
                }
              : undefined,
          }
        : undefined,
    }));
  }

  async getTimeEntries(startDate: string, endDate: string): Promise<TimeEntryRecord[]> {
    const data = await this.request<{
      taskTimeEntries: Array<{
        duration: number;
        endTime: string;
        id: string;
        startTime: string;
        task?: {
          id: string;
          name: string;
          project?: {
            client?: {
              id: string;
              name: string;
            } | null;
            color?: string | null;
            id: string;
            name: string;
          } | null;
        } | null;
      }>;
    }>(
      `
        query TaskTimeEntries($startTime: ISO8601DateTime!, $endTime: ISO8601DateTime!) {
          taskTimeEntries(startTime: $startTime, endTime: $endTime) {
            id
            duration
            startTime
            endTime
            task {
              id
              name
              project {
                id
                name
                color
                client {
                  id
                  name
                }
              }
            }
          }
        }
      `,
      {
        endTime: `${endDate}T23:59:59Z`,
        startTime: `${startDate}T00:00:00Z`,
      }
    );

    return data.taskTimeEntries.map((entry) => ({
      id: entry.id,
      durationSeconds: entry.duration,
      endTime: entry.endTime,
      startTime: entry.startTime,
      task: entry.task
        ? {
            id: entry.task.id,
            name: entry.task.name,
            project: entry.task.project
              ? {
                  id: entry.task.project.id,
                  name: entry.task.project.name,
                  color: entry.task.project.color ?? null,
                  client: entry.task.project.client
                    ? {
                        id: entry.task.project.client.id,
                        name: entry.task.project.client.name,
                      }
                    : undefined,
                }
              : undefined,
          }
        : undefined,
    }));
  }

  async getSummaries(
    startDate: string,
    endDate: string,
    bucketSize: 'day' | 'month' | 'week'
  ): Promise<SummaryBucket[]> {
    const data = await this.request<{
      summaries:
        | Array<{
            breakTime: number;
            endTime: string;
            focusTime: number;
            meetingTime: number;
            startTime: string;
            trackedTime: number;
            workHours: number;
          }>
        | {
            breakTime: number;
            endTime: string;
            focusTime: number;
            meetingTime: number;
            startTime: string;
            trackedTime: number;
            workHours: number;
          };
    }>(
      `
        query Summaries($startDate: ISO8601Date!, $endDate: ISO8601Date!, $bucketSize: String!) {
          summaries(startDate: $startDate, endDate: $endDate, bucketSize: $bucketSize) {
            startTime
            endTime
            focusTime
            meetingTime
            breakTime
            trackedTime
            workHours
          }
        }
      `,
      { bucketSize, endDate, startDate }
    );

    const buckets = Array.isArray(data.summaries) ? data.summaries : [data.summaries];

    return buckets.map((bucket) => ({
      breakTimeSeconds: bucket.breakTime,
      endTime: bucket.endTime,
      focusTimeSeconds: bucket.focusTime,
      meetingTimeSeconds: bucket.meetingTime,
      startTime: bucket.startTime,
      trackedTimeSeconds: bucket.trackedTime,
      workHoursSeconds: bucket.workHours,
    }));
  }

  async getCurrentSession(): Promise<SessionRecord | null> {
    const data = await this.request<{
      currentSession: {
        endTime?: string | null;
        id: string;
        startTime: string;
        title: string;
        type: string;
      } | null;
    }>(
      `
        query CurrentSession {
          currentSession {
            id
            title
            startTime
            endTime
            type
          }
        }
      `
    );

    if (!data.currentSession) {
      return null;
    }

    return {
      durationSeconds: calculateDurationSeconds(
        data.currentSession.startTime,
        data.currentSession.endTime ?? null
      ),
      endTime: data.currentSession.endTime ?? null,
      id: data.currentSession.id,
      projects: [],
      startTime: data.currentSession.startTime,
      tasks: [],
      title: data.currentSession.title,
      type: data.currentSession.type,
    };
  }

  async getSessions(startDate: string, endDate: string): Promise<SessionRecord[]> {
    const data = await this.request<{
      sessions: Array<{
        description?: string | null;
        endTime?: string | null;
        id: string;
        projects?: Array<{
          client?: {
            id: string;
            name: string;
          } | null;
          color?: string | null;
          id: string;
          name: string;
        }> | null;
        source?: string | null;
        startTime: string;
        tasks?: Array<{
          id: string;
          name: string;
        }> | null;
        title: string;
        type: string;
      }>;
    }>(
      `
        query Sessions($startTime: ISO8601DateTime!, $endTime: ISO8601DateTime!) {
          sessions(startTime: $startTime, endTime: $endTime) {
            id
            title
            description
            startTime
            endTime
            type
            source
            projects {
              id
              name
              color
              client {
                id
                name
              }
            }
            tasks {
              id
              name
            }
          }
        }
      `,
      {
        endTime: `${endDate}T23:59:59Z`,
        startTime: `${startDate}T00:00:00Z`,
      }
    );

    return data.sessions.map((session) => ({
      description: session.description ?? null,
      durationSeconds: calculateDurationSeconds(session.startTime, session.endTime ?? null),
      endTime: session.endTime ?? null,
      id: session.id,
      projects: (session.projects ?? []).map((project) => ({
        id: project.id,
        name: project.name,
        color: project.color ?? null,
        client: project.client
          ? {
              id: project.client.id,
              name: project.client.name,
            }
          : undefined,
      })),
      source: session.source ?? null,
      startTime: session.startTime,
      tasks: (session.tasks ?? []).map((task) => ({
        id: task.id,
        name: task.name,
      })),
      title: session.title,
      type: session.type,
    }));
  }

  private async request<TData>(
    query: string,
    variables?: Record<string, unknown>
  ): Promise<TData> {
    const response = await this.fetchFn(RIZE_API_URL, {
      body: JSON.stringify({
        query,
        variables,
      }),
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });

    const payload = (await response.json()) as GraphQLResponse<TData>;

    if (!response.ok) {
      throw new AppError('UPSTREAM_ERROR', 'Rize API request failed', {
        details: {
          body: payload,
          status: response.status,
        },
        status: 502,
      });
    }

    if (payload.errors?.length) {
      throw new AppError(
        'UPSTREAM_ERROR',
        payload.errors.map((error) => error.message).join('; '),
        {
          details: payload.errors,
          status: 502,
        }
      );
    }

    if (!payload.data) {
      throw new AppError('UPSTREAM_ERROR', 'Rize API returned no data', {
        details: payload,
        status: 502,
      });
    }

    return payload.data;
  }
}

function calculateDurationSeconds(
  startTime: string,
  endTime?: string | null
): number | null {
  if (!endTime) {
    return null;
  }

  const start = Date.parse(startTime);
  const end = Date.parse(endTime);

  if (Number.isNaN(start) || Number.isNaN(end)) {
    return null;
  }

  return Math.max(0, Math.round((end - start) / 1000));
}
