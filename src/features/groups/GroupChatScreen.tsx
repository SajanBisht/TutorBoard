import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { MessageRow, GroupRow, GroupMemberRow, Profile, MessageType } from '../../lib/types';
import { ThemeToggle } from '../../components/ThemeToggle';
import { Logo } from '../auth/LoginScreen';
import { Avatar } from '../../components/Avatar';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { fetchMessages, fetchGroupMembers, sendMessage, sendMediaMessage, deleteMessage, leaveGroup, getGroupJoinUrl } from './groupApi';

const EMOJIS = ['😀', '😂', '😍', '🤔', '👍', '👎', '❤️', '🔥', '🎉', '👏', '😢', '😡', '💯', '✅', '❌', '⭐', '🎓', '📚', '✏️', '💡', '🤝', '👋', '🙏', '💪'];

export function GroupChatScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const groupId = id!;

  const [group, setGroup] = useState<GroupRow | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [members, setMembers] = useState<GroupMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isOwner = group?.created_by === user?.id;

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const { data: g, error: gErr } = await supabase.from('groups').select().eq('id', groupId).maybeSingle();
    if (gErr || !g) { setError(gErr?.message || 'Group not found.'); setLoading(false); return; }
    setGroup(g as GroupRow);
    const [{ data: msgs, error: mErr }, { data: mems, error: memErr }] = await Promise.all([fetchMessages(groupId), fetchGroupMembers(groupId)]);
    if (mErr || memErr) { setError(mErr || memErr || 'Failed to load.'); setLoading(false); return; }
    setMessages(msgs || []);
    setMembers(mems || []);
    setLoading(false);
    scrollToBottom();
  }, [groupId, scrollToBottom]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`group:${groupId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `group_id=eq.${groupId}` }, (payload) => {
        const msg = payload.new as MessageRow;
        supabase.from('profiles').select('id, name, username, email, role, created_at').eq('id', msg.user_id).maybeSingle()
          .then(({ data: prof }) => {
            setMessages((prev) => {
              if (prev.some((m) => m.id === msg.id)) return prev;
              return [...prev, { ...msg, profile: prof as Profile | undefined }];
            });
            scrollToBottom();
          });
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages', filter: `group_id=eq.${groupId}` }, (payload) => {
        const msg = payload.old as MessageRow;
        setMessages((prev) => prev.filter((m) => m.id !== msg.id));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_members', filter: `group_id=eq.${groupId}` }, () => {
        fetchGroupMembers(groupId).then(({ data }) => { if (data) setMembers(data); });
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'group_members', filter: `group_id=eq.${groupId}` }, () => {
        fetchGroupMembers(groupId).then(({ data }) => { if (data) setMembers(data); });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [groupId, scrollToBottom]);

  const onSend = async () => {
    const text = input.trim();
    if (!text || !user?.id) return;
    setSending(true);
    const { error } = await sendMessage(groupId, user.id, text);
    setSending(false);
    if (error) { console.warn('send error', error); return; }
    setInput('');
    setShowEmoji(false);
  };

  const onEmoji = (emoji: string) => {
    setInput((prev) => prev + emoji);
  };

  const onFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: MessageType) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    setUploading(true);
    const { error } = await sendMediaMessage(groupId, user.id, type, file);
    setUploading(false);
    if (error) console.warn('upload error', error);
    e.target.value = '';
  };

  const onDeleteMessage = async (msgId: string) => {
    await deleteMessage(msgId);
  };

  const onLeave = async () => {
    setConfirmLeave(false);
    if (!user?.id) return;
    await leaveGroup(groupId, user.id);
    navigate('/groups');
  };

  const copyUrl = () => {
    if (!group) return;
    navigator.clipboard?.writeText(getGroupJoinUrl(group.slug)).then(() => {
      setShowShare(false);
    });
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-ink-50 dark:bg-ink-800">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        <p className="ml-3 text-sm text-ink-500">Loading group…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-ink-50 dark:bg-ink-800">
        <p className="text-sm text-danger">{error}</p>
        <button onClick={() => navigate('/groups')} className="tb-btn-secondary">Back to groups</button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-ink-50 dark:bg-ink-800">
      <header className="z-20 flex items-center justify-between border-b border-ink-200 bg-white px-4 py-3 dark:border-ink-700 dark:bg-ink-700/60">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/groups')} className="tb-btn-ghost" aria-label="Back to groups">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500/10 font-bold text-brand-500">{group?.name.charAt(0).toUpperCase()}</div>
            <div>
              <p className="font-display text-sm font-bold leading-tight">{group?.name}</p>
              <p className="text-[11px] text-ink-500 dark:text-ink-300">{members.length} members · /{group?.slug}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowShare(true)} className="tb-btn-secondary text-xs">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" /></svg>
            Share
          </button>
          <button onClick={() => setShowMembers((v) => !v)} className="tb-btn-secondary text-xs md:hidden">Members</button>
          {!isOwner && <button onClick={() => setConfirmLeave(true)} className="tb-btn-ghost text-xs text-danger">Leave</button>}
          <ThemeToggle />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col">
          <div ref={scrollRef} className="chat-scroll flex-1 overflow-y-auto px-4 py-4">
            <div className="mx-auto max-w-3xl space-y-3">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                  <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-500/10 text-brand-500">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                  </div>
                  <p className="text-sm font-medium">No messages yet</p>
                  <p className="text-xs text-ink-500 dark:text-ink-300">Send the first message to start the conversation.</p>
                </div>
              )}
              {messages.map((m, i) => {
                const isMe = m.user_id === user?.id;
                const showAvatar = i === 0 || messages[i - 1].user_id !== m.user_id || new Date(m.created_at).getTime() - new Date(messages[i - 1].created_at).getTime() > 5 * 60 * 1000;
                return <MessageBubble key={m.id} message={m} isMe={isMe} showAvatar={showAvatar} canDelete={isMe || isOwner} onDelete={() => onDeleteMessage(m.id)} />;
              })}
            </div>
          </div>

          {showEmoji && (
            <div className="animate-slideUp border-t border-ink-200 bg-white px-4 py-3 dark:border-ink-700 dark:bg-ink-700">
              <div className="mx-auto flex max-w-3xl flex-wrap gap-1">
                {EMOJIS.map((e) => (
                  <button key={e} onClick={() => onEmoji(e)} className="grid h-9 w-9 place-items-center rounded-lg text-xl transition hover:bg-ink-100 dark:hover:bg-ink-600">{e}</button>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-ink-200 bg-white px-4 py-3 dark:border-ink-700 dark:bg-ink-700/60">
            <div className="mx-auto flex max-w-3xl items-end gap-2">
              <div className="flex items-center gap-1">
                <button onClick={() => setShowEmoji((v) => !v)} className="grid h-9 w-9 place-items-center rounded-lg text-ink-500 transition hover:bg-ink-100 dark:hover:bg-ink-600" aria-label="Emoji">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" /></svg>
                </button>
                <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFileSelect(e, 'image')} />
                <button onClick={() => imageInputRef.current?.click()} disabled={uploading} className="grid h-9 w-9 place-items-center rounded-lg text-ink-500 transition hover:bg-ink-100 dark:hover:bg-ink-600" aria-label="Image">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
                </button>
                <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={(e) => onFileSelect(e, 'video')} />
                <button onClick={() => videoInputRef.current?.click()} disabled={uploading} className="grid h-9 w-9 place-items-center rounded-lg text-ink-500 transition hover:bg-ink-100 dark:hover:bg-ink-600" aria-label="Video">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                </button>
                <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => onFileSelect(e, 'file')} />
                <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="grid h-9 w-9 place-items-center rounded-lg text-ink-500 transition hover:bg-ink-100 dark:hover:bg-ink-600" aria-label="File">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
                </button>
              </div>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }}
                rows={1}
                className="tb-input max-h-32 min-h-[40px] flex-1 resize-none py-2"
                placeholder="Type a message…"
              />
              <button onClick={onSend} disabled={sending || !input.trim()} className="tb-btn-primary shrink-0" aria-label="Send">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
              </button>
            </div>
            {uploading && <p className="mt-1 text-center text-[11px] text-ink-500">Uploading…</p>}
          </div>
        </div>

        <aside className="hidden w-64 shrink-0 border-l border-ink-200 bg-white dark:border-ink-700 dark:bg-ink-700/60 md:block">
          <MemberList members={members} currentUserId={user?.id} />
        </aside>
      </div>

      {showMembers && (
        <div className="fixed inset-0 z-30 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowMembers(false)} />
          <div className="absolute bottom-0 left-0 right-0 max-h-[70vh] rounded-t-2xl border-t border-ink-200 bg-white pb-4 dark:border-ink-700 dark:bg-ink-700">
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-ink-300" />
            <MemberList members={members} currentUserId={user?.id} />
          </div>
        </div>
      )}

      {showShare && group && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowShare(false)} />
          <div className="relative w-full max-w-md animate-popIn rounded-2xl border border-ink-200 bg-white p-5 shadow-float dark:border-ink-700 dark:bg-ink-700">
            <h3 className="mb-1 font-display text-lg font-bold">Share group</h3>
            <p className="mb-4 text-sm text-ink-500 dark:text-ink-300">Anyone with this URL can join the group.</p>
            <div className="flex items-center gap-2 rounded-lg border border-ink-200 bg-ink-50 p-3 dark:border-ink-600 dark:bg-ink-800">
              <span className="flex-1 truncate font-mono text-sm text-ink-700 dark:text-ink-200">{getGroupJoinUrl(group.slug)}</span>
              <button onClick={copyUrl} className="tb-btn-primary text-xs">Copy</button>
            </div>
            <div className="mt-3 flex justify-end">
              <button onClick={() => setShowShare(false)} className="tb-btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog open={confirmLeave} title="Leave this group?" description="You will no longer receive messages from this group. You can rejoin with the URL." confirmLabel="Leave" danger
        onConfirm={onLeave} onCancel={() => setConfirmLeave(false)} />
    </div>
  );
}

function MessageBubble({ message, isMe, showAvatar, canDelete, onDelete }: { message: MessageRow; isMe: boolean; showAvatar: boolean; canDelete: boolean; onDelete: () => void }) {
  const name = message.profile?.name || 'Unknown';
  const time = new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`group flex items-end gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
      <div className="w-8 shrink-0">
        {showAvatar && <Avatar name={name} size={32} />}
      </div>
      <div className={`flex max-w-[75%] flex-col ${isMe ? 'items-end' : 'items-start'}`}>
        {showAvatar && (
          <div className={`mb-1 flex items-center gap-2 text-[11px] text-ink-500 dark:text-ink-300 ${isMe ? 'flex-row-reverse' : ''}`}>
            <span className="font-medium text-ink-700 dark:text-ink-100">{isMe ? 'You' : name}</span>
            <span>{time}</span>
          </div>
        )}
        <div className={`relative rounded-2xl px-3 py-2 text-sm ${isMe ? 'bg-brand-500 text-white' : 'bg-white text-ink-800 shadow-soft dark:bg-ink-700 dark:text-ink-50'}`}>
          {message.message_type === 'text' && <p className="whitespace-pre-wrap break-words">{message.content}</p>}
          {message.message_type === 'image' && message.media_url && (
            <a href={message.media_url} target="_blank" rel="noreferrer">
              <img src={message.media_url} alt={message.media_name || 'Image'} className="max-w-full rounded-lg" style={{ maxHeight: 300 }} />
            </a>
          )}
          {message.message_type === 'video' && message.media_url && (
            <video src={message.media_url} controls className="max-w-full rounded-lg" style={{ maxHeight: 300 }} />
          )}
          {message.message_type === 'file' && message.media_url && (
            <a href={message.media_url} target="_blank" rel="noreferrer" download={message.media_name || undefined} className="flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
              <span className="underline">{message.media_name || 'Download file'}</span>
            </a>
          )}
          {canDelete && (
            <button onClick={onDelete} className="absolute -top-2 -right-2 hidden h-5 w-5 place-items-center rounded-full bg-ink-700 text-white shadow group-hover:grid" aria-label="Delete message">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function MemberList({ members, currentUserId }: { members: GroupMemberRow[]; currentUserId?: string }) {
  const sorted = [...members].sort((a, b) => {
    const rank = { owner: 0, admin: 1, member: 2 };
    if (rank[a.role] !== rank[b.role]) return rank[a.role] - rank[b.role];
    return (a.profile?.name || '').localeCompare(b.profile?.name || '');
  });
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <h3 className="text-sm font-semibold">Members</h3>
        <span className="text-xs text-ink-500 dark:text-ink-300">{members.length}</span>
      </div>
      <ul className="flex-1 space-y-1 overflow-y-auto px-2 pb-4">
        {sorted.map((m) => {
          const isMe = m.user_id === currentUserId;
          const name = m.profile?.name || 'Unknown';
          return (
            <li key={m.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-ink-100 dark:hover:bg-ink-700/60">
              <Avatar name={name} size={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{name}{isMe && <span className="text-ink-400"> (you)</span>}</p>
                <p className="truncate text-[11px] text-ink-500 dark:text-ink-300">@{m.profile?.username || 'unknown'}</p>
              </div>
              {m.role === 'owner' && <span className="tb-badge bg-accent-500/15 text-accent-600 dark:text-accent-400">owner</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
