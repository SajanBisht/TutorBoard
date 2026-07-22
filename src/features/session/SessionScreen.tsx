import { useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { useBoardSync, emitEvent, setParticipantCanDraw } from './useBoardSync';
import { BoardCanvas } from './BoardCanvas';
import { Toolbar, Tool, ToolColor, COLORS } from './toolbar';
import { ParticipantList } from './ParticipantList';
import { ThemeToggle } from '../../components/ThemeToggle';
import { Logo } from '../auth/LoginScreen';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { endSession, leaveSession } from '../lobby/sessionApi';

export function SessionScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const sessionId = id!;

  const { items, loading, error, connected, participants, presence, session, myCanDraw, setItems } = useBoardSync({
    sessionId, userId: user?.id, profile,
  });

  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState<ToolColor>(COLORS[1]);
  const [width, setWidth] = useState(3);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);

  const isHost = !!profile && (profile.role === 'admin' || profile.role === 'teacher') && session?.created_by === user?.id;
  const sessionEnded = session?.status === 'ended';

  const flash = (msg: string) => { setSnackbar(msg); setTimeout(() => setSnackbar(null), 2500); };

  const onStrokeCommit = useCallback((strokeId: string, points: { x: number; y: number }[]) => {
    if (!user?.id) return;
    emitEvent(sessionId, user.id, 'stroke', { strokeId, userId: user.id, color: color.value, width, points, complete: true });
  }, [sessionId, user?.id, color.value, width]);

  const onTextCommit = useCallback((textId: string, content: string, x: number, y: number) => {
    if (!user?.id) return;
    emitEvent(sessionId, user.id, 'text', { textId, userId: user.id, content, x, y, fontSize: 16 });
  }, [sessionId, user?.id]);

  const onErase = useCallback((targetId: string) => {
    if (!user?.id) return;
    emitEvent(sessionId, user.id, 'erase', { targetId });
  }, [sessionId, user?.id]);

  const onClear = useCallback(() => {
    if (!user?.id) return;
    setItems([]);
    emitEvent(sessionId, user.id, 'clear', { scope: 'all' });
  }, [sessionId, user?.id, setItems]);

  const onToggleDraw = useCallback(async (targetUserId: string, canDraw: boolean) => {
    if (!user?.id) return;
    const err = await setParticipantCanDraw(sessionId, targetUserId, canDraw, user.id);
    if (err) flash(`Failed: ${err}`);
  }, [sessionId, user?.id]);

  const onAllowAll = useCallback(async () => {
    if (!user?.id) return;
    const students = participants.filter((p) => p.role_in_session === 'student');
    for (const s of students) await setParticipantCanDraw(sessionId, s.user_id, true, user.id);
    flash('All students can draw.');
  }, [sessionId, user?.id, participants]);

  const onMuteAll = useCallback(async () => {
    if (!user?.id) return;
    const students = participants.filter((p) => p.role_in_session === 'student');
    for (const s of students) await setParticipantCanDraw(sessionId, s.user_id, false, user.id);
    flash('All students muted.');
  }, [sessionId, user?.id, participants]);

  const copyCode = () => {
    if (!session?.join_code) return;
    navigator.clipboard?.writeText(session.join_code).then(() => flash('Join code copied'));
  };

  const onCloseSession = async () => {
    setConfirmClose(false);
    if (!sessionId) return;
    const err = await endSession(sessionId);
    if (err) { flash(`Failed: ${err}`); return; }
    navigate('/lobby');
  };

  const onExitSession = async () => {
    setConfirmExit(false);
    if (!sessionId || !user?.id) return;
    const err = await leaveSession(sessionId, user.id);
    if (err) { flash(`Failed: ${err}`); return; }
    navigate('/lobby');
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-ink-50 dark:bg-ink-800">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        <p className="ml-3 text-sm text-ink-500">Loading board…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-ink-50 dark:bg-ink-800">
        <p className="text-sm text-danger">{error}</p>
        <button onClick={() => navigate('/lobby')} className="tb-btn-secondary">Back to lobby</button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-ink-50 dark:bg-ink-800">
      <header className="z-20 flex items-center justify-between border-b border-ink-200 bg-white px-4 py-3 dark:border-ink-700 dark:bg-ink-700/60">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/lobby')} className="tb-btn-ghost" aria-label="Back to lobby">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          </button>
          <div className="flex items-center gap-2">
            <Logo />
            <div>
              <p className="font-display text-sm font-bold leading-tight">{session?.title}</p>
              <button onClick={() => setShowCode((v) => !v)} className="text-[11px] text-ink-500 hover:text-brand-500 dark:text-ink-300">
                {session?.status === 'live' ? 'Live' : session?.status === 'ended' ? 'Ended' : 'Scheduled'} · Code <span className="font-mono font-semibold">{session?.join_code}</span>
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {session?.status === 'live' && (
            <span className="tb-badge bg-accent-500/15 text-accent-600 dark:text-accent-400">
              <span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-accent-500" /> LIVE
            </span>
          )}
          {sessionEnded && (
            <span className="tb-badge bg-ink-200/60 text-ink-600 dark:bg-ink-600/60 dark:text-ink-200">Ended</span>
          )}
          {isHost && !sessionEnded && (
            <button onClick={() => setShowCode((v) => !v)} className="tb-btn-secondary text-xs" aria-label="Show join code">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
              Share code
            </button>
          )}
          {isHost ? (
            !sessionEnded && <button onClick={() => setConfirmClose(true)} className="tb-btn-secondary text-xs text-danger">Close session</button>
          ) : (
            <button onClick={() => setConfirmExit(true)} className="tb-btn-secondary text-xs">Exit session</button>
          )}
          <button onClick={() => setShowParticipants((v) => !v)} className="tb-btn-secondary md:hidden" aria-label="Participants">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
          </button>
          <ThemeToggle />
        </div>
      </header>

      {showCode && isHost && session && (
        <div className="animate-slideDown border-b border-brand-200 bg-brand-50 px-4 py-3 dark:border-brand-700 dark:bg-brand-500/10">
          <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 sm:flex-row">
            <div>
              <p className="text-xs font-medium text-brand-600 dark:text-brand-300">Share this join code with your students:</p>
              <p className="font-display text-3xl font-bold tracking-[0.3em] text-ink-800 dark:text-ink-50">{session.join_code}</p>
            </div>
            <button onClick={copyCode} className="tb-btn-primary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
              Copy code
            </button>
          </div>
        </div>
      )}

      {!connected && !sessionEnded && (
        <div className="animate-slideDown bg-warning/15 px-4 py-2 text-center text-xs font-medium text-warning">Reconnecting… live updates may be delayed.</div>
      )}

      {sessionEnded && (
        <div className="animate-slideDown bg-ink-200/40 px-4 py-2 text-center text-xs font-medium text-ink-600 dark:bg-ink-700/40 dark:text-ink-300">This session has ended. The board is now read-only.</div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="relative flex-1">
          <BoardCanvas items={items} tool={tool} color={color} width={width}
            canDraw={myCanDraw && !sessionEnded}
            onStrokeCommit={onStrokeCommit}
            onTextCommit={onTextCommit} onErase={onErase} />
          <div className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2">
            <Toolbar tool={tool} setTool={setTool} color={color} setColor={setColor} width={width} setWidth={setWidth}
              canDraw={myCanDraw && !sessionEnded} onClear={onClear} />
          </div>
        </div>

        <aside className="hidden w-72 shrink-0 border-l border-ink-200 bg-white dark:border-ink-700 dark:bg-ink-700/60 md:block">
          <ParticipantList participants={participants} presence={presence} currentUserId={user?.id}
            isHost={isHost} onToggleDraw={onToggleDraw} onAllowAll={onAllowAll} onMuteAll={onMuteAll} />
        </aside>
      </div>

      {showParticipants && (
        <div className="fixed inset-0 z-30 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowParticipants(false)} />
          <div className="absolute bottom-0 left-0 right-0 max-h-[70vh] rounded-t-2xl border-t border-ink-200 bg-white pb-4 dark:border-ink-700 dark:bg-ink-700">
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-ink-300" />
            <ParticipantList participants={participants} presence={presence} currentUserId={user?.id}
              isHost={isHost} onToggleDraw={onToggleDraw} onAllowAll={onAllowAll} onMuteAll={onMuteAll} />
          </div>
        </div>
      )}

      {snackbar && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 rounded-lg bg-ink-800 px-4 py-2 text-sm text-white shadow-float dark:bg-ink-900">{snackbar}</div>
      )}

      <ConfirmDialog open={confirmClose} danger title="Close this session?" description="The board becomes read-only for everyone. This cannot be undone." confirmLabel="Close session"
        onConfirm={onCloseSession} onCancel={() => setConfirmClose(false)} />
      <ConfirmDialog open={confirmExit} title="Exit this session?" description="You will leave the whiteboard and return to the lobby. You can rejoin with the code." confirmLabel="Exit"
        onConfirm={onExitSession} onCancel={() => setConfirmExit(false)} />
    </div>
  );
}
