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
}
