export type Framework = "openclaw" | "ironclaw" | "nanobot";

export interface Skill {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

export interface WorkspaceFile {
  name: string;
  content: string;
}
