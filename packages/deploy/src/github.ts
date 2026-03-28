import type { AgentFileInput } from "./types";

const GITHUB_API = "https://api.github.com";

interface GithubRequestOptions {
  body?: unknown;
  method: string;
  path: string;
  token: string;
}

async function githubApi<T>(options: GithubRequestOptions): Promise<T> {
  const res = await fetch(`${GITHUB_API}${options.path}`, {
    body: options.body ? JSON.stringify(options.body) : undefined,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${options.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    method: options.method,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API error (${res.status}): ${text}`);
  }

  return (await res.json()) as T;
}

export async function createRepo(
  token: string,
  name: string,
  description: string
): Promise<{ defaultBranch: string; fullName: string; repoUrl: string }> {
  const res = await fetch(`${GITHUB_API}/user/repos`, {
    body: JSON.stringify({
      auto_init: true,
      description,
      name,
      private: false,
    }),
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    method: "POST",
  });

  if (res.status === 422) {
    // Repo already exists — fetch it instead
    const user = await githubApi<{ login: string }>({
      method: "GET",
      path: "/user",
      token,
    });
    const existing = await githubApi<{
      default_branch: string;
      full_name: string;
      html_url: string;
    }>({
      method: "GET",
      path: `/repos/${user.login}/${name}`,
      token,
    });
    return {
      defaultBranch: existing.default_branch,
      fullName: existing.full_name,
      repoUrl: existing.html_url,
    };
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API error (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    default_branch: string;
    full_name: string;
    html_url: string;
  };

  return {
    defaultBranch: data.default_branch,
    fullName: data.full_name,
    repoUrl: data.html_url,
  };
}

/**
 * Push agent files to a GitHub repo using the Git Trees API.
 * Creates a single commit with all files.
 */
export async function pushFiles(
  token: string,
  fullName: string,
  branch: string,
  files: AgentFileInput[],
  commitMessage: string
): Promise<{ commitSha: string }> {
  const ref = await githubApi<{ object: { sha: string } }>({
    method: "GET",
    path: `/repos/${fullName}/git/ref/heads/${branch}`,
    token,
  });
  const latestCommitSha = ref.object.sha;

  const commit = await githubApi<{ tree: { sha: string } }>({
    method: "GET",
    path: `/repos/${fullName}/git/commits/${latestCommitSha}`,
    token,
  });
  const baseTreeSha = commit.tree.sha;

  const treeItems: {
    mode: string;
    path: string;
    sha: string;
    type: string;
  }[] = [];

  for (const file of files) {
    const blob = await githubApi<{ sha: string }>({
      body: {
        content: file.content,
        // eslint-disable-next-line unicorn/text-encoding-identifier-case -- GitHub API requires this exact casing
        encoding: "utf-8",
      },
      method: "POST",
      path: `/repos/${fullName}/git/blobs`,
      token,
    });
    treeItems.push({
      mode: "100644",
      path: file.path,
      sha: blob.sha,
      type: "blob",
    });
  }

  const tree = await githubApi<{ sha: string }>({
    body: {
      base_tree: baseTreeSha,
      tree: treeItems,
    },
    method: "POST",
    path: `/repos/${fullName}/git/trees`,
    token,
  });

  const newCommit = await githubApi<{ sha: string }>({
    body: {
      message: commitMessage,
      parents: [latestCommitSha],
      tree: tree.sha,
    },
    method: "POST",
    path: `/repos/${fullName}/git/commits`,
    token,
  });

  await githubApi({
    body: { force: true, sha: newCommit.sha },
    method: "PATCH",
    path: `/repos/${fullName}/git/refs/heads/${branch}`,
    token,
  });

  return { commitSha: newCommit.sha };
}
