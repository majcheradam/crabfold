const RAILWAY_API = "https://backboard.railway.com/graphql/v2";

interface RailwayRequestOptions {
  query: string;
  token: string;
  variables?: Record<string, unknown>;
}

async function railwayGql<T>(options: RailwayRequestOptions): Promise<T> {
  const res = await fetch(RAILWAY_API, {
    body: JSON.stringify({
      query: options.query,
      variables: options.variables,
    }),
    headers: {
      Authorization: `Bearer ${options.token}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Railway API error (${res.status}): ${text}`);
  }

  const json = (await res.json()) as {
    data?: T;
    errors?: { message: string }[];
  };
  if (json.errors?.length) {
    throw new Error(
      `Railway GraphQL error: ${json.errors[0]?.message ?? "Unknown error"}`
    );
  }
  if (!json.data) {
    throw new Error("Railway API returned no data");
  }
  return json.data;
}

export async function getWorkspaceId(token: string): Promise<string> {
  const data = await railwayGql<{
    me: { workspaces: { id: string }[] };
  }>({
    query: `query { me { workspaces { id } } }`,
    token,
  });

  const [workspace] = data.me.workspaces;
  if (!workspace) {
    throw new Error("No Railway workspace found for this account");
  }
  return workspace.id;
}

export async function createProject(
  token: string,
  name: string
): Promise<{ environmentId: string; projectId: string }> {
  const workspaceId = await getWorkspaceId(token);

  const data = await railwayGql<{
    projectCreate: {
      environments: { edges: { node: { id: string } }[] };
      id: string;
    };
  }>({
    query: `
      mutation($name: String!, $workspaceId: String!) {
        projectCreate(input: { name: $name, workspaceId: $workspaceId }) {
          id
          environments {
            edges { node { id } }
          }
        }
      }
    `,
    token,
    variables: { name, workspaceId },
  });

  const project = data.projectCreate;
  const [edge] = project.environments.edges;
  if (!edge) {
    throw new Error("Railway project has no environments");
  }
  return { environmentId: edge.node.id, projectId: project.id };
}

export async function createService(
  token: string,
  projectId: string,
  _environmentId: string,
  repo: string
): Promise<{ serviceId: string }> {
  const data = await railwayGql<{
    serviceCreate: { id: string };
  }>({
    query: `
      mutation($projectId: String!, $repo: String!) {
        serviceCreate(input: {
          projectId: $projectId,
          source: { repo: $repo }
        }) {
          id
        }
      }
    `,
    token,
    variables: { projectId, repo },
  });

  return { serviceId: data.serviceCreate.id };
}

export async function createServiceFromImage(
  token: string,
  projectId: string,
  image: string
): Promise<{ serviceId: string }> {
  const data = await railwayGql<{
    serviceCreate: { id: string };
  }>({
    query: `
      mutation($projectId: String!, $image: String!) {
        serviceCreate(input: {
          projectId: $projectId,
          source: { image: $image }
        }) {
          id
        }
      }
    `,
    token,
    variables: { image, projectId },
  });

  return { serviceId: data.serviceCreate.id };
}

export async function upsertVariables(
  token: string,
  projectId: string,
  environmentId: string,
  serviceId: string,
  variables: Record<string, string>
): Promise<void> {
  await railwayGql({
    query: `
      mutation($input: VariableCollectionUpsertInput!) {
        variableCollectionUpsert(input: $input)
      }
    `,
    token,
    variables: {
      input: {
        environmentId,
        projectId,
        serviceId,
        variables,
      },
    },
  });
}

export async function createVolume(
  token: string,
  projectId: string,
  environmentId: string,
  serviceId: string,
  mountPath: string,
  _sizeMb?: number
): Promise<{ volumeId: string }> {
  const data = await railwayGql<{
    volumeCreate: { id: string };
  }>({
    query: `
      mutation(
        $projectId: String!,
        $environmentId: String!,
        $serviceId: String!,
        $mountPath: String!
      ) {
        volumeCreate(input: {
          projectId: $projectId,
          environmentId: $environmentId,
          serviceId: $serviceId,
          mountPath: $mountPath
        }) {
          id
        }
      }
    `,
    token,
    variables: { environmentId, mountPath, projectId, serviceId },
  });

  return { volumeId: data.volumeCreate.id };
}

export async function triggerDeploy(
  token: string,
  serviceId: string,
  environmentId: string
): Promise<{ deploymentId: string }> {
  const data = await railwayGql<{
    serviceInstanceDeployV2: string;
  }>({
    query: `
      mutation($serviceId: String!, $environmentId: String!) {
        serviceInstanceDeployV2(serviceId: $serviceId, environmentId: $environmentId)
      }
    `,
    token,
    variables: { environmentId, serviceId },
  });

  return { deploymentId: data.serviceInstanceDeployV2 };
}

export async function createDomain(
  token: string,
  serviceId: string,
  environmentId: string
): Promise<{ domain: string }> {
  const data = await railwayGql<{
    serviceDomainCreate: { domain: string };
  }>({
    query: `
      mutation($serviceId: String!, $environmentId: String!) {
        serviceDomainCreate(input: {
          serviceId: $serviceId,
          environmentId: $environmentId
        }) {
          domain
        }
      }
    `,
    token,
    variables: { environmentId, serviceId },
  });

  return { domain: data.serviceDomainCreate.domain };
}

export async function getServiceDomains(
  token: string,
  projectId: string,
  environmentId?: string,
  serviceId?: string
): Promise<{ domain: string; serviceId: string }[]> {
  // If we have both serviceId and environmentId, query directly
  if (serviceId && environmentId) {
    const data = await railwayGql<{
      domains: {
        serviceDomains: { domain: string }[];
      };
    }>({
      query: `
        query($projectId: String!, $environmentId: String!, $serviceId: String!) {
          domains(
            projectId: $projectId
            environmentId: $environmentId
            serviceId: $serviceId
          ) {
            serviceDomains {
              domain
            }
          }
        }
      `,
      token,
      variables: { environmentId, projectId, serviceId },
    });

    return (data.domains.serviceDomains ?? []).map((sd) => ({
      domain: sd.domain,
      serviceId,
    }));
  }

  // Fallback: iterate over all services in the project
  const servicesData = await railwayGql<{
    project: {
      environments: { edges: { node: { id: string } }[] };
      services: { edges: { node: { id: string } }[] };
    };
  }>({
    query: `
      query($projectId: String!) {
        project(id: $projectId) {
          services { edges { node { id } } }
          environments { edges { node { id } } }
        }
      }
    `,
    token,
    variables: { projectId },
  });

  const envId =
    servicesData.project.environments.edges[0]?.node.id ?? undefined;
  if (!envId) {
    return [];
  }

  const results: { domain: string; serviceId: string }[] = [];
  for (const edge of servicesData.project.services.edges) {
    const svcId = edge.node.id;
    const data = await railwayGql<{
      domains: {
        serviceDomains: { domain: string }[];
      };
    }>({
      query: `
        query($projectId: String!, $environmentId: String!, $serviceId: String!) {
          domains(
            projectId: $projectId
            environmentId: $environmentId
            serviceId: $serviceId
          ) {
            serviceDomains {
              domain
            }
          }
        }
      `,
      token,
      variables: { environmentId: envId, projectId, serviceId: svcId },
    });

    for (const sd of data.domains.serviceDomains ?? []) {
      results.push({ domain: sd.domain, serviceId: svcId });
    }
  }
  return results;
}

export type DeploymentStatus =
  | "BUILDING"
  | "CRASHED"
  | "DEPLOYING"
  | "FAILED"
  | "INITIALIZING"
  | "REMOVED"
  | "SLEEPING"
  | "SUCCESS"
  | "WAITING";

export async function getDeploymentStatus(
  token: string,
  deploymentId: string
): Promise<{ status: DeploymentStatus }> {
  const data = await railwayGql<{
    deployment: { status: DeploymentStatus };
  }>({
    query: `
      query($deploymentId: String!) {
        deployment(id: $deploymentId) {
          status
        }
      }
    `,
    token,
    variables: { deploymentId },
  });

  return { status: data.deployment.status };
}
