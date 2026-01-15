import { GraphQLClient } from 'graphql-request';

const RIZE_API_URL = 'https://api.rize.io/api/v1/graphql';

export class RizeClient {
  private client: GraphQLClient;

  constructor(apiKey: string) {
    this.client = new GraphQLClient(RIZE_API_URL, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
  }

  // ============ QUERIES ============

  async getCurrentUser() {
    const query = `
      query CurrentUser {
        currentUser {
          email
          name
        }
      }
    `;
    return this.client.request(query);
  }

  async listProjects(first = 50) {
    const query = `
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
    `;
    return this.client.request(query, { first });
  }

  async listClients(first = 50) {
    const query = `
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
    `;
    return this.client.request(query, { first });
  }

  async listTasks(first = 50) {
    const query = `
      query ListTasks($first: Int) {
        tasks(first: $first) {
          nodes {
            id
            name
            project {
              id
              name
            }
          }
        }
      }
    `;
    return this.client.request(query, { first });
  }

  async getTimeEntries(startDate: string, endDate: string) {
    const query = `
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
              client {
                id
                name
              }
            }
          }
        }
      }
    `;
    // Convert dates to datetime format
    const startTime = `${startDate}T00:00:00Z`;
    const endTime = `${endDate}T23:59:59Z`;
    return this.client.request(query, { startTime, endTime });
  }

  async getSummaries(startDate: string, endDate: string, bucketSize: string = 'day') {
    const query = `
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
    `;
    return this.client.request(query, { startDate, endDate, bucketSize });
  }

  async getCurrentSession() {
    const query = `
      query CurrentSession {
        currentSession {
          id
          title
          startTime
          endTime
          type
        }
      }
    `;
    return this.client.request(query);
  }

  async getSessions(startDate: string, endDate: string) {
    const query = `
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
          }
          tasks {
            id
            name
          }
        }
      }
    `;
    const startTime = `${startDate}T00:00:00Z`;
    const endTime = `${endDate}T23:59:59Z`;
    return this.client.request(query, { startTime, endTime });
  }

  // ============ MUTATIONS ============

  async createProject(name: string, clientName?: string, teamName?: string) {
    const mutation = `
      mutation CreateProject($name: String!, $clientName: String, $teamName: String) {
        createProject(input: { args: { name: $name, clientName: $clientName, teamName: $teamName } }) {
          project {
            id
            name
            client {
              id
              name
            }
          }
        }
      }
    `;
    return this.client.request(mutation, { name, clientName, teamName });
  }

  async createClient(name: string, teamName?: string) {
    const mutation = `
      mutation CreateClient($name: String!, $teamName: String) {
        createClient(input: { args: { name: $name, teamName: $teamName } }) {
          client {
            id
            name
          }
        }
      }
    `;
    return this.client.request(mutation, { name, teamName });
  }

  async createTask(name: string, projectName?: string, teamName?: string) {
    const mutation = `
      mutation CreateTask($name: String!, $projectName: String, $teamName: String) {
        createTask(input: { args: { name: $name, projectName: $projectName, teamName: $teamName } }) {
          task {
            id
            name
            project {
              id
              name
            }
          }
        }
      }
    `;
    return this.client.request(mutation, { name, projectName, teamName });
  }

  async createTaskTimeEntry(taskId: string, startTime: string, endTime: string, description?: string, billable?: boolean) {
    const mutation = `
      mutation CreateTaskTimeEntry($taskId: ID!, $startTime: ISO8601DateTime!, $endTime: ISO8601DateTime!, $description: String, $billable: Boolean) {
        createTaskTimeEntry(input: { taskId: $taskId, startTime: $startTime, endTime: $endTime, description: $description, billable: $billable }) {
          taskTimeEntry {
            id
            duration
            startTime
            endTime
            task {
              id
              name
            }
          }
        }
      }
    `;
    return this.client.request(mutation, { taskId, startTime, endTime, description, billable });
  }

  async updateTask(id: string, name?: string, projectName?: string, status?: string, teamName?: string) {
    const mutation = `
      mutation UpdateTask($id: ID!, $name: String, $projectName: String, $status: String, $teamName: String) {
        updateTask(input: { args: { id: $id, name: $name, projectName: $projectName, status: $status, teamName: $teamName } }) {
          task {
            id
            name
            status
            project {
              id
              name
            }
          }
        }
      }
    `;
    return this.client.request(mutation, { id, name, projectName, status, teamName });
  }

  async updateProject(id: string, name?: string, clientName?: string, status?: string, teamName?: string) {
    const mutation = `
      mutation UpdateProject($id: ID!, $name: String, $clientName: String, $status: String, $teamName: String) {
        updateProject(input: { args: { id: $id, name: $name, clientName: $clientName, status: $status, teamName: $teamName } }) {
          project {
            id
            name
            status
            client {
              id
              name
            }
          }
        }
      }
    `;
    return this.client.request(mutation, { id, name, clientName, status, teamName });
  }

  async updateClient(id: string, name?: string, status?: string, teamName?: string) {
    const mutation = `
      mutation UpdateClient($id: ID!, $name: String, $status: String, $teamName: String) {
        updateClient(input: { args: { id: $id, name: $name, status: $status, teamName: $teamName } }) {
          client {
            id
            name
            status
          }
        }
      }
    `;
    return this.client.request(mutation, { id, name, status, teamName });
  }

  async deleteTask(id: string) {
    const mutation = `
      mutation DeleteTask($id: ID!) {
        deleteTask(input: { id: $id }) {
          task {
            id
            name
          }
        }
      }
    `;
    return this.client.request(mutation, { id });
  }

  async deleteProject(id: string) {
    const mutation = `
      mutation DeleteProject($id: ID!) {
        deleteProject(input: { id: $id }) {
          project {
            id
            name
          }
        }
      }
    `;
    return this.client.request(mutation, { id });
  }

  async deleteClient(id: string) {
    const mutation = `
      mutation DeleteClient($id: ID!) {
        deleteClient(input: { id: $id }) {
          client {
            id
            name
          }
        }
      }
    `;
    return this.client.request(mutation, { id });
  }
}
