export default function CallbackPage() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="size-4 animate-spin border-2 border-muted-foreground border-t-transparent rounded-full" />
      <p className="text-xs text-muted-foreground">Authenticating...</p>
    </div>
  );
}
