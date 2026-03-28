import { Button } from "@crabfold/ui/components/button";

export default function AgentSettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-sm font-semibold text-foreground">Agent Settings</h2>

      {/* Env vars */}
      <div className="flex flex-col gap-3 border border-border p-4">
        <h3 className="text-xs font-medium text-foreground">
          Environment Variables
        </h3>
        <div className="flex flex-col gap-2">
          {[
            { key: "GITHUB_TOKEN", value: "••••••••" },
            { key: "SLACK_WEBHOOK_URL", value: "••••••••" },
          ].map((env) => (
            <div key={env.key} className="flex items-center gap-2">
              <code className="w-48 font-mono text-xs text-muted-foreground">
                {env.key}
              </code>
              <code className="font-mono text-xs text-muted-foreground/50">
                {env.value}
              </code>
            </div>
          ))}
        </div>
      </div>

      {/* Danger zone */}
      <div className="flex flex-col gap-3 border border-destructive/20 p-4">
        <h3 className="text-xs font-medium text-destructive">Danger Zone</h3>
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-foreground">Delete this agent</span>
            <span className="text-xs text-muted-foreground">
              This action cannot be undone
            </span>
          </div>
          <Button variant="destructive" size="sm">
            Delete agent
          </Button>
        </div>
      </div>
    </div>
  );
}
