import { Puzzle } from "lucide-react";

export default function ConnectorsPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-4">
      <Puzzle className="size-8 text-muted-foreground" />
      <h1 className="text-sm font-semibold text-foreground">
        Skill Marketplace
      </h1>
      <p className="text-xs text-muted-foreground">
        Browse and install skills from Clawhub
      </p>
    </div>
  );
}
