import { SessionStatus } from '../lib/types';

export function SessionStatusBadge({ status }: { status: SessionStatus }) {
  const map: Record<SessionStatus, { label: string; cls: string }> = {
    scheduled: { label: 'Scheduled', cls: 'bg-ink-200/60 text-ink-600 dark:bg-ink-600/60 dark:text-ink-200' },
    live: { label: 'Live', cls: 'bg-accent-500/15 text-accent-600 dark:text-accent-400' },
    ended: { label: 'Ended', cls: 'bg-ink-100 text-ink-500 dark:bg-ink-700 dark:text-ink-400' },
  };
  const s = map[status];
  return (
    <span className={`tb-badge ${s.cls}`}>
      {status === 'live' && <span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-accent-500" />}
      {s.label}
    </span>
  );
}
