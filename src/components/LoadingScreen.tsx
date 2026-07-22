export function LoadingScreen({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-ink-50 dark:bg-ink-800">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      <p className="text-sm text-ink-500 dark:text-ink-300">{label}</p>
    </div>
  );
}
