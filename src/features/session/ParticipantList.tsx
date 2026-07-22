import { ParticipantRow } from '../../lib/types';
import { Avatar } from '../../components/Avatar';

interface ParticipantListProps {
  participants: ParticipantRow[];
  presence: Record<string, 'joined' | 'left' | 'drawing' | 'idle'>;
  currentUserId: string | undefined;
  isHost: boolean;
  onToggleDraw: (userId: string, canDraw: boolean) => void;
  onAllowAll: () => void;
  onMuteAll: () => void;
}

export function ParticipantList({ participants, presence, currentUserId, isHost, onToggleDraw, onAllowAll, onMuteAll }: ParticipantListProps) {
  const sorted = [...participants].sort((a, b) => {
    const aHost = a.role_in_session === 'teacher' || a.role_in_session === 'admin' ? 0 : 1;
    const bHost = b.role_in_session === 'teacher' || b.role_in_session === 'admin' ? 0 : 1;
    if (aHost !== bHost) return aHost - bHost;
    return (a.profile?.name || '').localeCompare(b.profile?.name || '');
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <h3 className="text-sm font-semibold">Participants</h3>
        <span className="text-xs text-ink-500 dark:text-ink-300">{participants.length}</span>
      </div>
      {isHost && (
        <div className="flex gap-2 px-4 pb-2">
          <button onClick={onAllowAll} className="tb-btn-ghost flex-1 text-xs">Allow all</button>
          <button onClick={onMuteAll} className="tb-btn-ghost flex-1 text-xs">Mute all</button>
        </div>
      )}
      <ul className="flex-1 space-y-1 overflow-y-auto px-2 pb-4">
        {sorted.map((p) => {
          const isMe = p.user_id === currentUserId;
          const name = p.profile?.name || 'Unknown';
          const status = presence[p.user_id] || 'idle';
          const online = status !== 'left';
          const drawing = status === 'drawing';
          const canDraw = p.can_draw || p.role_in_session === 'teacher' || p.role_in_session === 'admin';
          return (
            <li key={p.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-ink-100 dark:hover:bg-ink-700/60">
              <Avatar name={name} size={32} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-sm font-medium">{name}{isMe && <span className="text-ink-400"> (you)</span>}</p>
                  {drawing && (
                    <span className="tb-badge bg-accent-500/15 text-accent-600 dark:text-accent-400">
                      <span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-accent-500" /> drawing
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-ink-500 dark:text-ink-300">
                  <span className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-success' : 'bg-ink-300'}`} />
                  <span className="capitalize">{p.role_in_session}</span>
                </div>
              </div>
              {isHost && p.role_in_session === 'student' && (
                <button onClick={() => onToggleDraw(p.user_id, !p.can_draw)} role="switch" aria-checked={canDraw} aria-label={`Toggle draw access for ${name}`}
                  className={`relative h-6 w-11 rounded-full transition ${canDraw ? 'bg-brand-500' : 'bg-ink-300 dark:bg-ink-600'}`}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${canDraw ? 'left-[22px]' : 'left-0.5'}`} />
                </button>
              )}
              {!isHost && canDraw && (
                <span className="tb-badge bg-brand-500/10 text-brand-600 dark:text-brand-300">can draw</span>
              )}
            </li>
          );
        })}
        {participants.length === 0 && (
          <li className="px-2 py-6 text-center text-sm text-ink-400">No participants yet.</li>
        )}
      </ul>
    </div>
  );
}
