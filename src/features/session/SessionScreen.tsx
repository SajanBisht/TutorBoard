import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { useBoardSync, emitEvent, setParticipantCanDraw } from './useBoardSync';
import { useVideoCall } from './useVideoCall';
import { BoardCanvas } from './BoardCanvas';
import { Toolbar, Tool, ToolColor, COLORS } from './toolbar';
import { ParticipantList } from './ParticipantList';
import { VideoTile } from './VideoTile';
import { ThemeToggle } from '../../components/ThemeToggle';
import { Logo } from '../auth/LoginScreen';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { endSession, leaveSession } from '../lobby/sessionApi';
import { SessionPanel } from '../../lib/types';
import { supabase } from '../../lib/supabase';

export function SessionScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const sessionId = id!;

  const { items, loading, error, connected, participants, presence, session, myCanDraw, setItems } = useBoardSync({
    sessionId, userId: user?.id, profile,
  });

  const {
    localStream, peers, micEnabled, camEnabled, screenStream,
    error: camError, status: camStatus,
    startCamera, toggleMic, toggleCam, startScreenShare, stopScreenShare, endCall,
  } = useVideoCall({ sessionId, userId: user?.id, userName: profile?.name });

  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState<ToolColor>(COLORS[1]);
  const [width, setWidth] = useState(3);
  const [activePanel, setActivePanel] = useState<SessionPanel>('video');
  const [showParticipants, setShowParticipants] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [showScreenSharePopup, setShowScreenSharePopup] = useState(false);
  const [showFilePopup, setShowFilePopup] = useState(false);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [fileType, setFileType] = useState<'pdf' | 'image' | 'file' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isHost = !!profile && (profile.role === 'admin' || profile.role === 'teacher') && session?.created_by === user?.id;
  const sessionEnded = session?.status === 'ended';
  const peerList = Array.from(peers.values());
  const totalParticipants = 1 + peerList.length;

  const flash = (msg: string) => { setSnackbar(msg); setTimeout(() => setSnackbar(null), 2500); };

  const onStrokeCommit = useCallback((strokeId: string, points: { x: number; y: number }[]) => {
    if (!user?.id) return;
    emitEvent(sessionId, user.id, 'stroke', { strokeId, userId: user.id, color: color.value, width, points, complete: true });
  }, [sessionId, user?.id, color.value, width]);

  const onTextCommit = useCallback((textId: string, content: string, x: number, y: number) => {
    if (!user?.id) return;
    emitEvent(sessionId, user.id, 'text', { textId, userId: user.id, content, x, y, fontSize: 16, color: color.value });
  }, [sessionId, user?.id, color.value]);

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
    endCall();
    const err = await endSession(sessionId);
    if (err) { flash(`Failed: ${err}`); return; }
    navigate('/lobby');
  };

  const onExitSession = async () => {
    setConfirmExit(false);
    if (!sessionId || !user?.id) return;
    endCall();
    const err = await leaveSession(sessionId, user.id);
    if (err) { flash(`Failed: ${err}`); return; }
    navigate('/lobby');
  };

  const onBoardClick = useCallback(() => {
    if (activePanel === 'board') {
      setActivePanel('video');
    } else {
      setActivePanel('board');
    }
  }, [activePanel]);

  const onScreenShareConfirm = useCallback(async () => {
    setShowScreenSharePopup(false);
    const ok = await startScreenShare();
    if (ok) {
      setActivePanel('screenshare');
      flash('Screen sharing started.');
    } else {
      flash('Screen share was cancelled.');
    }
  }, [startScreenShare]);

  const onScreenShareClick = useCallback(() => {
    if (screenStream) {
      stopScreenShare();
      setActivePanel('video');
      flash('Screen sharing stopped.');
    } else {
      setShowScreenSharePopup(true);
    }
  }, [screenStream, stopScreenShare]);

  const onFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const isPdf = ext === 'pdf';
    const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext);
    const type = isPdf ? 'pdf' : isImage ? 'image' : 'file';
    setFileType(type);
    setFileName(file.name);

    const path = `${sessionId}/files/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from('group-media').upload(path, file, { cacheControl: '3600', upsert: false });
    if (upErr) { flash(`Upload failed: ${upErr.message}`); e.target.value = ''; return; }
    const { data: pub } = supabase.storage.from('group-media').getPublicUrl(path);
    setFileUrl(pub.publicUrl);
    setShowFilePopup(true);
    e.target.value = '';
  }, [sessionId, user?.id]);

  const onFileConfirm = useCallback(() => {
    setShowFilePopup(false);
    setActivePanel('file');
  }, []);

  const onFileClick = useCallback(() => {
    if (activePanel === 'file') {
      setActivePanel('video');
      setFileUrl(null);
    } else {
      fileInputRef.current?.click();
    }
  }, [activePanel]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-ink-50 dark:bg-ink-800">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        <p className="ml-3 text-sm text-ink-500">Loading session…</p>
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
          {sessionEnded && <span className="tb-badge bg-ink-200/60 text-ink-600 dark:bg-ink-600/60 dark:text-ink-200">Ended</span>}
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

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col">
          {/* Main content area */}
          <div className="relative flex-1 overflow-hidden bg-ink-100 dark:bg-ink-900">
            {activePanel === 'video' && (
              <VideoGrid localStream={localStream} peers={peerList} camStatus={camStatus} camError={camError} micEnabled={micEnabled} camEnabled={camEnabled} userName={profile?.name || 'You'} onStartCamera={startCamera} screenStream={screenStream} />
            )}
            {activePanel === 'board' && (
              <div className="relative h-full w-full">
                <BoardCanvas items={items} tool={tool} color={color} width={width}
                  canDraw={myCanDraw && !sessionEnded}
                  onStrokeCommit={onStrokeCommit} onTextCommit={onTextCommit} onErase={onErase} />
                <div className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2">
                  <Toolbar tool={tool} setTool={setTool} color={color} setColor={setColor} width={width} setWidth={setWidth}
                    canDraw={myCanDraw && !sessionEnded} onClear={onClear} />
                </div>
              </div>
            )}
            {activePanel === 'screenshare' && screenStream && (
              <ScreenShareView stream={screenStream} userName={profile?.name || 'You'} onStop={() => { stopScreenShare(); setActivePanel('video'); }} />
            )}
            {activePanel === 'file' && fileUrl && (
              <FileViewer url={fileUrl} name={fileName} type={fileType} onClose={() => { setActivePanel('video'); setFileUrl(null); }} />
            )}
          </div>

          {/* Bottom control bar */}
          {!sessionEnded && (
            <div className="flex items-center justify-center gap-2 border-t border-ink-200 bg-white px-4 py-3 dark:border-ink-700 dark:bg-ink-700/60">
              {/* Mic */}
              <ControlButton active={micEnabled} onClick={toggleMic} disabled={camStatus !== 'active'} label={micEnabled ? 'Mute' : 'Unmute'} color={micEnabled ? 'brand' : 'danger'}>
                {micEnabled ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23" /><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" /><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" /><line x1="12" y1="19" x2="12" y2="23" /></svg>
                )}
              </ControlButton>
              {/* Cam */}
              <ControlButton active={camEnabled} onClick={toggleCam} disabled={camStatus !== 'active'} label={camEnabled ? 'Stop Video' : 'Start Video'} color={camEnabled ? 'brand' : 'danger'}>
                {camEnabled ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23" /><path d="M21 21H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3l1-1h6" /><polygon points="23 7 16 12 23 17 23 7" /></svg>
                )}
              </ControlButton>
              <div className="mx-1 h-8 w-px bg-ink-200 dark:bg-ink-600" />
              {/* Board */}
              <ControlButton active={activePanel === 'board'} onClick={onBoardClick} label="Board" color="brand">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></svg>
              </ControlButton>
              {/* Screen share */}
              <ControlButton active={activePanel === 'screenshare'} onClick={onScreenShareClick} label={screenStream ? 'Stop Share' : 'Share Screen'} color={screenStream ? 'danger' : 'brand'}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 3a4 4 0 0 1 4 4v4l2-2 2 2-5 5-5-5 2-2 2 2V7a2 2 0 0 0-2-2H3" /><path d="M3 21h18" /></svg>
              </ControlButton>
              {/* File */}
              <input ref={fileInputRef} type="file" accept=".pdf,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.xls,.xlsx,.txt" className="hidden" onChange={onFileSelect} />
              <ControlButton active={activePanel === 'file'} onClick={onFileClick} label="File" color="brand">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
              </ControlButton>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="hidden w-72 shrink-0 border-l border-ink-200 bg-white dark:border-ink-700 dark:bg-ink-700/60 md:flex md:flex-col">
          <ParticipantList participants={participants} presence={presence} currentUserId={user?.id}
            isHost={isHost} onToggleDraw={onToggleDraw} onAllowAll={onAllowAll} onMuteAll={onMuteAll} />
        </aside>
      </div>

      {/* Mobile participant drawer */}
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

      {/* Share code banner */}
      {showCode && isHost && session && (
        <div className="animate-slideDown fixed top-16 left-1/2 z-30 -translate-x-1/2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 shadow-float dark:border-brand-700 dark:bg-brand-500/10">
          <div className="flex flex-col items-center gap-2">
            <p className="text-xs font-medium text-brand-600 dark:text-brand-300">Share this join code:</p>
            <p className="font-display text-2xl font-bold tracking-[0.3em] text-ink-800 dark:text-ink-50">{session.join_code}</p>
            <button onClick={copyCode} className="tb-btn-primary text-xs">Copy code</button>
          </div>
        </div>
      )}

      {/* Snackbar */}
      {snackbar && (
        <div className="fixed bottom-20 left-1/2 z-40 -translate-x-1/2 rounded-lg bg-ink-800 px-4 py-2 text-sm text-white shadow-float dark:bg-ink-900">{snackbar}</div>
      )}

      {/* Screen share confirmation popup */}
      {showScreenSharePopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowScreenSharePopup(false)} />
          <div className="relative w-full max-w-md animate-popIn rounded-2xl border border-ink-200 bg-white p-5 shadow-float dark:border-ink-700 dark:bg-ink-700">
            <div className="mb-3 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500/10 text-brand-500">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 3a4 4 0 0 1 4 4v4l2-2 2 2-5 5-5-5 2-2 2 2V7a2 2 0 0 0-2-2H3" /><path d="M3 21h18" /></svg>
              </div>
              <div>
                <h3 className="font-display text-base font-semibold">Share your screen?</h3>
                <p className="text-sm text-ink-500 dark:text-ink-300">Other participants will see your screen in the session.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowScreenSharePopup(false)} className="tb-btn-secondary">Cancel</button>
              <button onClick={onScreenShareConfirm} className="tb-btn-primary">Share screen</button>
            </div>
          </div>
        </div>
      )}

      {/* File share confirmation popup */}
      {showFilePopup && fileUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowFilePopup(false)} />
          <div className="relative w-full max-w-md animate-popIn rounded-2xl border border-ink-200 bg-white p-5 shadow-float dark:border-ink-700 dark:bg-ink-700">
            <div className="mb-3 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500/10 text-brand-500">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
              </div>
              <div>
                <h3 className="font-display text-base font-semibold">Share this {fileType === 'pdf' ? 'PDF' : fileType === 'image' ? 'image' : 'file'}?</h3>
                <p className="truncate text-sm text-ink-500 dark:text-ink-300">{fileName}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowFilePopup(false)} className="tb-btn-secondary">Cancel</button>
              <button onClick={onFileConfirm} className="tb-btn-primary">Share with everyone</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog open={confirmClose} danger title="Close this session?" description="The board becomes read-only for everyone. This cannot be undone." confirmLabel="Close session"
        onConfirm={onCloseSession} onCancel={() => setConfirmClose(false)} />
      <ConfirmDialog open={confirmExit} title="Exit this session?" description="You will leave the session and return to the lobby." confirmLabel="Exit"
        onConfirm={onExitSession} onCancel={() => setConfirmExit(false)} />
    </div>
  );
}

function ControlButton({ active, onClick, disabled, label, color = 'brand', children }: { active: boolean; onClick: () => void; disabled?: boolean; label: string; color?: 'brand' | 'danger'; children: React.ReactNode }) {
  const base = 'grid h-11 w-11 place-items-center rounded-xl transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40';
  const cls = active
    ? (color === 'danger' ? 'bg-danger text-white' : 'bg-brand-500 text-white')
    : 'border border-ink-200 bg-white text-ink-600 hover:bg-ink-100 dark:border-ink-700 dark:bg-ink-700 dark:text-ink-200 dark:hover:bg-ink-600';
  return (
    <button onClick={onClick} disabled={disabled} aria-label={label} className={`${base} ${cls}`} title={label}>
      {children}
    </button>
  );
}

function VideoGrid({ localStream, peers, camStatus, camError, micEnabled, camEnabled, userName, onStartCamera, screenStream }: {
  localStream: MediaStream | null;
  peers: { userId: string; name?: string; stream: MediaStream | null; audioEnabled: boolean; videoEnabled: boolean; connected: boolean }[];
  camStatus: string;
  camError: string | null;
  micEnabled: boolean;
  camEnabled: boolean;
  userName: string;
  onStartCamera: () => void;
  screenStream: MediaStream | null;
}) {
  if (camStatus === 'idle' || camStatus === 'denied') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-brand-500/10 text-brand-500">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
        </div>
        <div>
          <h3 className="font-display text-lg font-bold">{camStatus === 'denied' ? 'Camera access denied' : 'Start video call'}</h3>
          <p className="mt-1 max-w-sm text-sm text-ink-500 dark:text-ink-300">
            {camStatus === 'denied' ? camError : 'Allow camera and microphone access to join the video call. You can also use the board and file sharing without video.'}
          </p>
        </div>
        {camStatus !== 'denied' && (
          <button onClick={onStartCamera} className="tb-btn-primary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
            Allow camera & mic
          </button>
        )}
      </div>
    );
  }

  if (camStatus === 'requesting') {
    return (
      <div className="flex h-full items-center justify-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        <p className="text-sm text-ink-500">Requesting camera and microphone…</p>
      </div>
    );
  }

  const allTiles = [
    { key: 'local', stream: screenStream || localStream, name: userName, isLocal: true, micEnabled: screenStream ? true : micEnabled, camEnabled: screenStream ? true : camEnabled },
    ...peers.filter((p) => p.stream).map((p) => ({ key: p.userId, stream: p.stream, name: p.name || 'Peer', isLocal: false, micEnabled: p.audioEnabled, camEnabled: p.videoEnabled })),
  ];

  const cols = allTiles.length <= 1 ? 1 : allTiles.length <= 4 ? 2 : 3;

  return (
    <div className="grid h-full gap-2 p-2" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridAutoRows: '1fr' }}>
      {allTiles.map((t) => (
        <VideoTile key={t.key} stream={t.stream} name={t.name} isLocal={t.isLocal} micEnabled={t.micEnabled} camEnabled={t.camEnabled} className="min-h-[120px]" />
      ))}
    </div>
  );
}

function ScreenShareView({ stream, userName, onStop }: { stream: MediaStream; userName: string; onStop: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);
  return (
    <div className="relative h-full w-full bg-black">
      <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-contain" />
      <div className="absolute bottom-3 left-3 flex items-center gap-2">
        <span className="tb-badge bg-brand-500 text-white">
          <span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-white" /> Sharing
        </span>
        <span className="text-xs text-white/80">{userName}'s screen</span>
      </div>
      <button onClick={onStop} className="absolute bottom-3 right-3 tb-btn-danger text-xs">Stop sharing</button>
    </div>
  );
}

function FileViewer({ url, name, type, onClose }: { url: string; name: string; type: 'pdf' | 'image' | 'file' | null; onClose: () => void }) {
  return (
    <div className="flex h-full w-full flex-col bg-ink-100 dark:bg-ink-900">
      <div className="flex items-center justify-between border-b border-ink-200 bg-white px-4 py-2 dark:border-ink-700 dark:bg-ink-700/60">
        <div className="flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink-500"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
          <span className="text-sm font-medium">{name}</span>
        </div>
        <button onClick={onClose} className="tb-btn-secondary text-xs">Close file</button>
      </div>
      <div className="flex-1 overflow-auto">
        {type === 'pdf' && (
          <iframe src={url} className="h-full w-full border-0" title={name} />
        )}
        {type === 'image' && (
          <div className="flex h-full items-center justify-center p-4">
            <img src={url} alt={name} className="max-h-full max-w-full rounded-lg shadow-float" />
          </div>
        )}
        {type === 'file' && (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-brand-500/10 text-brand-500">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
            </div>
            <div>
              <p className="font-medium">{name}</p>
              <p className="text-sm text-ink-500 dark:text-ink-300">Preview not available for this file type.</p>
            </div>
            <a href={url} target="_blank" rel="noreferrer" download={name} className="tb-btn-primary">Download file</a>
          </div>
        )}
      </div>
    </div>
  );
}
